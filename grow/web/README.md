# 420Grow web — GROW-04 UX

A static, read-only public directory consuming the versioned 420Location `GET /v1/places` API, not a protocol Registry or wallet authority.

## Local development and qualification

Node >=22. Run `npm run qualify` in `grow/web`. The build emits `dist/` (do not commit generated build output). Serve `grow/web` or `dist` via an HTTP server. Do not open `index.html` as a file URL.

The committed `runtime-config.js` sets `enabled:false`, so the interface deliberately reports unavailable rather than making up listings. To exercise real public data in a controlled test deployment, configure an approved HTTPS 420Location endpoint at `locationBaseUrl`, with the source's explicit CORS consent if cross-origin, then enable it. Prefer a same-origin reverse-proxy `/v1/places` for production. The endpoint must serve `application/json`, v1 envelope, and public records only. API URL credentials, opaque auth secrets and wallet keys must never be embedded in the browser config.

## UX and security boundaries

- Search, FARM/BUSINESS filtering, list and schematic pin map, place details, coarse-area listings, refresh, empty/loading/error states.
- A schematic map does **not** present provider tiles, route distance, or an accurate geographical projection. Only exact public pins appear; approximate records stay text-only. Public coordinates may link to OpenStreetMap.
- Source and Registry record references identify provenance, not independent Verify status or endorsement.
- Untrusted API strings use `textContent` and never `innerHTML`; no fixture listings, private coordinate escalation, or wallet transaction UI.
- Keyboard-operable buttons, skip link, labelled search/filter, live status, high contrast and mobile layout are provided. Manual assistive-tech and device/browser checks remain a release milestone.
- Publishing/editing/claiming is unsupported until upstream authorization has been specified and qualified. This is not a farm-management or commerce product.
- Source API is capped at 500 public items without cursor pagination; production scalable discovery belongs to GROW-05/GROW-07.
- Real live API, DNS, credentials, monitoring, TLS and deployed end-to-end tests belong to GROW-10.
