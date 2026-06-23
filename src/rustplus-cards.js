// Rust+ Assistant Cards — single entry point.
//
// HACS (and a manual Lovelace resource) can only reference one JavaScript file,
// so this module pulls in every card. Loading just this file registers all of
// them with the card picker: storage, server, clock and turret.
//
// For HACS this is bundled (esbuild) into a single dist/rustplus-cards.js that
// is attached to the release and served at /hacsfiles/<repo>/rustplus-cards.js.
// For a raw checkout it works as-is, served e.g. at
//   /local/rustplus-cards/src/rustplus-cards.js
//
// The individual card sources live alongside this file and are imported below.
import './rustplus-storage-card.js';
import './rustplus-server-card.js';
import './rustplus-clock-card.js';
import './rustplus-turret-card.js';
