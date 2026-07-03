class RustStorageCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  // A Tool Cupboard has 5 dedicated tool slots (Hammer, Building Plan, Spray
  // Can, Hose Tool, Wire Tool) sitting above the upkeep resources in-game. We
  // mirror that by surfacing tools in their own row first.
  static TOOL_SLOTS = 5;

  setConfig(config) {
    if (!config.entity) {
      throw new Error('Please define a Rust+ Storage Monitor entity');
    }
    this.config = {
      // No default title: render() falls back to the entity's friendly_name,
      // then to 'Storage Monitor', when the user hasn't set one.
      columns: 6,
      slots: 30,
      show_empty: true,
      show_upkeep: true,
      show_tools: true,
      custom_stack_sizes: {},
      ...config
    };
  }

  escapeHtml(unsafe) {
    return String(unsafe)
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  }

  set hass(hass) {
    const entityId = this.config.entity;
    const stateObj = hass.states[entityId];

    if (!stateObj) {
      this.renderError(`Entity not found: ${entityId}`);
      return;
    }

    if (this._stateObj === stateObj) {
      return;
    }
    this._stateObj = stateObj;

    this._hass = hass;
    this.render(stateObj);
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

  // Get default stack size for an item name
  getStackSize(itemName) {
    // Check config first. Ignore non-positive/invalid values so a misconfigured
    // custom_stack_sizes entry can't produce a zero stack (which would cause an
    // infinite loop in the stack-splitting code below).
    if (this.config.custom_stack_sizes && this.config.custom_stack_sizes[itemName] !== undefined) {
      const custom = parseInt(this.config.custom_stack_sizes[itemName], 10);
      if (Number.isFinite(custom) && custom > 0) {
        return custom;
      }
    }
    
    // Normalize item name for match
    const name = itemName.toLowerCase();
    
    // Default stack sizes in Rust (customizable if different on modded servers)
    if (name.includes('stone')) return 1000;
    if (name.includes('wood')) return 1000;
    if (name.includes('metal fragment') || name.includes('metal frag')) return 1000;
    if (name.includes('high quality metal') || name.includes('hqm')) return 100; // vanilla HQM stacks to 100
    if (name.includes('low grade fuel') || name.includes('lgf')) return 500;
    if (name.includes('charcoal')) return 1000;
    if (name.includes('sulfur ore')) return 1000;
    if (name.includes('metal ore')) return 1000;
    if (name.includes('sulfur')) return 1000;
    if (name.includes('gunpowder')) return 1000;
    if (name.includes('scrap')) return 1000;
    if (name.includes('explosive')) return 100;
    
    return 1000; // default fallback
  }

  // Recognise the building tools that live in the Tool Cupboard's dedicated
  // tool slots. Returns styling (with isTool: true) or null for non-tools.
  getToolDetails(itemName) {
    const name = itemName.toLowerCase();
    const make = (icon, color) => ({
      icon,
      color,
      bg: 'rgba(96, 165, 250, 0.12)',
      border: 'rgba(96, 165, 250, 0.35)',
      label: itemName,
      isTool: true
    });

    if (name.includes('hammer')) return make('mdi:hammer', '#f59e0b');
    if (name.includes('building plan') || name.includes('planner')) return make('mdi:floor-plan', '#60a5fa');
    if (name.includes('spray can') || name.includes('spraycan') || name.includes('building skin')) return make('mdi:spray', '#34d399');
    if (name.includes('hose tool') || name === 'hose') return make('mdi:water', '#38bdf8');
    if (name.includes('wire tool') || name.includes('electric tool')) return make('mdi:flash', '#fbbf24');
    // "pipe tool" only (not the "Metal Pipe" component, which isn't a TC tool).
    if (name.includes('pipe tool')) return make('mdi:pipe-wrench', '#cbd5e1');
    return null;
  }

  // Get styling / icons for items
  getItemDetails(itemName) {
    const name = itemName.toLowerCase();

    const tool = this.getToolDetails(itemName);
    if (tool) return tool;

    const details = {
      icon: 'mdi:cube-outline',
      color: '#9ca3af',
      bg: 'rgba(156, 163, 175, 0.1)',
      border: 'rgba(156, 163, 175, 0.3)',
      label: itemName,
      isTool: false
    };

    if (name.includes('wood')) {
      details.icon = 'mdi:forest';
      details.color = '#a16207';
      details.bg = 'rgba(161, 98, 7, 0.15)';
      details.border = 'rgba(161, 98, 7, 0.4)';
    } else if (name.includes('stone')) {
      details.icon = 'mdi:rhombus-split';
      details.color = '#78716c';
      details.bg = 'rgba(120, 113, 108, 0.15)';
      details.border = 'rgba(120, 113, 108, 0.4)';
    } else if (name.includes('high quality metal') || name.includes('hqm')) {
      details.icon = 'mdi:gold';
      details.color = '#eab308';
      details.bg = 'rgba(234, 179, 8, 0.15)';
      details.border = 'rgba(234, 179, 8, 0.4)';
    } else if (name.includes('metal fragment') || name.includes('metal frag')) {
      details.icon = 'mdi:anvil';
      details.color = '#c2410c';
      details.bg = 'rgba(194, 65, 12, 0.15)';
      details.border = 'rgba(194, 65, 12, 0.4)';
    } else if (name.includes('low grade fuel') || name.includes('lgf')) {
      details.icon = 'mdi:fire';
      details.color = '#dc2626';
      details.bg = 'rgba(220, 38, 38, 0.15)';
      details.border = 'rgba(220, 38, 38, 0.4)';
    } else if (name.includes('sulfur ore')) {
      details.icon = 'mdi:image-filter-hdr';
      details.color = '#ca8a04';
      details.bg = 'rgba(202, 138, 4, 0.15)';
      details.border = 'rgba(202, 138, 4, 0.4)';
    } else if (name.includes('metal ore')) {
      details.icon = 'mdi:image-filter-hdr';
      details.color = '#b45309';
      details.bg = 'rgba(180, 83, 9, 0.15)';
      details.border = 'rgba(180, 83, 9, 0.4)';
    } else if (name.includes('sulfur')) {
      details.icon = 'mdi:flask-round-bottom';
      details.color = '#facc15';
      details.bg = 'rgba(250, 204, 21, 0.15)';
      details.border = 'rgba(250, 204, 21, 0.4)';
    } else if (name.includes('charcoal')) {
      details.icon = 'mdi:opacity';
      details.color = '#1f2937';
      details.bg = 'rgba(31, 41, 55, 0.3)';
      details.border = 'rgba(31, 41, 55, 0.6)';
    } else if (name.includes('scrap')) {
      details.icon = 'mdi:cog';
      details.color = '#b45309';
      details.bg = 'rgba(180, 83, 9, 0.15)';
      details.border = 'rgba(180, 83, 9, 0.4)';
    } else if (name.includes('gunpowder')) {
      details.icon = 'mdi:grain';
      details.color = '#4b5563';
      details.bg = 'rgba(75, 85, 99, 0.15)';
      details.border = 'rgba(75, 85, 99, 0.4)';
    } else if (name.includes('explosive')) {
      details.icon = 'mdi:bomb';
      details.color = '#ef4444';
      details.bg = 'rgba(239, 68, 68, 0.15)';
      details.border = 'rgba(239, 68, 68, 0.4)';
    }

    return details;
  }

  render(stateObj) {
    const title = this.config.title || stateObj.attributes.friendly_name || 'Storage Monitor';
    const attributes = stateObj.attributes || {};
    
    // Parse items and create stacks
    const stacks = [];
    
    for (const [key, value] of Object.entries(attributes)) {
      // Exclude non-item attributes
      if (key === 'friendly_name' || key === 'icon' || key === 'templates' || key === 'Upkeep Duration' || key === 'upkeep_duration' || key === 'assumed_state' || key === 'restored') {
        continue;
      }
      
      const quantity = parseInt(value, 10);
      if (isNaN(quantity) || quantity <= 0) continue;
      
      const maxStack = Math.max(1, this.getStackSize(key));
      let remaining = quantity;
      
      while (remaining > 0) {
        const stackQty = Math.min(remaining, maxStack);
        stacks.push({
          name: key,
          quantity: stackQty,
          details: this.getItemDetails(key)
        });
        remaining -= stackQty;
      }
    }

    // Split tools out so they lead, mirroring the Tool Cupboard's tool slots.
    // With show_tools off (e.g. a plain box), tools stay in the main grid —
    // otherwise a stored hammer would silently vanish from the card.
    const splitTools = this.config.show_tools;
    const toolStacks = splitTools ? stacks.filter((s) => s.details.isTool) : [];
    const resourceStacks = splitTools ? stacks.filter((s) => !s.details.isTool) : stacks;

    // Render the tools row only when actual tools are present, so a box (no TC
    // tools) doesn't grow an empty Tools section; pad to the 5 dedicated slots.
    const showTools = splitTools && toolStacks.length > 0;
    const toolSlotCount = Math.max(RustStorageCard.TOOL_SLOTS, toolStacks.length);
    const toolItems = [...toolStacks];
    if (showTools && this.config.show_empty) {
      while (toolItems.length < toolSlotCount) {
        toolItems.push(null);
      }
    }

    // Determine total slots grid size for the resource grid.
    const totalSlots = Math.max(this.config.slots, Math.ceil(resourceStacks.length / this.config.columns) * this.config.columns);
    const columns = this.config.columns;

    // Fill empty slots if requested
    const gridItems = [...resourceStacks];
    if (this.config.show_empty) {
      while (gridItems.length < totalSlots) {
        gridItems.push(null);
      }
    }

    // One slot's worth of markup, shared by the tools row and resource grid.
    const renderSlot = (item, extraClass = '') => {
      if (!item) {
        return `<div class="slot empty ${extraClass}" role="listitem" aria-label="Empty slot"></div>`;
      }
      const escapedLabel = this.escapeHtml(item.details.label);
      const escapedQuantity = this.escapeHtml(item.quantity);
      return `
        <div class="slot ${extraClass}" role="listitem" aria-label="${escapedLabel}: ${escapedQuantity}" title="${escapedLabel}: ${escapedQuantity}">
          <div class="slot-content" style="--item-bg: ${item.details.bg}; --item-border: ${item.details.border}; --item-color: ${item.details.color};">
            <ha-icon icon="${item.details.icon}"></ha-icon>
          </div>
          <div class="quantity">${escapedQuantity}</div>
        </div>
      `;
    };

    // Check for upkeep duration attribute
    const upkeepDuration = attributes['Upkeep Duration'] || attributes['upkeep_duration'];
    const showUpkeep = this.config.show_upkeep && upkeepDuration;

    // Upkeep styling based on time
    let upkeepClass = 'upkeep-ok';
    if (upkeepDuration) {
      const upkeepStr = String(upkeepDuration).toLowerCase();
      if (upkeepStr.includes('hour') && !upkeepStr.includes('day')) {
        upkeepClass = 'upkeep-warning';
      }
      if (upkeepStr.includes('minute') && !upkeepStr.includes('hour') && !upkeepStr.includes('day')) {
        upkeepClass = 'upkeep-critical';
      }
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        
        ha-card {
          background: var(--card-background-color, #1e1f22);
          color: var(--primary-text-color, #f2f3f5);
          padding: 16px;
          border-radius: 12px;
          border: 1px solid var(--divider-color, #2b2d31);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
          font-family: var(--paper-font-body1_-_font-family, 'Outfit', 'Inter', system-ui, sans-serif);
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 12px;
        }

        .title {
          font-size: 1.1rem;
          font-weight: 600;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .title ha-icon {
          color: #cd5228;
        }

        .status-badge {
          font-size: 0.75rem;
          padding: 4px 8px;
          border-radius: 4px;
          background: rgba(205, 82, 40, 0.15);
          color: #ff6b3d;
          border: 1px solid rgba(205, 82, 40, 0.3);
          font-weight: bold;
          text-transform: uppercase;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(${columns}, 1fr);
          gap: 8px;
          background: #151618;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #111214;
        }

        .tools-grid {
          grid-template-columns: repeat(${RustStorageCard.TOOL_SLOTS}, 1fr);
          margin-bottom: 10px;
        }

        .section-label {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 6px;
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          color: #9ca3af;
        }

        .section-label ha-icon {
          color: #cd5228;
        }

        .slot.tool {
          background: #20232b;
          border-color: #2c3340;
        }

        .slot.tool:hover {
          border-color: #60a5fa;
          box-shadow: 0 4px 12px rgba(96, 165, 250, 0.2);
        }

        .slot {
          aspect-ratio: 1;
          background: #232428;
          border: 1px solid #2e3035;
          border-radius: 6px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: default;
        }

        .slot:hover {
          background: #2d2f35;
          border-color: #cd5228;
          transform: scale(1.05);
          z-index: 10;
          box-shadow: 0 4px 12px rgba(205, 82, 40, 0.2);
        }

        .slot.empty {
          background: #18191b;
          border: 1px dashed #232428;
          cursor: default;
        }

        .slot.empty:hover {
          transform: none;
          border-color: #232428;
          box-shadow: none;
        }

        .slot-content {
          width: 80%;
          height: 80%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          background: var(--item-bg);
          border: 1px solid var(--item-border);
        }

        .slot ha-icon {
          --mdc-icon-size: 28px;
          color: var(--item-color);
        }

        .quantity {
          position: absolute;
          bottom: 4px;
          right: 6px;
          font-size: 0.75rem;
          font-weight: 700;
          color: #ffffff;
          text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.9), -1px -1px 2px rgba(0, 0, 0, 0.9);
          pointer-events: none;
        }

        .upkeep {
          margin-top: 14px;
          padding: 10px 12px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.85rem;
        }

        .upkeep-label {
          color: #9ca3af;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .upkeep-val {
          font-weight: 600;
        }

        .upkeep-ok {
          color: #10b981;
        }
        
        .upkeep-warning {
          color: #f59e0b;
        }

        .upkeep-critical {
          color: #ef4444;
          animation: pulse 1.5s infinite alternate;
        }

        @keyframes pulse {
          0% { opacity: 0.6; }
          100% { opacity: 1; }
        }
      </style>

      <ha-card role="region" aria-label="${this.escapeHtml(title)} Inventory">
        <div class="header">
          <div class="title" role="heading" aria-level="2">
            <ha-icon icon="mdi:package-variant-closed"></ha-icon>
            <span>${this.escapeHtml(title)}</span>
          </div>
          <div class="status-badge" aria-label="${this.escapeHtml(stateObj.state)} Total Slots">${this.escapeHtml(stateObj.state)} Slots</div>
        </div>

        ${showTools ? `
          <div class="section-label">
            <ha-icon icon="mdi:tools" style="--mdc-icon-size: 16px;"></ha-icon>
            Tools
          </div>
          <div class="grid tools-grid" role="list" aria-label="Tool Slots">
            ${toolItems.map((item) => renderSlot(item, 'tool')).join('')}
          </div>
        ` : ''}

        ${showTools ? `<div class="section-label">
            <ha-icon icon="mdi:cube-outline" style="--mdc-icon-size: 16px;"></ha-icon>
            Resources
          </div>` : ''}
        <div class="grid" role="list" aria-label="Inventory Slots">
          ${gridItems.map((item) => renderSlot(item)).join('')}
        </div>

        ${showUpkeep ? `
          <div class="upkeep" role="status" aria-label="Decay Upkeep: ${this.escapeHtml(upkeepDuration)}">
            <span class="upkeep-label">
              <ha-icon icon="mdi:shield-home-outline" style="--mdc-icon-size: 18px;"></ha-icon>
              Decay Upkeep
            </span>
            <span class="upkeep-val ${upkeepClass}">${this.escapeHtml(upkeepDuration)}</span>
          </div>
        ` : ''}
      </ha-card>
    `;
  }

  // Define default settings in UI editor config
  static getStubConfig() {
    return {
      entity: '',
      title: '',
      columns: 6,
      slots: 30,
      show_tools: true,
      show_empty: true,
      show_upkeep: true
    };
  }

  // Provide a visual (GUI) editor in the Lovelace card picker.
  static getConfigElement() {
    return document.createElement('rust-storage-card-editor');
  }

  getCardSize() {
    return Math.ceil((this.config?.slots || 30) / (this.config?.columns || 6)) + 1;
  }
}

// Visual editor for the card, built on Home Assistant's <ha-form>. Advanced
// options (custom_stack_sizes) remain YAML-only.
class RustStorageCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _render() {
    if (!this._hass || !this._config) {
      return;
    }
    if (!this._form) {
      this._form = document.createElement('ha-form');
      this._form.addEventListener('value-changed', (ev) => this._valueChanged(ev));
      this._form.computeLabel = (schema) => {
        const labels = {
          entity: 'Storage Monitor entity',
          title: 'Title (blank = use entity name)',
          columns: 'Columns',
          slots: 'Total slots',
          show_tools: 'Show tool slots (Hammer, Spray Can, …)',
          show_empty: 'Show empty slots',
          show_upkeep: 'Show decay upkeep'
        };
        return labels[schema.name] || schema.name;
      };
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.data = this._config;
    this._form.schema = [
      { name: 'entity', required: true, selector: { entity: { domain: 'sensor' } } },
      { name: 'title', selector: { text: {} } },
      { name: 'columns', selector: { number: { min: 1, max: 12, mode: 'box' } } },
      { name: 'slots', selector: { number: { min: 1, max: 120, mode: 'box' } } },
      { name: 'show_tools', selector: { boolean: {} } },
      { name: 'show_empty', selector: { boolean: {} } },
      { name: 'show_upkeep', selector: { boolean: {} } }
    ];
  }

  _valueChanged(ev) {
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: ev.detail.value },
      bubbles: true,
      composed: true
    }));
  }
}

// Guard define() so a double-load of this module doesn't throw.
if (!customElements.get('rust-storage-card')) {
  customElements.define('rust-storage-card', RustStorageCard);
}
if (!customElements.get('rust-storage-card-editor')) {
  customElements.define('rust-storage-card-editor', RustStorageCardEditor);
}

// Configure the card in Lovelace Card Picker
window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === 'rust-storage-card')) {
  window.customCards.push({
    type: 'rust-storage-card',
    name: 'Rust Storage Monitor Card',
    description: 'Displays Rust container items in configurable stack sizes as grid slots.',
    preview: true,
    documentationURL: 'https://github.com/DatDraggy/RustPlus-Assistant-Cards'
  });
}
