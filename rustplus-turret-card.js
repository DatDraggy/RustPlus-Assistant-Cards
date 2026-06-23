// Rust+ Turret / Camera Control Card
//
// A gunner station for the Rust+ Assistant integration's controllable cameras
// (Auto Turret / PTZ): the live feed plus a directional aim D-pad, a fire
// button, and the Control toggle. Given just the camera entity it resolves the
// sibling aim/fire buttons and Control switch from the same device, so config is
// a single line. Aiming and firing only work while Control is on (for a turret,
// taking control disables its auto-aim), so the controls are disabled until then.

class RustTurretCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._built = false;
    this._timer = null;
  }

  setConfig(config) {
    if (!config.camera) {
      throw new Error('Please define the Rust+ camera entity (e.g. camera.rust_turret)');
    }
    this.config = { ...config };
    // Force a rebuild if the configured camera changed.
    this._built = false;
    this._builtFor = null;
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
    if (!this._built || this._builtFor !== this.config.camera) {
      this._build();
    }
    this._update();
  }

  connectedCallback() {
    this._startRefresh();
  }

  disconnectedCallback() {
    this._stopRefresh();
  }

  _startRefresh() {
    this._stopRefresh();
    // The integration throttles snapshots to ~5s server-side, so polling the
    // proxied frame every few seconds is enough to look live without churn.
    this._timer = setInterval(() => this._refreshImage(), 3500);
  }

  _stopRefresh() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  // Resolve the aim/fire buttons + Control switch from the camera's device,
  // honouring any explicit overrides in the config.
  _resolve() {
    const cfg = this.config;
    const out = {
      camera: cfg.camera,
      control: cfg.control_entity || null,
      aim_left: cfg.aim_left || null,
      aim_right: cfg.aim_right || null,
      aim_up: cfg.aim_up || null,
      aim_down: cfg.aim_down || null,
      fire: cfg.fire || null,
    };
    const entities = this._hass && this._hass.entities;
    const reg = entities && entities[cfg.camera];
    if (reg && reg.device_id) {
      for (const [eid, e] of Object.entries(entities)) {
        if (e.device_id !== reg.device_id) continue;
        const domain = eid.split('.')[0];
        const st = this._hass.states[eid];
        const fname = st && st.attributes && st.attributes.friendly_name ? st.attributes.friendly_name : eid;
        const hay = `${fname} ${eid.replace(/_/g, ' ')}`.toLowerCase();
        if (domain === 'switch' && !out.control) out.control = eid;
        else if (domain === 'button') {
          if (/aim left/.test(hay)) out.aim_left = out.aim_left || eid;
          else if (/aim right/.test(hay)) out.aim_right = out.aim_right || eid;
          else if (/aim up/.test(hay)) out.aim_up = out.aim_up || eid;
          else if (/aim down/.test(hay)) out.aim_down = out.aim_down || eid;
          else if (/fire/.test(hay)) out.fire = out.fire || eid;
        }
      }
    }
    return out;
  }

  _press(entityId) {
    if (!entityId || !this._hass) return;
    this._hass.callService('button', 'press', { entity_id: entityId });
  }

  _toggleControl() {
    const ctrl = this._ent && this._ent.control;
    if (!ctrl || !this._hass) return;
    const on = this._hass.states[ctrl] && this._hass.states[ctrl].state === 'on';
    this._hass.callService('switch', on ? 'turn_off' : 'turn_on', { entity_id: ctrl });
  }

  _refreshImage() {
    if (!this._img || !this._hass || !this._ent) return;
    const cam = this._hass.states[this._ent.camera];
    const pic = cam && cam.attributes ? cam.attributes.entity_picture : null;
    if (pic) {
      const sep = pic.includes('?') ? '&' : '?';
      this._img.src = `${pic}${sep}_=${Date.now()}`;
      this._img.style.display = '';
      if (this._noFeed) this._noFeed.style.display = 'none';
    } else if (this._noFeed) {
      this._img.style.display = 'none';
      this._noFeed.style.display = '';
    }
  }

  _build() {
    const title = this.config.title || 'Camera Control';
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; }
        ha-card {
          background: var(--card-background-color, #1e1f22);
          color: var(--primary-text-color, #f2f3f5);
          border-radius: 12px; border: 1px solid var(--divider-color, #2b2d31);
          box-shadow: 0 4px 20px rgba(0,0,0,0.4); overflow:hidden;
          font-family: var(--paper-font-body1_-_font-family,'Outfit','Inter',system-ui,sans-serif);
        }
        .header {
          display:flex; align-items:center; gap:8px; padding:12px 16px;
          font-size:1.05rem; font-weight:600; letter-spacing:0.3px;
        }
        .header ha-icon { color:#cd5228; }
        .feed {
          position:relative; background:#000; aspect-ratio:16/9;
          display:flex; align-items:center; justify-content:center; overflow:hidden;
        }
        .feed img { width:100%; height:100%; object-fit:cover; display:block; }
        .no-feed { color:#6b7280; font-size:0.85rem; display:flex; flex-direction:column;
          align-items:center; gap:6px; }
        .no-feed ha-icon { --mdc-icon-size:32px; }
        .badge {
          position:absolute; top:8px; left:8px; z-index:2;
          font-size:0.68rem; font-weight:700; letter-spacing:0.5px; text-transform:uppercase;
          padding:3px 8px; border-radius:4px; display:flex; align-items:center; gap:5px;
        }
        .badge.live { background:rgba(16,185,129,0.2); color:#34d399; border:1px solid rgba(16,185,129,0.4); }
        .badge.idle { background:rgba(107,114,128,0.25); color:#cbd5e1; border:1px solid rgba(107,114,128,0.4); }
        .dot { width:7px; height:7px; border-radius:50%; background:currentColor; }
        .badge.live .dot { animation: blink 1.2s infinite; }
        @keyframes blink { 50% { opacity:0.3; } }

        .controls { padding:14px 16px 16px; }
        .pad {
          display:grid; grid-template-columns:repeat(3, 56px); grid-template-rows:repeat(3, 56px);
          gap:8px; justify-content:center; margin-bottom:12px;
        }
        button.ctl {
          border:1px solid #2e3035; background:#232428; color:#f2f3f5;
          border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center;
          transition: all 0.12s ease; padding:0;
        }
        button.ctl ha-icon { --mdc-icon-size:26px; }
        button.ctl:hover:not(:disabled) { background:#2d2f35; border-color:#cd5228; transform:scale(1.05); }
        button.ctl:active:not(:disabled) { transform:scale(0.95); background:#cd5228; }
        button.ctl:disabled { opacity:0.3; cursor:not-allowed; }
        .pad .center { display:flex; align-items:center; justify-content:center; }
        .pad .spacer { visibility:hidden; }

        .center-btn {
          width:56px; height:56px; border-radius:50%;
          border:2px solid #2e3035; background:#232428; color:#9ca3af; cursor:pointer;
          display:flex; align-items:center; justify-content:center; transition: all 0.15s ease;
        }
        .center-btn ha-icon { --mdc-icon-size:24px; }
        .center-btn.on {
          background:rgba(16,185,129,0.15); border-color:#10b981; color:#34d399;
          box-shadow:0 0 12px rgba(16,185,129,0.3);
        }
        .row { display:flex; gap:10px; }
        .fire {
          flex:1; height:46px; border-radius:8px; cursor:pointer; font-weight:700;
          letter-spacing:0.5px; text-transform:uppercase; font-size:0.85rem;
          display:flex; align-items:center; justify-content:center; gap:8px;
          background:rgba(239,68,68,0.15); color:#f87171; border:1px solid rgba(239,68,68,0.4);
          transition: all 0.12s ease;
        }
        .fire ha-icon { --mdc-icon-size:20px; }
        .fire:hover:not(:disabled) { background:rgba(239,68,68,0.3); }
        .fire:active:not(:disabled) { transform:scale(0.97); background:#ef4444; color:#fff; }
        .fire:disabled { opacity:0.3; cursor:not-allowed; }
        .control-btn {
          height:46px; padding:0 16px; border-radius:8px; cursor:pointer; font-weight:600;
          font-size:0.85rem; display:flex; align-items:center; justify-content:center; gap:8px;
          background:#232428; border:1px solid #2e3035; color:#f2f3f5; transition: all 0.12s ease;
        }
        .control-btn.on { background:rgba(16,185,129,0.15); border-color:#10b981; color:#34d399; }
        .control-btn ha-icon { --mdc-icon-size:20px; }
        .control-btn:hover { border-color:#cd5228; }
        .hint { text-align:center; font-size:0.75rem; color:#6b7280; margin-top:10px; }
        .error { color:#fca5a5; font-size:0.85rem; padding:0 16px 14px; }
      </style>

      <ha-card role="region" aria-label="${this.escapeHtml(title)}">
        <div class="header">
          <ha-icon icon="mdi:cctv"></ha-icon>
          <span>${this.escapeHtml(title)}</span>
        </div>
        <div class="feed">
          <div class="badge idle" id="badge"><span class="dot"></span><span id="badge-text">Idle</span></div>
          <img id="img" alt="Camera feed" />
          <div class="no-feed" id="no-feed" style="display:none">
            <ha-icon icon="mdi:cctv-off"></ha-icon>
            <span id="no-feed-text">No feed</span>
          </div>
        </div>
        <div class="controls">
          <div class="pad">
            <div class="spacer"></div>
            <button class="ctl" id="aim_up" title="Aim Up"><ha-icon icon="mdi:chevron-up"></ha-icon></button>
            <div class="spacer"></div>
            <button class="ctl" id="aim_left" title="Aim Left"><ha-icon icon="mdi:chevron-left"></ha-icon></button>
            <div class="center">
              <button class="center-btn" id="control" title="Toggle control"><ha-icon icon="mdi:power"></ha-icon></button>
            </div>
            <button class="ctl" id="aim_right" title="Aim Right"><ha-icon icon="mdi:chevron-right"></ha-icon></button>
            <div class="spacer"></div>
            <button class="ctl" id="aim_down" title="Aim Down"><ha-icon icon="mdi:chevron-down"></ha-icon></button>
            <div class="spacer"></div>
          </div>
          <div class="row" id="action-row">
            <button class="control-btn" id="control-wide"><ha-icon icon="mdi:remote"></ha-icon><span id="control-label">Take Control</span></button>
            <button class="fire" id="fire"><ha-icon icon="mdi:pistol"></ha-icon>Fire</button>
          </div>
          <div class="hint" id="hint"></div>
        </div>
      </ha-card>
    `;

    const $ = (id) => this.shadowRoot.getElementById(id);
    this._img = $('img');
    this._noFeed = $('no-feed');
    this._badge = $('badge');
    this._badgeText = $('badge-text');
    this._hint = $('hint');
    this._controlBtn = $('control');
    this._controlWide = $('control-wide');
    this._controlLabel = $('control-label');
    this._fireBtn = $('fire');
    this._noFeedText = $('no-feed-text');
    this._dpad = {
      aim_up: $('aim_up'),
      aim_down: $('aim_down'),
      aim_left: $('aim_left'),
      aim_right: $('aim_right'),
    };

    // Wire interactions.
    for (const key of Object.keys(this._dpad)) {
      this._dpad[key].addEventListener('click', () => this._press(this._ent && this._ent[key]));
    }
    this._fireBtn.addEventListener('click', () => this._press(this._ent && this._ent.fire));
    this._controlBtn.addEventListener('click', () => this._toggleControl());
    this._controlWide.addEventListener('click', () => this._toggleControl());

    this._built = true;
    this._builtFor = this.config.camera;
    this._startRefresh();
    this._refreshImage();
  }

  _update() {
    if (!this._built || !this._hass) return;
    this._ent = this._resolve();

    const cam = this._hass.states[this._ent.camera];
    const camUnavailable = !cam || cam.state === 'unavailable' || cam.state === 'unknown';
    const ctrl = this._ent.control;
    const controllable = !!ctrl;
    const isOn = ctrl && this._hass.states[ctrl] && this._hass.states[ctrl].state === 'on';

    // Controls are live only while under control (or always, for a plain feed
    // with no Control switch — though this card targets turrets/PTZ).
    const enabled = controllable ? isOn : true;
    for (const key of Object.keys(this._dpad)) {
      const has = !!(this._ent && this._ent[key]);
      this._dpad[key].disabled = !enabled || !has;
      this._dpad[key].style.display = has ? '' : 'none';
    }
    const hasFire = !!this._ent.fire;
    this._fireBtn.disabled = !enabled || !hasFire;
    this._fireBtn.style.display = hasFire ? '' : 'none';

    // Control buttons (round one in the pad centre + wide one in the action row).
    this._controlBtn.style.display = controllable ? '' : 'none';
    this._controlWide.style.display = controllable ? '' : 'none';
    this._controlBtn.classList.toggle('on', !!isOn);
    this._controlWide.classList.toggle('on', !!isOn);
    this._controlLabel.textContent = isOn ? 'Release Control' : 'Take Control';

    // Status badge + hint.
    if (camUnavailable) {
      this._badge.className = 'badge idle';
      this._badgeText.textContent = 'Offline';
      this._noFeedText.textContent = 'Camera unavailable';
    } else if (!controllable || isOn) {
      this._badge.className = 'badge live';
      this._badgeText.textContent = 'Live';
      this._noFeedText.textContent = 'No feed';
    } else {
      this._badge.className = 'badge idle';
      this._badgeText.textContent = 'Idle';
      this._noFeedText.textContent = 'Take control for a live feed';
    }

    if (controllable && !isOn) {
      this._hint.textContent = 'Aiming and firing are disabled until you take control.';
    } else if (controllable && isOn) {
      this._hint.textContent = 'Live — auto-aim is disabled while you hold control.';
    } else {
      this._hint.textContent = '';
    }

    this._refreshImage();
  }

  static getStubConfig() {
    return { camera: '', title: '' };
  }

  static getConfigElement() {
    return document.createElement('rust-turret-card-editor');
  }

  getCardSize() {
    return 7;
  }
}

class RustTurretCardEditor extends HTMLElement {
  setConfig(config) { this._config = config; this._render(); }
  set hass(hass) { this._hass = hass; this._render(); }

  _render() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement('ha-form');
      this._form.addEventListener('value-changed', (ev) => this._valueChanged(ev));
      this._form.computeLabel = (schema) => ({
        camera: 'Camera entity',
        title: 'Title',
        control_entity: 'Control switch (auto if blank)',
        fire: 'Fire button (auto if blank)',
        aim_up: 'Aim Up button (auto if blank)',
        aim_down: 'Aim Down button (auto if blank)',
        aim_left: 'Aim Left button (auto if blank)',
        aim_right: 'Aim Right button (auto if blank)',
      }[schema.name] || schema.name);
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.data = this._config;
    this._form.schema = [
      { name: 'camera', required: true, selector: { entity: { domain: 'camera' } } },
      { name: 'title', selector: { text: {} } },
      { name: 'control_entity', selector: { entity: { domain: 'switch' } } },
      { name: 'fire', selector: { entity: { domain: 'button' } } },
      { name: 'aim_up', selector: { entity: { domain: 'button' } } },
      { name: 'aim_down', selector: { entity: { domain: 'button' } } },
      { name: 'aim_left', selector: { entity: { domain: 'button' } } },
      { name: 'aim_right', selector: { entity: { domain: 'button' } } },
    ];
  }

  _valueChanged(ev) {
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: ev.detail.value }, bubbles: true, composed: true,
    }));
  }
}

if (!customElements.get('rust-turret-card')) {
  customElements.define('rust-turret-card', RustTurretCard);
}
if (!customElements.get('rust-turret-card-editor')) {
  customElements.define('rust-turret-card-editor', RustTurretCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === 'rust-turret-card')) {
  window.customCards.push({
    type: 'rust-turret-card',
    name: 'Rust Turret / Camera Control Card',
    description: 'Live camera feed with aim D-pad, fire button and control toggle for turrets/PTZ.',
    preview: false,
    documentationURL: 'https://github.com/DatDraggy/RustPlus-Assistant-Cards',
  });
}
