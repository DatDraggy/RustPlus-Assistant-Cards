// Rust+ Raid Defense Card
//
// A board of labeled Smart Alarms for the Rust+ Assistant integration. Rust never
// tells Rust+ *what* explosive hit — but the in-game Seismic Sensor outputs power
// by explosive tier (3 rW = MLRS/Rocket/C4, 2 rW = Satchel/Expl. ammo tier,
// 1 rW = grenades) as a single 3 s pulse, so branching that wattage into up to
// three tier-specific Smart Alarms gives real type awareness. Assign each alarm
// its label / severity here (e.g. "Seismic — heavy (Rocket/C4)").
//
// Each tile shows quiet/armed vs recently-fired ("fired 2m ago", straight from the
// event entity's state, which is its last-trigger timestamp). When enough alarms
// fire within a window (or any critical one does), a RAID IN PROGRESS banner
// appears, and a timeline reconstructs the raid while the card is open.

const _SEVERITY = {
  low:      { color: '#60a5fa', label: 'LOW' },
  high:     { color: '#f59e0b', label: 'HIGH' },
  critical: { color: '#ef4444', label: 'CRITICAL' },
};

class RustRaidCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._log = [];          // accumulated fires while the card is open
    this._lastFired = {};    // entity_id -> last seen fired-timestamp (ms)
  }

  setConfig(config) {
    if (!config.alarms || !config.alarms.length) {
      throw new Error('Please define at least one alarm (event or binary_sensor entity)');
    }
    this.config = {
      title: 'Raid Defense',
      window: 10,     // minutes: how long a fire counts toward the raid banner
      threshold: 2,   // fires within the window that trigger the banner
      max_log: 30,
      ...config,
    };
    // Normalise: entries may be plain entity-id strings or {entity, label, ...}.
    this._alarms = this.config.alarms.map((a) =>
      typeof a === 'string' ? { entity: a } : a);
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
    this._collect();
    this.render();
  }

  connectedCallback() {
    // Keep the relative times / banner window live even without state changes.
    this._timer = setInterval(() => this.render(), 15000);
  }

  disconnectedCallback() {
    if (this._timer) clearInterval(this._timer);
  }

  // Last-fired epoch-ms for an alarm entity (event state = trigger timestamp).
  _firedAt(st) {
    if (!st) return null;
    if (st.entity_id.startsWith('binary_sensor.')) {
      // For a binary_sensor alarm, "on" means firing right now.
      return st.state === 'on' ? Date.parse(st.last_changed) : null;
    }
    const t = Date.parse(st.state);
    return Number.isFinite(t) ? t : null;
  }

  _alarmInfo(a) {
    const st = this._hass.states[a.entity];
    const dev = st && st.attributes ? (st.attributes.friendly_name || a.entity) : a.entity;
    const sev = _SEVERITY[a.severity] ? a.severity : 'high';
    return {
      entity: a.entity,
      label: a.label || dev,
      icon: a.icon || 'mdi:alarm-light',
      severity: sev,
      unavailable: !st || st.state === 'unavailable' || st.state === 'unknown',
      firedAt: this._firedAt(st),
    };
  }

  // Watch for new fires and append them to the client-side timeline.
  _collect() {
    if (!this._hass || !this._alarms) return;
    for (const a of this._alarms) {
      const info = this._alarmInfo(a);
      if (info.firedAt == null) continue;
      const prev = this._lastFired[a.entity];
      this._lastFired[a.entity] = info.firedAt;
      if (prev !== undefined && info.firedAt > prev) {
        this._log.push({ t: info.firedAt, label: info.label, severity: info.severity });
        if (this._log.length > this.config.max_log) {
          this._log.splice(0, this._log.length - this.config.max_log);
        }
      }
    }
  }

  _ago(ms) {
    let secs = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (secs < 60) return `${secs}s ago`;
    const m = Math.floor(secs / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
  }

  _clock(ms) {
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  render() {
    if (!this._hass || !this._alarms) return;
    const windowMs = this.config.window * 60000;
    const now = Date.now();
    const infos = this._alarms.map((a) => this._alarmInfo(a));

    const recent = infos.filter((i) => i.firedAt != null && now - i.firedAt <= windowMs);
    const raid = recent.length >= this.config.threshold ||
      recent.some((i) => i.severity === 'critical');

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card {
          background: var(--card-background-color, #1e1f22);
          color: var(--primary-text-color, #f2f3f5);
          border-radius: 12px;
          border: 1px solid ${raid ? 'rgba(239,68,68,0.6)' : 'var(--divider-color, #2b2d31)'};
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
          overflow: hidden;
          font-family: var(--paper-font-body1_-_font-family, 'Outfit','Inter',system-ui,sans-serif);
        }
        .head {
          display: flex; align-items: center; gap: 8px;
          padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .head ha-icon { color: #cd5228; --mdc-icon-size: 20px; }
        .title { font-weight: 700; font-size: 1rem; flex: 1; }
        .banner {
          display: flex; align-items: center; justify-content: center; gap: 10px;
          background: linear-gradient(90deg, rgba(239,68,68,0.25), rgba(239,68,68,0.1));
          border-bottom: 1px solid rgba(239,68,68,0.4);
          color: #f87171; font-weight: 800; letter-spacing: 1.5px;
          padding: 10px; font-size: 0.95rem; text-transform: uppercase;
          animation: throb 1.2s ease-in-out infinite;
        }
        @keyframes throb { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }
        .list { padding: 8px; display: flex; flex-direction: column; gap: 6px; }
        .a {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 12px; border-radius: 8px;
          background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
          border-left: 3px solid var(--sev, #6b7280);
        }
        .a.fired {
          background: rgba(239,68,68,0.08); border-color: rgba(239,68,68,0.35);
        }
        .a.dead { opacity: 0.45; }
        .a > ha-icon { --mdc-icon-size: 22px; color: #9ca3af; flex-shrink: 0; }
        .a.fired > ha-icon { color: var(--sev); }
        .a-main { flex: 1; min-width: 0; }
        .a-label { font-weight: 600; font-size: 0.92rem;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .a-class { font-size: 0.7rem; color: #9ca3af; margin-top: 1px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .a.fired .a-class { color: #fca5a5; }
        .sev-badge {
          font-size: 0.6rem; font-weight: 800; letter-spacing: 0.5px;
          padding: 1px 6px; border-radius: 4px; flex-shrink: 0;
          color: var(--sev); border: 1px solid var(--sev); opacity: 0.85;
        }
        .status { text-align: right; flex-shrink: 0; min-width: 76px; }
        .fired-t { font-size: 0.85rem; font-weight: 700; color: #f87171; }
        .quiet { font-size: 0.78rem; color: #6b7280; }
        .off { font-size: 0.72rem; color: #9ca3af; font-style: italic; }
        .tl-head {
          padding: 10px 16px 4px; font-size: 0.68rem; text-transform: uppercase;
          letter-spacing: 0.5px; color: #9ca3af;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .tl { padding: 2px 16px 12px; display: flex; flex-direction: column; gap: 4px; }
        .tl-e { display: flex; gap: 10px; font-size: 0.82rem; align-items: baseline; }
        .tl-t { color: #6b7280; font-variant-numeric: tabular-nums; flex-shrink: 0; }
        .tl-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; align-self: center; }
      </style>
      <ha-card role="region" aria-label="${this.escapeHtml(this.config.title)}">
        <div class="head">
          <ha-icon icon="mdi:shield-home"></ha-icon>
          <span class="title">${this.escapeHtml(this.config.title)}</span>
        </div>
        ${raid ? `
          <div class="banner"><ha-icon icon="mdi:alert"></ha-icon>Raid in progress<ha-icon icon="mdi:alert"></ha-icon></div>` : ''}
        <div class="list">
          ${infos.map((i) => {
            const sev = _SEVERITY[i.severity];
            const firedRecent = i.firedAt != null && now - i.firedAt <= windowMs;
            let status;
            if (i.unavailable) {
              status = `<div class="off">unavailable</div>`;
            } else if (i.firedAt != null) {
              status = firedRecent
                ? `<div class="fired-t">${this.escapeHtml(this._ago(i.firedAt))}</div>`
                : `<div class="quiet">fired ${this.escapeHtml(this._ago(i.firedAt))}</div>`;
            } else {
              status = `<div class="quiet">armed</div>`;
            }
            return `
              <div class="a ${firedRecent ? 'fired' : ''} ${i.unavailable ? 'dead' : ''}" style="--sev:${sev.color}">
                <ha-icon icon="${i.icon}"></ha-icon>
                <div class="a-main">
                  <div class="a-label">${this.escapeHtml(i.label)}</div>
                </div>
                <span class="sev-badge">${sev.label}</span>
                <div class="status">${status}</div>
              </div>`;
          }).join('')}
        </div>
        ${this._log.length ? `
          <div class="tl-head">Timeline (while open)</div>
          <div class="tl">
            ${[...this._log].reverse().slice(0, 12).map((e) => `
              <div class="tl-e">
                <span class="tl-t">${this.escapeHtml(this._clock(e.t))}</span>
                <span class="tl-dot" style="background:${_SEVERITY[e.severity].color}"></span>
                <span>${this.escapeHtml(e.label)}</span>
              </div>`).join('')}
          </div>` : ''}
      </ha-card>
    `;
  }

  static getStubConfig() {
    return { title: 'Raid Defense', alarms: [], window: 10, threshold: 2 };
  }

  static getConfigElement() {
    return document.createElement('rust-raid-card-editor');
  }

  getCardSize() {
    return 1 + Math.ceil(((this._alarms && this._alarms.length) || 2) / 2);
  }
}

class RustRaidCardEditor extends HTMLElement {
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
        title: 'Title',
        alarms: 'Alarm entities (labels/severity/icons per alarm via YAML)',
        window: 'Raid window (minutes)',
        threshold: 'Fires within window for RAID banner',
      }[schema.name] || schema.name);
      this.appendChild(this._form);
    }
    // The editor edits the simple form; per-alarm label/severity objects are kept
    // as-is (YAML) — only plain entity-id entries round-trip through the picker.
    const data = {
      ...this._config,
      alarms: (this._config.alarms || []).map((a) => (typeof a === 'string' ? a : a.entity)),
    };
    this._form.hass = this._hass;
    this._form.data = data;
    this._form.schema = [
      { name: 'title', selector: { text: {} } },
      { name: 'alarms', selector: { entity: { multiple: true, filter: [{ domain: 'event' }, { domain: 'binary_sensor' }] } } },
      { name: 'window', selector: { number: { min: 1, max: 120, mode: 'box' } } },
      { name: 'threshold', selector: { number: { min: 1, max: 10, mode: 'box' } } },
    ];
  }

  _valueChanged(ev) {
    const value = { ...ev.detail.value };
    // Re-attach rich per-alarm config for entities that already had it.
    const rich = {};
    for (const a of (this._config.alarms || [])) {
      if (typeof a === 'object' && a.entity) rich[a.entity] = a;
    }
    value.alarms = (value.alarms || []).map((eid) => rich[eid] || eid);
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: value },
      bubbles: true,
      composed: true,
    }));
  }
}

if (!customElements.get('rust-raid-card')) {
  customElements.define('rust-raid-card', RustRaidCard);
}
if (!customElements.get('rust-raid-card-editor')) {
  customElements.define('rust-raid-card-editor', RustRaidCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === 'rust-raid-card')) {
  window.customCards.push({
    type: 'rust-raid-card',
    name: 'Rust Raid Defense Card',
    description: 'Labeled smart-alarm board with severity, raid banner and timeline.',
    preview: true,
    documentationURL: 'https://github.com/DatDraggy/RustPlus-Assistant-Cards',
  });
}
