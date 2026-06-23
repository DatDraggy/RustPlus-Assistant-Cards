# Rust+ Assistant Cards

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
![Home Assistant Minimum Version](https://img.shields.io/badge/Home%20Assistant-2026.6.4%2B-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

A collection of custom Home Assistant Lovelace cards designed for the **Rust+ Assistant** integration. They surface your in-game Rust data — container contents, server status, the day/night cycle, and turret/camera control — as polished, game-themed cards.

## Cards

| Card | Type | Description |
| --- | --- | --- |
| 📦 **Storage Monitor** | `custom:rust-storage-card` | Container contents as a realistic inventory grid. Tools (Hammer, Spray Can, …) lead in their own Tool Cupboard slot row, with stack-splitting and a color-coded decay-upkeep bar. |
| 🖥️ **Server Status** | `custom:rust-server-card` | Banner with the server logo/name, a live player-count bar with queue badge, and map / size / seed / wipe-age stats. |
| 🕑 **In-Game Clock** | `custom:rust-clock-card` | A 24-hour day/night dial with the sunrise→sunset arc and a countdown to the next dawn/dusk. |
| 🎯 **Turret / Camera** | `custom:rust-turret-card` | Live CCTV/turret feed with an aim D-pad, fire button, and a Control toggle (auto-resolved from the camera's device). |

## Installation

All cards ship from a **single JavaScript file** (`rustplus-cards.js`), which imports every card — you only register one resource.

### Method 1: HACS (Recommended)

1. Open **HACS** in your Home Assistant instance.
2. Click the three dots in the top right corner and select **Custom repositories**.
3. Enter the URL of this repository and set the category to **Lovelace** (or **Plugin**), then click **Add**.
4. Click **Download** on **Rust+ Assistant Cards**.
5. Refresh the Home Assistant frontend.

### Method 2: Manual Installation

**Option A — single bundled file (recommended):**

1. Download `rustplus-cards.js` from the [latest release](../../releases/latest).
2. Copy it to your Home Assistant `www/` folder, e.g. `/config/www/rustplus-cards.js`.
3. Add the resource in **Settings** > **Dashboards** > **Resources**:
   - **URL**: `/local/rustplus-cards.js`
   - **Type**: `JavaScript Module`
4. Refresh the Home Assistant frontend.

**Option B — serve the repository directly (for development):**

1. Copy this repository into your `www/` folder, e.g. `/config/www/rustplus-cards/` (keep the `src/` folder intact).
2. Add the resource with **URL** `/local/rustplus-cards/src/rustplus-cards.js` and **Type** `JavaScript Module`.

> The release bundle is self-contained. The `src/rustplus-cards.js` entry instead uses ES module imports, so its sibling card files in `src/` must be served alongside it.

---

## Configuration

Add a card to your dashboard and configure it in YAML (each card also has a visual editor in the card picker).

### Storage Monitor

```yaml
type: custom:rust-storage-card
entity: sensor.rust_storage_monitor_friendly_name
title: "Tool Cupboard"      # Optional: custom title
columns: 6                  # Optional: number of columns (default: 6)
slots: 24                   # Optional: total inventory slots (default: 30)
show_tools: true            # Optional: show the dedicated tool-slot row (default: true)
show_empty: true            # Optional: show blank container slots (default: true)
show_upkeep: true           # Optional: show TC decay protection (default: true)
custom_stack_sizes:         # Optional: customize stack sizes for items
  Stones: 1000
  High Quality Metal: 500
  Low Grade Fuel: 500
```

**Default stack sizes** — Wood, Stones, Metal Fragments, Charcoal, Sulfur, Ore, Scrap: `1000`; High Quality Metal, Low Grade Fuel: `500`; Explosives: `100`.

### Server Status

```yaml
type: custom:rust-server-card
entity: sensor.rust_server
time_entity: sensor.rust_time            # Optional: adds an in-game clock line
daytime_entity: binary_sensor.rust_daytime  # Optional
show_banner: true
show_players: true
show_stats: true
```

### In-Game Clock

```yaml
type: custom:rust-clock-card
entity: sensor.rust_time
daytime_entity: binary_sensor.rust_daytime  # Optional
title: ""                                    # Optional
```

### Turret / Camera

```yaml
type: custom:rust-turret-card
camera: camera.rust_dragoncam   # The turret/CCTV camera; siblings (aim/fire buttons,
                                # Control switch) are auto-resolved from its device
title: ""                       # Optional
```

## Development

Card sources live in [`src/`](src/). [`src/rustplus-cards.js`](src/rustplus-cards.js) is the entry point that imports them all; add a new card by creating it under `src/` and adding one `import` line there.

### Building

The cards are bundled into a single self-contained file with [esbuild](https://esbuild.github.io/):

```bash
npm ci
npm run build      # -> dist/rustplus-cards.js
```

`dist/` is git-ignored — it's a build artifact, not committed.

### Releasing

Pushing a `v*` tag triggers the [Build & Release workflow](.github/workflows/release.yml), which builds the bundle and attaches `rustplus-cards.js` to a GitHub release. HACS picks it up from there.

```bash
git tag v1.2.3
git push origin v1.2.3
```

Every push and pull request also runs the build as a check, so a broken bundle is caught before release.
