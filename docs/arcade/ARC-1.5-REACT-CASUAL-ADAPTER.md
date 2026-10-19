# ARC-1.5 — React casual-game adapter

**Scope:** Approved React casual games only: Kush Crush (`react-puzzle`) and 420Buddy (`react-simulation`). Source truth remains the frozen eleven-game manifest; no other game type or registration status can be mounted by this adapter.

`packages/arcade-core/src/react-casual.mjs` provides a real host lifecycle owner with `mount(container,context)`, `pause()`, `resume()`, `serialize()`, `restore(save)` and `unmount()`. It enforces the canonical created/loading/ready/running/paused/disposed state graph, immutable exact game/ruleset/content/save versions, game and save scoping, no signing credentials or Registry authority, and abort/token protection against late asynchronous mounts. Save copying avoids cross-game mutation and an invalid save fails closed.

`apps/arcade-web/src/casualAdapter.tsx` is the actual React 19 `createRoot` renderer bridge, which renders the game-owned React component within the provided container, updates pause/restore props, and unmounts the React root. This is an **adapter**, not a completed Kush Crush board, Buddy simulation, or a newly enabled launcher. All eleven launcher buttons remain closed until qualified real game bundles arrive. An optional protocol bridge, on-chain rewards, server-verified results, and live network registrations are not part of ARC-1.5.

Level 1 includes core lifecycle adversarial tests, React bridge verification, retained frontend regression, typecheck, security lint and production Vite build. No global Level 3 execution is justified for this scoped step.
