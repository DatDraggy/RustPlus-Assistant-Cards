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
| 👥 **Team Squad** | `custom:rust-squad-card` | Team roster with Steam avatars, online/alive status, grid position and a leader crown (auto-detects the teammate sensors). |
| 💬 **Team Chat** | `custom:rust-chat-card` | Live team-chat log with colored names and a send box. |
| 📡 **Server Event Feed** | `custom:rust-event-feed-card` | Cargo / Patrol Heli / CH47 / Traveling Vendor with "active now" badges and estimated next-spawn countdowns. |
| 🛡️ **Raid Defense** | `custom:rust-raid-card` | Labeled smart-alarm board with severity tiers, a RAID banner and a fire timeline. Pair with Seismic Sensor wiring for explosive-tier alarms. |

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

> **Entity IDs are prefixed with a short version of your server's name.** A server shown
> as `[EU] TideRust |Solo/Duo...` produces `sensor.tiderust_time`, `camera.tiderust_map`,
> etc. The examples below use `tiderust` as that prefix — replace it with yours (or just
> use the visual editor's entity picker).

### Storage Monitor

```yaml
type: custom:rust-storage-card
entity: sensor.tiderust_tool_cupboard_wood
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

**Default stack sizes** — Wood, Stones, Metal Fragments, Charcoal, Sulfur, Ore, Scrap: `1000`; Low Grade Fuel: `500`; High Quality Metal: `100`; Explosives: `100`.

### Server Status

```yaml
type: custom:rust-server-card
entity: sensor.tiderust_server
time_entity: sensor.tiderust_time            # Optional: adds an in-game clock line
daytime_entity: binary_sensor.tiderust_daytime  # Optional
show_banner: true
show_players: true
show_stats: true
```

### In-Game Clock

```yaml
type: custom:rust-clock-card
entity: sensor.tiderust_time
daytime_entity: binary_sensor.tiderust_daytime  # Optional
title: ""                                    # Optional
```

### Turret / Camera

```yaml
type: custom:rust-turret-card
camera: camera.tiderust_dragoncam   # The turret/CCTV camera; siblings (aim/fire buttons,
                                # Control switch) are auto-resolved from its device
title: ""                       # Optional
```

### Team Squad

```yaml
type: custom:rust-squad-card
title: "Squad"      # Optional
columns: 1          # Optional: 1–4 (default 1)
# entities: []      # Optional: explicit teammate sensors (default: auto-detect)
```

### Team Chat

```yaml
type: custom:rust-chat-card
entity: sensor.tiderust_last_team_message
send: true          # Optional: show the send box (default true)
max: 50             # Optional: messages kept in the log (default 50)
title: "Team Chat"  # Optional
```

> Home Assistant keeps no chat history, so the log fills as messages arrive while the
> card is open. Sending uses the `rustplus_assistant.send_team_message` service.

### Server Event Feed

```yaml
type: custom:rust-event-feed-card
title: "Events"     # Optional
# entities: []      # Optional: explicit event binary_sensors (default: auto-detect)
```

> "Est. next" countdowns are a rolling-average heuristic and need ≥2 observed spawns
> (they show "learning…" until then).

### Raid Defense

```yaml
type: custom:rust-raid-card
title: "Raid Defense"
window: 10       # Minutes a fire stays "recent" / counts toward the raid banner
threshold: 2     # Recent fires that trigger the RAID IN PROGRESS banner
alarms:          # Plain entity ids, or objects with label / severity / icon
  - entity: event.tiderust_seismic_heavy_event
    label: "Seismic — heavy (Rocket / C4 / MLRS)"
    icon: mdi:rocket-launch
    severity: critical
  - entity: event.tiderust_seismic_medium_event
    label: "Seismic — medium (Satchel / Expl. ammo)"
    severity: high
  - entity: event.tiderust_wall_alarm_event
    severity: low
```

**Explosive-tier wiring (in-game):** a Seismic Sensor outputs power by explosive
tier — **3 rW** for MLRS/Rocket/C4, **2 rW** for Satchel/Explosive ammo/40mm/
Torpedo/Mortar, **1 rW** for grenades and the rest — as a single 3 s pulse. Chain
two Electrical Branches to split that into exclusive tier alarms:

```
Seismic Sensor → Branch A (limit 3) → branch-out → "heavy" Smart Alarm
                    └ passthrough → Branch B (limit 2) → branch-out → "medium" Smart Alarm
                                        └ passthrough → "light" Smart Alarm
```

A 3 rW hit powers only Branch A's out; 2 rW passes A and powers B's out; 1 rW
passes both and powers the light alarm — three alarms, one per explosive tier.

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
