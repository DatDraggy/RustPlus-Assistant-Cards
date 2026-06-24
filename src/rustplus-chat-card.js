// Rust+ Team Chat Card
//
// A live team-chat log + send box for the Rust+ Assistant integration. Reads the
// "Last Team Message" sensor (sensor.tiderust_last_team_message) and accumulates
// each new message into a scrolling log (HA keeps no chat history, so the log fills
// as messages arrive while the card is open). The composer sends via the
// rustplus_assistant.send_team_message service.

class RustChatCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._log = [];
    this._lastKey = null;
    this._built = false;
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error('Please define the last-message entity (sensor.tiderust_last_team_message)');
    }
    this.config = { send: true, max: 50, title: 'Team Chat', ...config };
  }

  escapeHtml(unsafe) {
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) this._build();
    this._update();
  }

  _build() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card {
          background: var(--card-background-color, #1e1f22);
          color: var(--primary-text-color, #f2f3f5);
          border-radius: 12px;
          border: 1px solid var(--divider-color, #2b2d31);
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
          overflow: hidden; display: flex; flex-direction: column;
          font-family: var(--paper-font-body1_-_font-family, 'Outfit','Inter',system-ui,sans-serif);
        }
        .head {
          display: flex; align-items: center; gap: 8px;
          padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .head ha-icon { color: #cd5228; --mdc-icon-size: 20px; }
        .title { font-weight: 700; font-size: 1rem; flex: 1; }
        .log {
          padding: 10px 14px; overflow-y: auto;
          max-height: var(--rust-chat-height, 260px);
          display: flex; flex-direction: column; gap: 7px;
        }
        .msg { font-size: 0.9rem; line-height: 1.35; word-break: break-word; }
        .who { font-weight: 700; margin-right: 6px; }
        .msg.cmd { background: rgba(205,82,40,0.12); border-left: 2px solid #cd5228; padding: 3px 8px; border-radius: 4px; }
        .time { font-size: 0.68rem; color: #6b7280; margin-left: 6px; }
        .empty { color: #9ca3af; font-size: 0.88rem; text-align: center; padding: 20px 8px; }
        .composer {
          display: flex; gap: 8px; padding: 10px 14px;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .composer input {
          flex: 1; background: #151618; color: #f2f3f5;
          border: 1px solid #2b2d31; border-radius: 8px; padding: 9px 12px;
          font-size: 0.9rem; outline: none; font-family: inherit;
        }
        .composer input:focus { border-color: #cd5228; }
        .composer button {
          background: #cd5228; color: #fff; border: none; border-radius: 8px;
          padding: 0 14px; cursor: pointer; font-weight: 700; font-size: 0.9rem;
        }
        .composer button:hover { background: #e35d2e; }
        .composer button:disabled { opacity: 0.5; cursor: default; }
      </style>
      <ha-card role="region" aria-label="${this.escapeHtml(this.config.title)}">
        <div class="head">
          <ha-icon icon="mdi:chat"></ha-icon>
          <span class="title">${this.escapeHtml(this.config.title)}</span>
        </div>
        <div class="log"><div class="empty">Messages appear here as they're sent in team chat.</div></div>
        ${this.config.send ? `
          <div class="composer">
            <input type="text" placeholder="Message team chat…" maxlength="128" />
            <button title="Send">Send</button>
          </div>` : ''}
      </ha-card>
    `;
    this._logEl = this.shadowRoot.querySelector('.log');
    if (this.config.send) {
      this._input = this.shadowRoot.querySelector('.composer input');
      this._btn = this.shadowRoot.querySelector('.composer button');
      this._btn.addEventListener('click', () => this._send());
      this._input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this._send(); });
    }
    this._built = true;
  }

  _send() {
    const msg = (this._input.value || '').trim();
    if (!msg || !this._hass) return;
    this._hass.callService('rustplus_assistant', 'send_team_message', { message: msg });
    this._input.value = '';
  }

  _fmtTime(epoch) {
    const n = parseInt(epoch, 10);
    const d = Number.isFinite(n) && n > 0 ? new Date(n * 1000) : new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  _update() {
    const st = this._hass.states[this.config.entity];
    if (!st) return;
    const a = st.attributes || {};
    // De-dupe on (time + message): a new chat message updates the sensor.
    const key = `${a.time || ''}|${st.state}`;
    if (st.state && st.state !== 'unknown' && st.state !== 'unavailable' && key !== this._lastKey) {
      this._lastKey = key;
      this._log.push({
        who: a.sender_name || 'unknown',
        colour: a.colour || null,
        message: st.state,
        time: this._fmtTime(a.time),
        cmd: !!a.is_command,
      });
      if (this._log.length > this.config.max) this._log.splice(0, this._log.length - this.config.max);
      this._renderLog();
    }
  }

  _renderLog() {
    if (!this._logEl) return;
    if (!this._log.length) return;
    this._logEl.innerHTML = this._log.map((m) => `
      <div class="msg${m.cmd ? ' cmd' : ''}">
        <span class="who" style="${m.colour ? `color:${this.escapeHtml(m.colour)}` : 'color:#ff8a5c'}">${this.escapeHtml(m.who)}</span>
        <span>${this.escapeHtml(m.message)}</span>
        <span class="time">${this.escapeHtml(m.time)}</span>
      </div>`).join('');
    this._logEl.scrollTop = this._logEl.scrollHeight;
  }

  static getStubConfig() {
    return { entity: 'sensor.tiderust_last_team_message', send: true };
  }

  static getConfigElement() {
    return document.createElement('rust-chat-card-editor');
  }

  getCardSize() {
    return 5;
  }
}

class RustChatCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _render() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement('ha-form');
      this._form.addEventListener('value-changed', (ev) => this._valueChanged(ev));
      this._form.computeLabel = (schema) => ({
        entity: 'Last-message entity',
        title: 'Title',
        send: 'Show send box',
        max: 'Max messages kept',
      }[schema.name] || schema.name);
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.data = this._config;
    this._form.schema = [
      { name: 'entity', required: true, selector: { entity: { domain: 'sensor' } } },
      { name: 'title', selector: { text: {} } },
      { name: 'send', selector: { boolean: {} } },
      { name: 'max', selector: { number: { min: 10, max: 200, mode: 'box' } } },
    ];
  }

  _valueChanged(ev) {
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: ev.detail.value },
      bubbles: true,
      composed: true,
    }));
  }
}

if (!customElements.get('rust-chat-card')) {
  customElements.define('rust-chat-card', RustChatCard);
}
if (!customElements.get('rust-chat-card-editor')) {
  customElements.define('rust-chat-card-editor', RustChatCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === 'rust-chat-card')) {
  window.customCards.push({
    type: 'rust-chat-card',
    name: 'Rust Team Chat Card',
    description: 'Live team-chat log with a send box.',
    preview: true,
    documentationURL: 'https://github.com/DatDraggy/RustPlus-Assistant-Cards',
  });
}
