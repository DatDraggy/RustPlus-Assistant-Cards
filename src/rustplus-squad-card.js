// Rust+ Team Squad Card
//
// A roster of your in-game team for the Rust+ Assistant integration: Steam avatar,
// online/alive status, map grid, and a leader crown. Auto-discovers the per-teammate
// sensors the integration creates (any sensor exposing `steam_id` + `in_team`
// attributes), or use an explicit `entities` list.

class RustSquadCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setConfig(config) {
    this.config = { columns: 1, ...config };
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

  // Members: explicit entities, else auto-discovered teammate sensors.
  _members() {
    const states = this._hass.states;
    let ids = this.config.entities;
    if (!ids || !ids.length) {
      ids = Object.keys(states).filter((id) => {
        if (!id.startsWith('sensor.')) return false;
        const a = states[id].attributes || {};
        return 'steam_id' in a && 'in_team' in a;
      });
    }
    const members = ids
      .map((id) => states[id])
      .filter((st) => st && (st.attributes || {}).in_team !== false)
      .map((st) => {
        const a = st.attributes || {};
        return {
          name: a.name || (a.friendly_name || st.entity_id),
          steam_id: a.steam_id,
          online: !!a.is_online,
          alive: !!a.is_alive,
          leader: !!a.is_leader,
          grid: a.grid || null,
          state: st.state,
        };
      });
    // Leader first, then online, then alphabetical.
    members.sort((x, y) =>
      (Number(y.leader) - Number(x.leader)) ||
      (Number(y.online) - Number(x.online)) ||
      String(x.name).localeCompare(String(y.name)));
    return members;
  }

  render() {
    if (!this._hass) return;
    const members = this._members();
    const online = members.filter((m) => m.online).length;
    const title = this.config.title || 'Squad';

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
        .count { font-size: 0.8rem; color: #9ca3af; }
        .count b { color: #34d399; }
        .list {
          padding: 8px; display: grid; gap: 6px;
          grid-template-columns: repeat(${Math.max(1, this.config.columns)}, 1fr);
        }
        .m {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 10px; border-radius: 8px;
          background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
        }
        .m.off { opacity: 0.5; }
        .av-wrap { position: relative; flex-shrink: 0; }
        .av {
          width: 38px; height: 38px; border-radius: 50%;
          object-fit: cover; background: #000;
          border: 2px solid #4b5563;
        }
        .m.on .av { border-color: #34d399; }
        .m.dead .av { border-color: #ef4444; filter: grayscale(0.6); }
        .dot {
          position: absolute; right: -1px; bottom: -1px;
          width: 11px; height: 11px; border-radius: 50%;
          border: 2px solid #1e1f22; background: #4b5563;
        }
        .m.on .dot { background: #34d399; }
        .info { min-width: 0; flex: 1; }
        .name {
          font-weight: 600; font-size: 0.92rem; display: flex; align-items: center; gap: 5px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .crown { color: #facc15; --mdc-icon-size: 15px; flex-shrink: 0; }
        .sub { font-size: 0.72rem; color: #9ca3af; display: flex; align-items: center; gap: 8px; margin-top: 2px; }
        .badge { padding: 0 6px; border-radius: 4px; font-weight: 700; font-size: 0.66rem; text-transform: uppercase; }
        .b-alive { background: rgba(16,185,129,0.16); color: #34d399; }
        .b-dead { background: rgba(239,68,68,0.16); color: #f87171; }
        .b-off { background: rgba(148,163,184,0.14); color: #9ca3af; }
        .grid ha-icon { --mdc-icon-size: 13px; color: #6b7280; vertical-align: -2px; }
        .empty { padding: 22px 16px; text-align: center; color: #9ca3af; font-size: 0.9rem; }
      </style>
      <ha-card role="region" aria-label="${this.escapeHtml(title)}">
        <div class="head">
          <ha-icon icon="mdi:account-group"></ha-icon>
          <span class="title">${this.escapeHtml(title)}</span>
          <span class="count"><b>${online}</b> online / ${members.length}</span>
        </div>
        ${members.length ? `
          <div class="list">
            ${members.map((m) => {
              const cls = m.online ? (m.alive ? 'm on' : 'm on dead') : 'm off';
              const badge = !m.online
                ? '<span class="badge b-off">offline</span>'
                : (m.alive ? '<span class="badge b-alive">alive</span>' : '<span class="badge b-dead">dead</span>');
              const av = m.steam_id
                ? `https://companion-rust.facepunch.com/api/avatar/${encodeURIComponent(m.steam_id)}`
                : '';
              return `
                <div class="${cls}">
                  <div class="av-wrap">
                    ${av ? `<img class="av" src="${av}" alt="" referrerpolicy="no-referrer"
                      onerror="this.style.visibility='hidden'" />`
                      : `<div class="av"></div>`}
                    <span class="dot"></span>
                  </div>
                  <div class="info">
                    <div class="name">
                      ${this.escapeHtml(m.name)}
                      ${m.leader ? '<ha-icon class="crown" icon="mdi:crown"></ha-icon>' : ''}
                    </div>
                    <div class="sub">
                      ${badge}
                      ${m.grid ? `<span class="grid"><ha-icon icon="mdi:map-marker"></ha-icon>${this.escapeHtml(m.grid)}</span>` : ''}
                    </div>
                  </div>
                </div>`;
            }).join('')}
          </div>` : `<div class="empty">No teammates — are you in a team in-game?</div>`}
      </ha-card>
    `;
  }

  static getStubConfig() {
    return { title: 'Squad', columns: 1 };
  }

  static getConfigElement() {
    return document.createElement('rust-squad-card-editor');
  }

  getCardSize() {
    return 2;
  }
}

class RustSquadCardEditor extends HTMLElement {
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
        columns: 'Columns',
        entities: 'Teammate entities (blank = auto-detect)',
      }[schema.name] || schema.name);
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.data = this._config;
    this._form.schema = [
      { name: 'title', selector: { text: {} } },
      { name: 'columns', selector: { number: { min: 1, max: 4, mode: 'box' } } },
      { name: 'entities', selector: { entity: { domain: 'sensor', multiple: true } } },
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

if (!customElements.get('rust-squad-card')) {
  customElements.define('rust-squad-card', RustSquadCard);
}
if (!customElements.get('rust-squad-card-editor')) {
  customElements.define('rust-squad-card-editor', RustSquadCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === 'rust-squad-card')) {
  window.customCards.push({
    type: 'rust-squad-card',
    name: 'Rust Team Squad Card',
    description: 'Team roster with avatars, online/alive status, grid and leader.',
    preview: true,
    documentationURL: 'https://github.com/DatDraggy/RustPlus-Assistant-Cards',
  });
}
