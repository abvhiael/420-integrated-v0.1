# ARC-1.1 — Initialize arcade-web application and build tooling

ARC-1.1 creates the actual React 19/TypeScript 5/Vite 6 application at `apps/arcade-web/`, canonical eleven-game launcher preview, pinned direct dependency versions and npm lockfile, a deterministic production build and targeted lint/typecheck/React rendering/adversarial tests.

The UI shows all eleven approved game titles without claiming they are playable. No contract, new registry, wallet, identity, trusted scores, on-chain entitlements or production authorizations are introduced. The React UI and CSS are a bootstrap application, not final game or accessibility qualification.

Commands from repository root: `npm ci --prefix apps/arcade-web`, `npm run check --prefix apps/arcade-web`, `npm run lint --prefix apps/arcade-web`, `npm run typecheck --prefix apps/arcade-web`, `npm run test --prefix apps/arcade-web`, `npm run build --prefix apps/arcade-web`. Build produces `apps/arcade-web/dist/` for static hosting. Never commit `node_modules` or `dist`.

Canonical source remains `config/arcade-game-identities.json` and `config/arcade-0-7-scope-freeze.json`. Qualified ARC-0.1–0.7 implementation and evidence must remain unchanged. Browser/mobile device acceptance, offline gameplay/service workers, individual games and third-party art remain subsequent milestones; testnet-only proofs stay on the ARC-TN roadmap.

Only `.github/workflows/arcade-1-1-level1.yml` owns this step's checks. No unrelated global workflows were manually dispatched.
