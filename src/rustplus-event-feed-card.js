// Rust+ Server Event Feed Card
//
// Status of the recurring map events (Cargo Ship, Patrol Helicopter, CH47, Traveling
// Vendor) for the Rust+ Assistant integration: "active now" badges plus an estimated
// countdown to the next spawn. Auto-discovers the event binary_sensors (any exposing
// a `cadence_minutes` attribute) and reads their `next_estimated` estimate.

const _EVENT_ICONS = {
  'cargo ship': 'mdi:ferry',
  'patrol helicopter': 'mdi:helicopter',
  'ch47 chinook': 'mdi:helicopter',
  'traveling vendor': 'mdi:truck-delivery',
};

class RustEventFeedCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setConfig(config) {
    this.config = { title: 'Events', ...config };
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
    this.render();
  }

  connectedCallback() {
    // Refresh the countdowns even when no state change arrives.
    this._timer = setInterval(() => this.render(), 30000);
  }

  disconnectedCallback() {
    if (this._timer) clearInterval(this._timer);
  }

  _events() {
    const states = this._hass.states;
    let ids = this.config.entities;
    if (!ids || !ids.length) {
      ids = Object.keys(states).filter((id) =>
        id.startsWith('binary_sensor.') && 'cadence_minutes' in (states[id].attributes || {}));
    }
    return ids.map((id) => states[id]).filter(Boolean).map((st) => {
      const a = st.attributes || {};
      const name = a.name || a.friendly_name || st.entity_id;
      return {
        name,
        active: st.state === 'on',
        next: a.next_estimated || null,
        samples: Number(a.samples || 0),
        cadence: a.cadence_minutes,
        icon: _EVENT_ICONS[String(name).toLowerCase()] || a.icon || 'mdi:map-marker',
      };
    });
  }

  // "in 12m" / "in 1h 5m" / "due now" for a future ISO timestamp.
  _untilLabel(iso) {
    if (!iso) return null;
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return null;
    let secs = Math.round((t - Date.now()) / 1000);
    if (secs <= 0) return 'due now';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (h > 0) return `in ${h}h ${m}m`;
    if (m > 0) return `in ${m}m`;
    return 'in <1m';
  }

  render() {
    if (!this._hass) return;
    const events = this._events();
    const title = this.config.title || 'Events';

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card {
          background: var(--card-background-color, #1e1f22);
          color: var(--primary-text-color, #f2f3f5);
          border-radius: 12px;
          border: 1px solid var(--divider-color, #2b2d31);
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
        .list { padding: 8px; display: flex; flex-direction: column; gap: 6px; }
        .e {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 12px; border-radius: 8px;
          background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
        }
        .e.active { background: rgba(16,185,129,0.10); border-color: rgba(16,185,129,0.35); }
        .e > ha-icon { --mdc-icon-size: 24px; color: #9ca3af; flex-shrink: 0; }
        .e.active > ha-icon { color: #34d399; }
        .e-name { font-weight: 600; font-size: 0.95rem; flex: 1; min-width: 0;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .status { text-align: right; flex-shrink: 0; }
        .live {
          font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.4px;
          color: #34d399; display: flex; align-items: center; gap: 5px; justify-content: flex-end;
        }
        .live .pulse {
          width: 8px; height: 8px; border-radius: 50%; background: #34d399;
          box-shadow: 0 0 0 0 rgba(52,211,153,0.6); animation: pulse 1.6s infinite;
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(52,211,153,0.6); }
          70% { box-shadow: 0 0 0 7px rgba(52,211,153,0); }
          100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); }
        }
        .next { font-size: 0.9rem; font-weight: 700; color: #e5e7eb; }
        .next-label { font-size: 0.64rem; text-transform: uppercase; color: #9ca3af; letter-spacing: 0.4px; }
        .muted { color: #6b7280; font-size: 0.82rem; }
        .empty { padding: 22px 16px; text-align: center; color: #9ca3af; font-size: 0.9rem; }
      </style>
      <ha-card role="region" aria-label="${this.escapeHtml(title)}">
        <div class="head">
          <ha-icon icon="mdi:radar"></ha-icon>
          <span class="title">${this.escapeHtml(title)}</span>
        </div>
        ${events.length ? `
          <div class="list">
            ${events.map((e) => {
              let status;
              if (e.active) {
                status = `<div class="live"><span class="pulse"></span>Active</div>`;
              } else {
                const until = this._untilLabel(e.next);
                status = until
                  ? `<div class="next-label">est. next</div><div class="next">${this.escapeHtml(until)}</div>`
                  : `<div class="muted">${e.samples < 2 ? 'learning…' : '—'}</div>`;
              }
              return `
                <div class="e ${e.active ? 'active' : ''}">
                  <ha-icon icon="${e.icon}"></ha-icon>
                  <span class="e-name">${this.escapeHtml(e.name)}</span>
                  <div class="status">${status}</div>
                </div>`;
            }).join('')}
          </div>` : `<div class="empty">No event sensors found.</div>`}
      </ha-card>
    `;
  }

  static getStubConfig() {
    return { title: 'Events' };
  }

  static getConfigElement() {
    return document.createElement('rust-event-feed-card-editor');
  }

  getCardSize() {
    return 3;
  }
}

class RustEventFeedCardEditor extends HTMLElement {
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
        entities: 'Event entities (blank = auto-detect)',
      }[schema.name] || schema.name);
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.data = this._config;
    this._form.schema = [
      { name: 'title', selector: { text: {} } },
      { name: 'entities', selector: { entity: { domain: 'binary_sensor', multiple: true } } },
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

if (!customElements.get('rust-event-feed-card')) {
  customElements.define('rust-event-feed-card', RustEventFeedCard);
}
if (!customElements.get('rust-event-feed-card-editor')) {
  customElements.define('rust-event-feed-card-editor', RustEventFeedCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === 'rust-event-feed-card')) {
  window.customCards.push({
    type: 'rust-event-feed-card',
    name: 'Rust Server Event Feed Card',
    description: 'Cargo / Heli / CH47 / Vendor status with estimated next-spawn countdowns.',
    preview: true,
    documentationURL: 'https://github.com/DatDraggy/RustPlus-Assistant-Cards',
  });
}
