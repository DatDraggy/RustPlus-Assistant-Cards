class RustStorageCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error('Please define a Rust+ Storage Monitor entity');
    }
    this.config = {
      title: 'Storage Monitor',
      columns: 6,
      slots: 30,
      show_empty: true,
      show_upkeep: true,
      custom_stack_sizes: {},
      ...config
    };
  }

  set hass(hass) {
    const entityId = this.config.entity;
    const stateObj = hass.states[entityId];

    if (!stateObj) {
      this.renderError(`Entity not found: ${entityId}`);
      return;
    }

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
      <div class="error">${message}</div>
    `;
  }

  // Get default stack size for an item name
  getStackSize(itemName) {
    // Check config first
    if (this.config.custom_stack_sizes && this.config.custom_stack_sizes[itemName] !== undefined) {
      return this.config.custom_stack_sizes[itemName];
    }
    
    // Normalize item name for match
    const name = itemName.toLowerCase();
    
    // Default stack sizes in Rust (customizable if different on modded servers)
    if (name.includes('stone')) return 1000;
    if (name.includes('wood')) return 1000;
    if (name.includes('metal fragment') || name.includes('metal frag')) return 1000;
    if (name.includes('high quality metal') || name.includes('hqm')) return 500; // custom/default stack sizes
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

  // Get styling / icons for items
  getItemDetails(itemName) {
    const name = itemName.toLowerCase();
    
    const details = {
      icon: 'mdi:cube-outline',
      color: '#9ca3af',
      bg: 'rgba(156, 163, 175, 0.1)',
      border: 'rgba(156, 163, 175, 0.3)',
      label: itemName
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
      
      const maxStack = this.getStackSize(key);
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

    // Determine total slots grid size
    const totalSlots = Math.max(this.config.slots, Math.ceil(stacks.length / this.config.columns) * this.config.columns);
    const columns = this.config.columns;
    
    // Fill empty slots if requested
    const gridItems = [...stacks];
    if (this.config.show_empty) {
      while (gridItems.length < totalSlots) {
        gridItems.push(null);
      }
    }

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
          background: #1e1f22;
          color: #f2f3f5;
          padding: 16px;
          border-radius: 12px;
          border: 1px solid #2b2d31;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
          font-family: 'Outfit', 'Inter', system-ui, sans-serif;
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
          cursor: pointer;
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

      <ha-card>
        <div class="header">
          <div class="title">
            <ha-icon icon="mdi:package-variant-closed"></ha-icon>
            <span>${title}</span>
          </div>
          <div class="status-badge">${stateObj.state} Slots</div>
        </div>

        <div class="grid">
          ${gridItems.map(item => {
            if (!item) {
              return `<div class="slot empty"></div>`;
            }
            return `
              <div class="slot" title="${item.details.label}: ${item.quantity}">
                <div class="slot-content" style="--item-bg: ${item.details.bg}; --item-border: ${item.details.border}; --item-color: ${item.details.color};">
                  <ha-icon icon="${item.details.icon}"></ha-icon>
                </div>
                <div class="quantity">${item.quantity}</div>
              </div>
            `;
          }).join('')}
        </div>

        ${showUpkeep ? `
          <div class="upkeep">
            <span class="upkeep-label">
              <ha-icon icon="mdi:shield-home-outline" style="--mdc-icon-size: 18px;"></ha-icon>
              Decay Upkeep
            </span>
            <span class="upkeep-val ${upkeepClass}">${upkeepDuration}</span>
          </div>
        ` : ''}
      </ha-card>
    `;
  }

  // Define default settings in UI editor config
  static getStubConfig() {
    return {
      entity: '',
      title: 'Tool Cupboard',
      columns: 6,
      slots: 24,
      show_empty: true,
      show_upkeep: true
    };
  }
}

customElements.define('rust-storage-card', RustStorageCard);

// Configure the card in Lovelace Card Picker
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'rust-storage-card',
  name: 'Rust Storage Monitor Card',
  description: 'Displays Rust container items in configurable stack sizes as grid slots.',
  preview: true
});
