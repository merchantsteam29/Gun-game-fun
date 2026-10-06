import { HostLogic } from './host.js';

const PREFIX = 'whffa-v1-';
const MAX_PLAYERS = 12;
const TIMEOUT_MS = 10000;

// Lobby networking over WebRTC (PeerJS). The lobby creator's browser is the host:
// its peer id is derived from the lobby code, so friends only need the code to connect.
export class Net {
  constructor() {
    this.peer = null;
    this.isHost = false;
    this.logic = null;
    this.conns = new Map(); // host side: player id -> DataConnection
    // Positions (snapshots one way, player state the other) go over a second, unordered channel:
    // on the reliable ordered one, a single lost packet holds back everything behind it, so
    // players froze and then jumped. Old snapshots that arrive late are simply ignored.
    this.stateConns = new Map(); // host side: player id -> unordered DataConnection
    this.peerToGid = new Map();
    this.hostConn = null;   // client side
    this.stateConn = null;  // client side
    this.code = null;
    this.onMessage = () => {};
    this.onClose = () => {};
    this.closed = false;
    this.nextId = 1;
  }

  host(code, name, color, opts, cos) {
    return new Promise((resolve, reject) => {
      const peer = new Peer(PREFIX + code);
      this.peer = peer;
      let opened = false;
      peer.on('open', () => {
        opened = true;
        this.isHost = true;
        this.code = code;
        this.maxPlayers = Math.max(2, Math.min(MAX_PLAYERS, opts.maxPlayers || MAX_PLAYERS));
        this.logic = new HostLogic((id, m) => this.sendTo(id, m), (m, except) => this.broadcast(m, except), opts);
        this.logic.code = code; // staff proofs are tied to this lobby
        this.logic.onKick = (id) => { const c = this.conns.get(id); if (c) setTimeout(() => c.close(), 300); };
        peer.on('connection', (conn) => this.accept(conn));
        // WebRTC can take a long time to notice a closed tab, so drop silent players.
        this.reaper = setInterval(() => {
          const now = Date.now();
          for (const c of this.conns.values()) if (now - c.lastSeen > TIMEOUT_MS) c.close();
        }, 2000);
        this.logic.addPlayer('host', name, color, cos);
        resolve();
      });
      peer.on('disconnected', () => { if (!this.closed) peer.reconnect(); });
      peer.on('error', (e) => {
        if (!opened) {
          reject(new Error(e.type === 'unavailable-id' ? 'That lobby code is taken, try again.' : `Could not create lobby (${e.type || e.message}).`));
          peer.destroy();
        } else console.warn('peer error', e);
      });
    });
  }

  accept(conn) {
    if (conn.label === 'state') { this.acceptState(conn); return; }
    conn.lastSeen = Date.now();
    conn.on('data', (m) => {
      conn.lastSeen = Date.now();
      if (!m || typeof m !== 'object' || m.t === 'ping') return;
      if (m.t === 'hello' && !conn.gid && m.spec) { // staff spectating: no player slot, checked by the host logic
        conn.gid = 'p' + this.nextId++;
        this.conns.set(conn.gid, conn);
        this.peerToGid.set(conn.peer, conn.gid);
        this.logic.addSpectator(conn.gid, m.spec);
        return;
      }
      if (m.t === 'hello' && !conn.gid) {
        if (this.conns.size + 1 >= (this.maxPlayers || MAX_PLAYERS)) { // humans only; bots don't take slots
          conn.send({ t: 'full' });
          setTimeout(() => conn.close(), 500);
          return;
        }
        conn.gid = 'p' + this.nextId++;
        this.conns.set(conn.gid, conn);
        this.peerToGid.set(conn.peer, conn.gid);
        this.logic.addPlayer(conn.gid, m.name, m.color, m.cos);
      } else if (conn.gid) this.logic.handle(conn.gid, m);
    });
    const drop = () => {
      if (conn.gid && this.conns.get(conn.gid) === conn) {
        this.conns.delete(conn.gid);
        this.peerToGid.delete(conn.peer);
        const sc = this.stateConns.get(conn.gid);
        if (sc) { this.stateConns.delete(conn.gid); sc.close(); }
        this.logic.removePlayer(conn.gid);
      }
    };
    conn.on('close', drop);
    conn.on('error', drop);
  }

  // The unordered position channel from a client (only 'st' messages are taken from it).
  acceptState(conn) {
    conn.on('open', () => {
      const gid = this.peerToGid.get(conn.peer);
      if (gid) this.stateConns.set(gid, conn);
    });
    conn.on('data', (m) => {
      const gid = this.peerToGid.get(conn.peer);
      if (!gid || !m || m.t !== 'st') return;
      if (this.stateConns.get(gid) !== conn) this.stateConns.set(gid, conn);
      const main = this.conns.get(gid);
      if (main) main.lastSeen = Date.now();
      this.logic.handle(gid, m);
    });
    const drop = () => { for (const [g, c] of this.stateConns) if (c === conn) this.stateConns.delete(g); };
    conn.on('close', drop);
    conn.on('error', drop);
  }

  // spec: a signed staff proof to watch invisibly instead of playing (see roles.js / host.js).
  join(code, name, color, cos, spec = null) {
    return new Promise((resolve, reject) => {
      const peer = new Peer();
      this.peer = peer;
      let done = false;
      const fail = (msg) => { if (done) return; done = true; peer.destroy(); reject(new Error(msg)); };
      const timer = setTimeout(() => fail('Timed out connecting to the lobby.'), 15000);
      peer.on('open', () => {
        const conn = peer.connect(PREFIX + code, { reliable: true });
        this.hostConn = conn;
        conn.on('open', () => {
          done = true;
          clearTimeout(timer);
          this.code = code;
          conn.send(spec ? { t: 'hello', name, color, cos, spec } : { t: 'hello', name, color, cos });
          this.lastHostMsg = Date.now();
          // Second channel for positions (falls back to the main one until/unless it opens).
          setTimeout(() => {
            if (this.closed) return;
            try {
              const sc = peer.connect(PREFIX + code, { reliable: false, serialization: 'json', label: 'state' });
              sc.on('open', () => { this.stateConn = sc; });
              sc.on('data', (m) => { this.lastHostMsg = Date.now(); if (m && m.t === 'snap') this.onMessage(m); });
              sc.on('close', () => { if (this.stateConn === sc) this.stateConn = null; });
              sc.on('error', () => { if (this.stateConn === sc) this.stateConn = null; });
            } catch { /* stay on the main channel */ }
          }, 300);
          this.pinger = setInterval(() => {
            if (conn.open) conn.send({ t: 'ping' });
            if (Date.now() - this.lastHostMsg > TIMEOUT_MS && !this.closed) this.onClose('Lost connection to the host.');
          }, 2000);
          resolve();
        });
        conn.on('data', (m) => {
          this.lastHostMsg = Date.now();
          if (m && m.t === 'full') { this.onClose('Lobby is full.'); return; }
          this.onMessage(m);
        });
        conn.on('close', () => { if (!this.closed) this.onClose('Lost connection to the host.'); });
      });
      peer.on('error', (e) => {
        if (!done) { clearTimeout(timer); fail(e.type === 'peer-unavailable' ? 'No lobby with that code.' : `Connection failed (${e.type || e.message}).`); }
        else console.warn('peer error', e);
      });
    });
  }

  // Host -> one player ('host' is the local player and is delivered in-process).
  sendTo(id, m) {
    if (id === 'host') queueMicrotask(() => this.onMessage(m));
    else { const c = this.conns.get(id); if (c && c.open) c.send(m); }
  }

  broadcast(m, except) {
    const snap = m.t === 'snap';
    for (const [id, c] of this.conns) {
      if (id === except) continue;
      const sc = snap && this.stateConns.get(id);
      if (sc && sc.open) sc.send(m);
      else if (c.open) c.send(m);
    }
    if (except !== 'host') queueMicrotask(() => this.onMessage(m));
  }

  // Local player -> host.
  send(m) {
    if (this.isHost) this.logic.handle('host', m);
    else if (m.t === 'st' && this.stateConn && this.stateConn.open) this.stateConn.send(m);
    else if (this.hostConn && this.hostConn.open) this.hostConn.send(m);
  }

  get playerCount() { return this.isHost ? this.conns.size + 1 : 0; }

  destroy() {
    this.closed = true;
    clearInterval(this.reaper);
    clearInterval(this.pinger);
    if (this.logic) this.logic.destroy();
    if (this.peer) this.peer.destroy();
  }
}
