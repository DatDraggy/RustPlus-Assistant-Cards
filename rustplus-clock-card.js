// Rust+ In-Game Clock / Day-Night Card
//
// A 24-hour dial for the Rust+ Assistant integration's in-game time sensor
// (sensor.rust_time). Noon sits at the top, midnight at the bottom; the lit arc
// spans sunrise -> sunset (from the sensor's attributes) and a marker tracks the
// current in-game time. The centre shows the digital clock, a day/night label,
// and an in-game countdown to the next dawn or dusk. Raiders read it for the
// daylight window.

class RustClockCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error('Please define the Rust+ time entity (sensor.rust_time)');
    }
    this.config = { ...config };
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

  renderError(message) {
    this.shadowRoot.innerHTML = `
      <style>.error{color:#ef4444;background:#fee2e2;padding:16px;border-radius:8px;
        font-family:system-ui,sans-serif;border:1px solid #fca5a5;}</style>
      <div class="error">${this.escapeHtml(message)}</div>`;
  }

  // "HH:MM" (or a number) -> float hours, or null.
  toHours(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    const s = String(value).trim();
    if (s.includes(':')) {
      const [h, m] = s.split(':');
      const hh = parseInt(h, 10);
      const mm = parseInt(m, 10);
      if (Number.isFinite(hh) && Number.isFinite(mm)) return hh + mm / 60;
      return null;
    }
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  }

  // Our dial convention: angle measured clockwise from the top, 12:00 at top.
  angleFor(hours) {
    return ((hours - 12) / 24) * 360;
  }

  polar(cx, cy, r, angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
  }

  arcPath(cx, cy, r, startAngle, endAngle) {
    const start = this.polar(cx, cy, r, startAngle);
    const end = this.polar(cx, cy, r, endAngle);
    let delta = (endAngle - startAngle) % 360;
    if (delta < 0) delta += 360;
    const largeArc = delta > 180 ? 1 : 0;
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  }

  fmtDuration(hours) {
    const total = Math.max(0, Math.round(hours * 60));
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  render() {
    if (!this._hass) return;
    const stateObj = this._hass.states[this.config.entity];
    if (!stateObj) {
      this.renderError(`Entity not found: ${this.config.entity}`);
      return;
    }
    const attrs = stateObj.attributes || {};
    const now = this.toHours(stateObj.state);
    const sunrise = this.toHours(attrs.sunrise);
    const sunset = this.toHours(attrs.sunset);

    const cx = 100, cy = 100, r = 82;
    const haveArc = now !== null && sunrise !== null && sunset !== null;

    // Daytime: prefer an explicit daytime entity, else derive from sunrise/sunset.
    let isDay = null;
    if (this.config.daytime_entity && this._hass.states[this.config.daytime_entity]) {
      isDay = this._hass.states[this.config.daytime_entity].state === 'on';
    } else if (haveArc) {
      isDay = sunrise <= now && now < sunset;
    }

    // Countdown to the next transition, in in-game time.
    let countdown = '';
    if (haveArc) {
      let remaining, label;
      if (isDay) {
        remaining = sunset - now;
        label = 'until dusk';
      } else {
        remaining = now < sunrise ? sunrise - now : 24 - now + sunrise;
        label = 'until dawn';
      }
      countdown = `${this.fmtDuration(remaining)} ${label}`;
    }

    const dayArc = haveArc
      ? `<path d="${this.arcPath(cx, cy, r, this.angleFor(sunrise), this.angleFor(sunset))}"
           fill="none" stroke="url(#dayGrad)" stroke-width="10" stroke-linecap="round" />`
      : '';

    let marker = '';
    if (now !== null) {
      const p = this.polar(cx, cy, r, this.angleFor(now));
      marker = `
        <circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="9"
          fill="${isDay ? '#facc15' : '#cbd5e1'}" stroke="#151618" stroke-width="3" />`;
    }

    // Tick labels at 0/6/12/18.
    const ticks = [0, 6, 12, 18].map((h) => {
      const p = this.polar(cx, cy, r - 22, this.angleFor(h));
      return `<text x="${p.x.toFixed(1)}" y="${(p.y + 4).toFixed(1)}" class="tick">${String(h).padStart(2, '0')}</text>`;
    }).join('');

    const centerIcon = isDay === null ? 'mdi:clock-outline' : (isDay ? 'mdi:weather-sunny' : 'mdi:weather-night');
    const label = isDay === null ? '' : (isDay ? 'Daytime' : 'Nighttime');
    const title = this.config.title || 'In-Game Time';

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; }
        ha-card {
          background: var(--card-background-color, #1e1f22);
          color: var(--primary-text-color, #f2f3f5);
          border-radius: 12px; border: 1px solid var(--divider-color, #2b2d31);
          box-shadow: 0 4px 20px rgba(0,0,0,0.4); padding: 16px;
          font-family: var(--paper-font-body1_-_font-family,'Outfit','Inter',system-ui,sans-serif);
        }
        .header {
          display:flex; align-items:center; gap:8px; margin-bottom:8px;
          font-size:1.05rem; font-weight:600; letter-spacing:0.3px;
        }
        .header ha-icon { color:#cd5228; }
        .dial-wrap { display:flex; justify-content:center; }
        svg { width:220px; height:220px; max-width:100%; }
        .ring { fill:none; stroke:#2a2c31; stroke-width:10; }
        .tick { fill:#6b7280; font-size:11px; text-anchor:middle;
          font-family: inherit; font-weight:600; }
        .c-time { fill: var(--primary-text-color,#f2f3f5); font-size:30px; font-weight:700;
          text-anchor:middle; font-family:inherit; }
        .c-label { fill:#9ca3af; font-size:12px; text-anchor:middle; text-transform:uppercase;
          letter-spacing:1px; font-family:inherit; }
        .sub {
          display:flex; justify-content:center; gap:18px; margin-top:6px;
          font-size:0.8rem; color:#9ca3af;
        }
        .sub b { color:#c9ccd1; font-weight:600; }
        .countdown {
          text-align:center; margin-top:10px; font-size:0.9rem; font-weight:600;
          color:${isDay ? '#facc15' : '#93c5fd'};
        }
      </style>

      <ha-card role="region" aria-label="${this.escapeHtml(title)}">
        <div class="header">
          <ha-icon icon="${centerIcon}"></ha-icon>
          <span>${this.escapeHtml(title)}</span>
        </div>

        <div class="dial-wrap">
          <svg viewBox="0 0 200 200" role="img" aria-label="In-game time ${this.escapeHtml(stateObj.state)}">
            <defs>
              <linearGradient id="dayGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#fb923c"/>
                <stop offset="50%" stop-color="#fde047"/>
                <stop offset="100%" stop-color="#fb923c"/>
              </linearGradient>
            </defs>
            <circle class="ring" cx="${cx}" cy="${cy}" r="${r}" />
            ${dayArc}
            ${ticks}
            ${marker}
            <text class="c-time" x="${cx}" y="${cy - 2}">${this.escapeHtml(stateObj.state)}</text>
            ${label ? `<text class="c-label" x="${cx}" y="${cy + 18}">${label}</text>` : ''}
          </svg>
        </div>

        ${(sunrise !== null || sunset !== null) ? `
          <div class="sub">
            ${sunrise !== null ? `<span><ha-icon icon="mdi:weather-sunset-up" style="--mdc-icon-size:16px;color:#fb923c"></ha-icon> <b>${this.escapeHtml(attrs.sunrise)}</b></span>` : ''}
            ${sunset !== null ? `<span><ha-icon icon="mdi:weather-sunset-down" style="--mdc-icon-size:16px;color:#a78bfa"></ha-icon> <b>${this.escapeHtml(attrs.sunset)}</b></span>` : ''}
          </div>` : ''}
        ${countdown ? `<div class="countdown">${this.escapeHtml(countdown)}</div>` : ''}
      </ha-card>
    `;
  }

  static getStubConfig() {
    return {
      entity: 'sensor.rust_time',
      daytime_entity: 'binary_sensor.rust_daytime',
      title: '',
    };
  }

  static getConfigElement() {
    return document.createElement('rust-clock-card-editor');
  }

  getCardSize() {
    return 4;
  }
}

class RustClockCardEditor extends HTMLElement {
  setConfig(config) { this._config = config; this._render(); }
  set hass(hass) { this._hass = hass; this._render(); }

  _render() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement('ha-form');
      this._form.addEventListener('value-changed', (ev) => this._valueChanged(ev));
      this._form.computeLabel = (schema) => ({
        entity: 'In-game time entity',
        daytime_entity: 'Daytime entity (optional)',
        title: 'Title',
      }[schema.name] || schema.name);
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.data = this._config;
    this._form.schema = [
      { name: 'entity', required: true, selector: { entity: { domain: 'sensor' } } },
      { name: 'daytime_entity', selector: { entity: { domain: 'binary_sensor' } } },
      { name: 'title', selector: { text: {} } },
    ];
  }

  _valueChanged(ev) {
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: ev.detail.value }, bubbles: true, composed: true,
    }));
  }
}

if (!customElements.get('rust-clock-card')) {
  customElements.define('rust-clock-card', RustClockCard);
}
if (!customElements.get('rust-clock-card-editor')) {
  customElements.define('rust-clock-card-editor', RustClockCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === 'rust-clock-card')) {
  window.customCards.push({
    type: 'rust-clock-card',
    name: 'Rust In-Game Clock Card',
    description: '24-hour day/night dial with sunrise/sunset arc and dawn/dusk countdown.',
    preview: true,
    documentationURL: 'https://github.com/DatDraggy/RustPlus-Assistant-Cards',
  });
}
