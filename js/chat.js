import { opts, onOpts } from './settings.js';
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const MAX_LINES = 40;
const FADE_MS = 9000;

// Party chat: a small log in the corner plus a text box. Enter (desktop) or the chat
// button (touch) opens it; it's always open on the pause screen.
export class Chat {
  constructor({ send, mobile }) {
    this.send = send;
    this.mobile = mobile;
    this.el = $('chat');
    this.log = $('chat-log');
    this.form = $('chat-form');
    this.input = $('chat-input');
    this.typing = false;
    this.paused = false;
    this.inLobby = false;
    this.onClose = null;
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.input.value.trim();
      if (text) this.send(text);
      this.input.value = '';
      if (!this.paused) this.close();
    });
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation(); // typing must never move the player or trigger hotkeys
      if (e.key === 'Escape') { this.input.value = ''; this.close(); }
    });
    this.input.addEventListener('keyup', (e) => e.stopPropagation());
    $('chat-hint').classList.toggle('hidden', mobile);
    onOpts(() => this.refresh());
  }

  // Lobby joined / left.
  setLobby(v) {
    this.inLobby = v;
    if (!v) { this.log.innerHTML = ''; this.close(); }
    this.refresh();
  }

  setPaused(v) {
    this.paused = v;
    if (!v && this.typing && document.activeElement !== this.input) this.typing = false;
    this.refresh();
  }

  refresh() {
    const show = this.inLobby && opts.showChat;
    this.el.classList.toggle('hidden', !show);
    this.el.classList.toggle('open', this.typing || this.paused);
    this.form.classList.toggle('hidden', !(this.typing || this.paused));
  }

  open() {
    if (!this.inLobby || !opts.showChat) return;
    this.typing = true;
    this.refresh();
    this.input.focus();
  }

  close() {
    this.typing = false;
    this.input.blur();
    this.refresh();
    if (this.onClose) this.onClose();
  }

  add(name, color, text, mine = false) {
    const line = document.createElement('div');
    line.className = 'cl';
    const who = document.createElement('b');
    who.textContent = name + ': ';
    who.style.color = color || '#fff';
    const msg = document.createElement('span');
    msg.textContent = text;
    line.append(who, msg);
    this.push(line);
    if (!mine) sfx.beep(0.35);
  }

  system(text) {
    const line = document.createElement('div');
    line.className = 'cl sys';
    line.textContent = text;
    this.push(line);
  }

  push(line) {
    this.log.appendChild(line);
    while (this.log.children.length > MAX_LINES) this.log.firstChild.remove();
    setTimeout(() => line.classList.add('old'), FADE_MS);
    this.log.scrollTop = this.log.scrollHeight;
  }
}
