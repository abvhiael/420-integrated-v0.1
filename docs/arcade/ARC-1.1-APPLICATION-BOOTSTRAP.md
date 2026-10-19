# ARC-1.1 — Initialize arcade-web application and build tooling

Status: Bootstrap implementation candidate, not gameplay release.

This creates an actual buildable, browser-launchable responsive static shell under `apps/arcade-web/`, a manifest-sourced inert roster of eleven canonical games, Node 22 build tooling, syntax/security lint, unit and negative tests, and a dedicated exact-SHA Level 1 workflow. The only permitted catalog authority is `PRESENTATION_ONLY`; no games are enabled and no Registry/wallet/score/identity authority is introduced.

The implementation is deliberately dependency-free to make the scaffold independently reproducible without fetching packages. The ARC-0.2 accepted design calls for a React/TypeScript launcher; **the present bootstrap does not satisfy that runtime framework choice and is not release complete**. A React/TypeScript conversion, exact package lock and compiler/typecheck must be demonstrated before treating the launcher architecture as fulfilled. No claim is made that this is a completed production React frontend, browser/device accessibility audit, or offline service worker. These are substantive gaps, not network/testnet dependencies.

To run: `npm run check --prefix apps/arcade-web`; `npm run lint --prefix apps/arcade-web`; `npm run test --prefix apps/arcade-web`; `npm run build --prefix apps/arcade-web`. Serve `apps/arcade-web/dist` with any static web server for local preview. Build output is excluded from repository source.

Canonical source: `config/arcade-game-identities.json` and `config/arcade-0-7-scope-freeze.json`. Existing ARC-0.1–ARC-0.7 exact-SHA certificates are preserved. No unrelated repository-wide suite is required.
