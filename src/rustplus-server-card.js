// Rust+ Server Status Card
//
// A banner-style overview of a Rust server for the Rust+ Assistant integration:
// the Facepunch header image, server name, a live player-count bar with queue
// badge, and map / size / seed / wipe-age stats. Reads everything from the
// "Rust+ Server" info sensor (sensor.rust_server) and degrades gracefully when
// an attribute (e.g. banner image) isn't present, optionally folding in the
// in-game time sensor for a clock line.

class RustServerCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error('Please define the Rust+ Server info entity (sensor.rust_server)');
    }
    this.config = {
      // time_entity is optional; when set, an in-game clock line is shown.
      show_banner: true,
      show_players: true,
      show_stats: true,
      ...config,
    };
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
      <style>
        .error {
          color: #ef4444;
          background: #fee2e2;
          padding: 16px;
          border-radius: 8px;
          font-family: system-ui, sans-serif;
          border: 1px solid #fca5a5;
        }
      </style>
      <div class="error">${this.escapeHtml(message)}</div>
    `;
  }

  // "3 days ago" / "in 2 days" style relative label for a unix epoch (seconds).
  relativeTime(epochSeconds) {
    const secs = parseInt(epochSeconds, 10);
    if (!Number.isFinite(secs) || secs <= 0) return null;
    const diff = Math.floor(Date.now() / 1000) - secs;
    const past = diff >= 0;
    const abs = Math.abs(diff);
    const units = [
      ['day', 86400],
      ['hour', 3600],
      ['minute', 60],
    ];
    for (const [name, span] of units) {
      if (abs >= span) {
        const n = Math.floor(abs / span);
        const label = `${n} ${name}${n === 1 ? '' : 's'}`;
        return past ? `${label} ago` : `in ${label}`;
      }
    }
    return past ? 'just now' : 'imminent';
  }

  render() {
    if (!this._hass) return;
    const stateObj = this._hass.states[this.config.entity];
    if (!stateObj) {
      this.renderError(`Entity not found: ${this.config.entity}`);
      return;
    }

    const attrs = stateObj.attributes || {};
    const name = this.config.title || stateObj.state || attrs.friendly_name || 'Rust Server';
    const unavailable = stateObj.state === 'unavailable' || stateObj.state === 'unknown';

    // Player counts: prefer the info sensor's attributes, else fall back to the
    // standalone player sensors if the user pointed at them.
    const players = Number(attrs.players ?? NaN);
    const maxPlayers = Number(attrs.max_players ?? NaN);
    const queued = Number(attrs.queued_players ?? NaN);
    const hasPlayers = Number.isFinite(players) && Number.isFinite(maxPlayers) && maxPlayers > 0;
    const pct = hasPlayers ? Math.min(100, Math.round((players / maxPlayers) * 100)) : 0;
    let barClass = 'bar-ok';
    if (pct >= 95) barClass = 'bar-full';
    else if (pct >= 80) barClass = 'bar-busy';

    const banner = this.config.show_banner ? (attrs.header_image || '') : '';
    const logo = attrs.logo_image || '';
    const url = attrs.url || '';

    const wipe = this.relativeTime(attrs.wipe_time);
    const stats = [];
    if (attrs.map) stats.push(['mdi:map', 'Map', attrs.map]);
    if (Number.isFinite(Number(attrs.map_size))) stats.push(['mdi:resize', 'Size', attrs.map_size]);
    if (attrs.seed !== undefined && attrs.seed !== null) stats.push(['mdi:dice-5', 'Seed', attrs.seed]);
    if (wipe) stats.push(['mdi:broom', 'Wiped', wipe]);

    // Optional in-game clock line.
    let clock = '';
    if (this.config.time_entity && this._hass.states[this.config.time_entity]) {
      const t = this._hass.states[this.config.time_entity];
      const day = t.attributes && this.config.daytime_entity
        ? this._hass.states[this.config.daytime_entity]
        : null;
      const isDay = day ? day.state === 'on' : null;
      const icon = isDay === null ? 'mdi:clock-outline' : (isDay ? 'mdi:weather-sunny' : 'mdi:weather-night');
      clock = `
        <div class="clock">
          <ha-icon icon="${icon}"></ha-icon>
          <span>${this.escapeHtml(t.state)}</span>
          <span class="clock-sub">in-game</span>
        </div>`;
    }

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
        .banner {
          position: relative;
          height: 116px;
          background: linear-gradient(135deg, #3a2417, #1a1207);
          background-size: cover;
          background-position: center;
        }
        .banner::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(180deg, rgba(20,22,24,0.1) 0%, rgba(20,22,24,0.95) 100%);
        }
        .banner-content {
          position: absolute; bottom: 0; left: 0; right: 0;
          display: flex; align-items: flex-end; gap: 12px;
          padding: 12px 16px; z-index: 1;
        }
        .logo {
          width: 44px; height: 44px; border-radius: 8px;
          object-fit: cover; border: 1px solid rgba(255,255,255,0.15);
          background: #000; flex-shrink: 0;
        }
        .name-block { min-width: 0; }
        .name {
          font-size: 1.15rem; font-weight: 700; letter-spacing: 0.3px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          text-shadow: 0 2px 6px rgba(0,0,0,0.8);
          /* Always sits on the banner's dark gradient, so force white instead of
             inheriting the theme's text color (black on light themes). */
          color: #ffffff;
        }
        .name a { color: inherit; text-decoration: none; }
        .name a:hover { color: #ff6b3d; }
        .offline {
          font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px;
          color: #ef4444; font-weight: 700;
        }
        .body { padding: 14px 16px 16px; }
        .players {
          display: flex; align-items: center; gap: 10px; margin-bottom: 14px;
        }
        .players ha-icon { color: #cd5228; --mdc-icon-size: 20px; }
        .bar-wrap { flex: 1; }
        .bar-top {
          display: flex; justify-content: space-between; font-size: 0.8rem;
          margin-bottom: 4px; color: #c9ccd1;
        }
        .bar-count { font-weight: 700; color: #f2f3f5; }
        .queue {
          font-size: 0.7rem; padding: 1px 6px; border-radius: 4px; margin-left: 6px;
          background: rgba(234,179,8,0.18); color: #facc15; border: 1px solid rgba(234,179,8,0.35);
        }
        .bar {
          height: 8px; border-radius: 4px; background: #151618;
          border: 1px solid #111214; overflow: hidden;
        }
        .bar-fill { height: 100%; border-radius: 4px; transition: width 0.4s ease; }
        .bar-ok .bar-fill { background: linear-gradient(90deg,#10b981,#34d399); }
        .bar-busy .bar-fill { background: linear-gradient(90deg,#f59e0b,#fbbf24); }
        .bar-full .bar-fill { background: linear-gradient(90deg,#ef4444,#f87171); }
        .stats {
          display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;
        }
        .stat {
          display: flex; align-items: center; gap: 8px;
          background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
          border-radius: 6px; padding: 8px 10px;
        }
        .stat ha-icon { color: #9ca3af; --mdc-icon-size: 18px; flex-shrink: 0; }
        .stat-label { font-size: 0.68rem; text-transform: uppercase; color: #9ca3af; letter-spacing: 0.4px; }
        .stat-val {
          font-size: 0.85rem; font-weight: 600;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .clock {
          display: flex; align-items: center; gap: 6px; margin-top: 14px;
          padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.05);
          font-size: 0.95rem; font-weight: 600;
        }
        .clock ha-icon { color: #facc15; --mdc-icon-size: 20px; }
        .clock-sub { font-size: 0.7rem; color: #9ca3af; font-weight: 400; text-transform: uppercase; }
      </style>

      <ha-card role="region" aria-label="${this.escapeHtml(name)} server status">
        ${this.config.show_banner ? `
          <div class="banner" style="${banner ? `background-image:url('${this.escapeHtml(banner)}')` : ''}">
            <div class="banner-content">
              ${logo ? `<img class="logo" src="${this.escapeHtml(logo)}" alt="" />` : ''}
              <div class="name-block">
                <div class="name">${url ? `<a href="${this.escapeHtml(url)}" target="_blank" rel="noopener">${this.escapeHtml(name)}</a>` : this.escapeHtml(name)}</div>
                ${unavailable ? `<div class="offline">Offline</div>` : ''}
              </div>
            </div>
          </div>` : ''}

        <div class="body">
          ${this.config.show_players && hasPlayers ? `
            <div class="players">
              <ha-icon icon="mdi:account-group"></ha-icon>
              <div class="bar-wrap ${barClass}">
                <div class="bar-top">
                  <span>Players</span>
                  <span>
                    <span class="bar-count">${players} / ${maxPlayers}</span>
                    ${Number.isFinite(queued) && queued > 0 ? `<span class="queue">+${queued} queued</span>` : ''}
                  </span>
                </div>
                <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>
              </div>
            </div>` : ''}

          ${this.config.show_stats && stats.length ? `
            <div class="stats">
              ${stats.map(([icon, label, val]) => `
                <div class="stat">
                  <ha-icon icon="${icon}"></ha-icon>
                  <div style="min-width:0">
                    <div class="stat-label">${this.escapeHtml(label)}</div>
                    <div class="stat-val">${this.escapeHtml(val)}</div>
                  </div>
                </div>`).join('')}
            </div>` : ''}

          ${clock}
        </div>
      </ha-card>
    `;
  }

  static getStubConfig() {
    return {
      entity: 'sensor.rust_server',
      time_entity: 'sensor.rust_time',
      daytime_entity: 'binary_sensor.rust_daytime',
      show_banner: true,
      show_players: true,
      show_stats: true,
    };
  }

  static getConfigElement() {
    return document.createElement('rust-server-card-editor');
  }

  getCardSize() {
    return this.config && this.config.show_banner ? 4 : 3;
  }
}

class RustServerCardEditor extends HTMLElement {
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
        entity: 'Server info entity',
        title: 'Title (blank = server name)',
        time_entity: 'In-game time entity (optional)',
        daytime_entity: 'Daytime entity (optional)',
        show_banner: 'Show banner image',
        show_players: 'Show player bar',
        show_stats: 'Show map / seed / wipe stats',
      }[schema.name] || schema.name);
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.data = this._config;
    this._form.schema = [
      { name: 'entity', required: true, selector: { entity: { domain: 'sensor' } } },
      { name: 'title', selector: { text: {} } },
      { name: 'time_entity', selector: { entity: { domain: 'sensor' } } },
      { name: 'daytime_entity', selector: { entity: { domain: 'binary_sensor' } } },
      { name: 'show_banner', selector: { boolean: {} } },
      { name: 'show_players', selector: { boolean: {} } },
      { name: 'show_stats', selector: { boolean: {} } },
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

if (!customElements.get('rust-server-card')) {
  customElements.define('rust-server-card', RustServerCard);
}
if (!customElements.get('rust-server-card-editor')) {
  customElements.define('rust-server-card-editor', RustServerCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === 'rust-server-card')) {
  window.customCards.push({
    type: 'rust-server-card',
    name: 'Rust Server Status Card',
    description: 'Server banner with player-count bar and map / seed / wipe stats.',
    preview: true,
    documentationURL: 'https://github.com/DatDraggy/RustPlus-Assistant-Cards',
  });
}
