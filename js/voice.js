import { opts, onOpts } from './settings.js';

// Party voice chat: WebRTC audio between party members (everyone connects to everyone, up to
// 8 people), set up through the same PeerJS service as matches. Who's in voice is announced on
// the party's relay channel (social.js). Every call carries a token signed with the caller's
// gamertag key, and calls are only answered from current party members — so nobody else can
// listen in or talk as someone.

const PREFIX = 'whffa-v1-vc-';
const ANNOUNCE_MS = 8000;
const peerId = (party, tagLower) => `${PREFIX}${party}-${tagLower}`;
const low = (t) => String(t || '').toLowerCase();

export class Voice {
  constructor(social) {
    this.social = social;
    this.active = false;
    this.peer = null;
    this.stream = null;
    this.party = null;
    this.calls = new Map(); // lower tag -> { call, audio, level }
    this.inVoice = new Map(); // lower tag -> display tag (other members in voice)
    this.speaking = new Set(); // lower tags (including mine) currently talking
    this.muted = false;
    this.pttDown = false;
    this.onChange = null;
    this.ctx = null;
    social.onVoice = (tag, inVoice) => this.onAnnounce(tag, inVoice);
    social.onPartyGone = () => this.leave();
    onOpts(() => { this.applyMic(); for (const c of this.calls.values()) if (c.audio) c.audio.volume = opts.voiceVolume; });
    // Push-to-talk: hold V (ignored while typing).
    const typing = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
    window.addEventListener('keydown', (e) => { if (e.code === 'KeyV' && !typing() && !this.pttDown) { this.pttDown = true; this.applyMic(); } });
    window.addEventListener('keyup', (e) => { if (e.code === 'KeyV') { this.pttDown = false; this.applyMic(); } });
    window.addEventListener('blur', () => { this.pttDown = false; this.applyMic(); });
  }

  changed() { if (this.onChange) this.onChange(this); }
  get me() { return low(this.social.tag); }
  get talking() { return this.active && !this.muted && (!opts.voicePtt || this.pttDown); }

  // ---------- Join / leave ----------
  async join() {
    const p = this.social.party;
    if (!p) throw new Error('Join a party first.');
    if (this.active) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Voice chat isn\'t supported in this browser.');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch {
      throw new Error('Microphone blocked. Allow microphone access for this site and try again.');
    }
    this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.myLevel = this.meter(this.stream);
    this.party = p.id;
    this.active = true;
    this.applyMic();
    await this.openPeer();
    this.social.sendVoice(true);
    this.announceT = setInterval(() => this.social.sendVoice(true), ANNOUNCE_MS);
    this.levelT = setInterval(() => this.updateLevels(), 100);
    this.changed();
  }

  openPeer() {
    return new Promise((resolve, reject) => {
      const peer = new Peer(peerId(this.party, this.me));
      this.peer = peer;
      let opened = false;
      peer.on('open', () => { opened = true; resolve(); for (const k of this.inVoice.keys()) this.connect(k); });
      peer.on('call', (call) => this.answer(call));
      peer.on('disconnected', () => { if (this.active && this.peer === peer) peer.reconnect(); });
      peer.on('error', (e) => {
        if (!opened) {
          if (e.type === 'unavailable-id') { this.leave(); reject(new Error('You\'re already in voice in another tab.')); }
          else { this.leave(); reject(new Error('Couldn\'t start voice chat. Check your connection.')); }
        }
      });
    });
  }

  leave() {
    if (!this.active) return;
    this.active = false;
    clearInterval(this.announceT);
    clearInterval(this.levelT);
    this.social.sendVoice(false);
    for (const c of this.calls.values()) this.drop(c);
    this.calls.clear();
    if (this.peer) { this.peer.destroy(); this.peer = null; }
    if (this.stream) { for (const t of this.stream.getTracks()) t.stop(); this.stream = null; }
    this.speaking.clear();
    this.party = null;
    this.changed();
  }

  setMuted(v) { this.muted = v; this.applyMic(); this.changed(); }

  applyMic() {
    if (!this.stream) return;
    const on = this.talking;
    for (const t of this.stream.getAudioTracks()) t.enabled = on;
  }

  // ---------- Who's in voice ----------
  onAnnounce(tag, inVoice) {
    const k = low(tag);
    if (inVoice) {
      const isNew = !this.inVoice.has(k);
      this.inVoice.set(k, tag);
      if (this.active) this.connect(k);
      if (isNew) this.changed();
    } else {
      this.inVoice.delete(k);
      const c = this.calls.get(k);
      if (c) { this.drop(c); this.calls.delete(k); }
      this.changed();
    }
  }

  // Only one side starts each call: the one whose gamertag sorts first.
  async connect(k) {
    if (!this.active || !this.peer || !this.peer.open || this.calls.has(k) || !(this.me < k)) return;
    if (!this.isMember(k)) return;
    const token = await this.social.sign({ type: 'voice', party: this.party, to: this.inVoice.get(k) || k });
    if (!this.active || this.calls.has(k)) return;
    const call = this.peer.call(peerId(this.party, k), this.stream, { metadata: { token } });
    if (call) this.setup(call, k);
  }

  async answer(call) {
    if (!this.active) { call.close(); return; }
    const k = call.peer.startsWith(PREFIX + this.party + '-') ? call.peer.slice((PREFIX + this.party + '-').length) : null;
    const body = call.metadata && call.metadata.token ? await this.social.verify(call.metadata.token) : null;
    if (!k || !body || body.type !== 'voice' || body.party !== this.party || low(body.from) !== k || low(body.to) !== this.me || !this.isMember(k)) {
      call.close();
      return;
    }
    const old = this.calls.get(k);
    if (old) this.drop(old);
    if (!this.inVoice.has(k)) this.inVoice.set(k, body.from);
    call.answer(this.stream);
    this.setup(call, k);
  }

  isMember(k) {
    const p = this.social.party;
    return !!p && p.id === this.party && p.members.some((m) => low(m) === k);
  }

  setup(call, k) {
    const entry = { call, audio: null, level: null };
    this.calls.set(k, entry);
    call.on('stream', (remote) => {
      if (entry.audio) return;
      const audio = new Audio();
      audio.srcObject = remote;
      audio.volume = opts.voiceVolume;
      audio.autoplay = true;
      audio.play().catch(() => {});
      entry.audio = audio;
      entry.level = this.meter(remote);
      this.changed();
    });
    const gone = () => {
      if (this.calls.get(k) === entry) { this.drop(entry); this.calls.delete(k); this.changed(); }
      // Reconnect if they're still in voice (e.g. a network blip).
      setTimeout(() => { if (this.active && this.inVoice.has(k)) this.connect(k); }, 2500);
    };
    call.on('close', gone);
    call.on('error', gone);
    this.changed();
  }

  drop(entry) {
    try { entry.call.close(); } catch { /* already closed */ }
    if (entry.audio) { entry.audio.pause(); entry.audio.srcObject = null; }
  }

  // ---------- Speaking indicators ----------
  meter(stream) {
    try {
      const src = this.ctx.createMediaStreamSource(stream);
      const an = this.ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an); // analysis only; playback goes through the <audio> element
      const buf = new Uint8Array(an.fftSize);
      return () => {
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
        return Math.sqrt(sum / buf.length);
      };
    } catch { return () => 0; }
  }

  updateLevels() {
    const now = new Set();
    if (this.talking && this.myLevel && this.myLevel() > 0.03) now.add(this.me);
    for (const [k, c] of this.calls) if (c.level && c.level() > 0.03) now.add(k);
    const same = now.size === this.speaking.size && [...now].every((k) => this.speaking.has(k));
    if (same) return;
    this.speaking = now;
    this.changed();
  }

  // Display names of everyone talking right now (for the in-match HUD).
  talkers() {
    return [...this.speaking].map((k) => (k === this.me ? this.social.tag : this.inVoice.get(k) || k));
  }
}
