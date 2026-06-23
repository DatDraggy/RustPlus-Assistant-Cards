// Rust+ Assistant Cards — single entry point.
//
// HACS (and a manual Lovelace resource) can only reference one JavaScript file,
// so this module pulls in every card. Loading just this file registers all of
// them with the card picker: storage, server, clock and turret.
//
// Reference it once as a `JavaScript Module` resource, e.g.
//   /hacsfiles/RustPlus-Assistant-Cards/rustplus-cards.js
//   /local/rustplus-cards/rustplus-cards.js   (manual install)
//
// The individual card sources live in ./src/ and are imported below.
import './rustplus-storage-card.js';
import './rustplus-server-card.js';
import './rustplus-clock-card.js';
import './rustplus-turret-card.js';
