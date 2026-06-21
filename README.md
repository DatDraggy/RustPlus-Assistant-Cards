# Rust Storage Monitor Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
![Home Assistant Minimum Version](https://img.shields.io/badge/Home%20Assistant-2026.6.4%2B-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

A custom Home Assistant Lovelace card designed specifically for the **Rust+ Assistant** integration. It displays the contents of your in-game Rust containers (chests, Tool Cupboards, etc.) as a realistic visual grid with items grouped into custom stack sizes, just like the in-game inventory.

## Preview Features

- 📦 **Visual Grid**: Renders inventory slots matching container sizes (e.g. 24 or 30 slots).
- 🥞 **Custom Stacks**: Splitting total item quantities into individual visual stacks (e.g., 2000 Stones is displayed as two stacks of 1000, 2000 High Quality Metal is displayed as four stacks of 500).
- 🎨 **Rust Theme**: High-quality styling matching the game's UI with hover scaling, custom material colors, and icons.
- 🛡️ **Decay Upkeep Status**: Color-coded upkeep bar at the bottom showing how long your base is protected.

## Installation

### Method 1: Add as a Custom Repository in HACS (Recommended)

1. Open **HACS** in your Home Assistant instance.
2. Click the three dots in the top right corner and select **Custom repositories**.
3. Enter the URL of this repository.
4. Set the category to **Lovelace** (or **Plugin**) and click **Add**.
5. Click **Download** on the **Rust Storage Monitor Card** card.
6. Refresh the Home Assistant frontend.

### Method 2: Manual Installation

1. Download [rustplus-storage-card.js](rustplus-storage-card.js) from the latest release.
2. Copy it to your Home Assistant's `www/` folder (e.g. `/config/www/rustplus-storage-card.js`).
3. Add the resource in **Settings** > **Dashboards** > **Resources**:
   - **URL**: `/local/rustplus-storage-card.js`
   - **Type**: `JavaScript Module`

---

## Configuration

Add the card to your dashboard and configure it in YAML:

```yaml
type: custom:rust-storage-card
entity: sensor.rust_storage_monitor_friendly_name
title: "Tool Cupboard"      # Optional: Custom title
columns: 6                 # Optional: Number of columns (default: 6)
slots: 24                  # Optional: Total inventory slots (default: 30)
show_empty: true           # Optional: Show blank container slots (default: true)
show_upkeep: true          # Optional: Show TC decay protection (default: true)
custom_stack_sizes:        # Optional: Customize stack sizes for items
  Stones: 1000
  High Quality Metal: 500
  Low Grade Fuel: 500
```

### Default Stack Sizes
- **Wood, Stones, Metal Fragments, Charcoal, Sulfur, Ore, Scrap**: 1000
- **High Quality Metal, Low Grade Fuel**: 500
- **Explosives**: 100
