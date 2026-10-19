# ARC-1.5 — Exact-SHA Level 1 qualification certificate

**Step:** ARC-1.5 — Implement React casual-game adapter  
**Disposition:** PASS — game-scoped React casual lifecycle adapter and concrete React root bridge, not complete game implementations.  
**Qualification level:** Level 1

- **Qualified implementation SHA:** `b58a7477603bac9b28d7e9e1c8717c7a16f8f7a0`
- **Reconciliation base:** `9b91a0a096f71eeba1ca354a2b416f325c91f6e8`
- **PR:** [#751](https://github.com/abvhiael/420-integrated-v0.1/pull/751)
- **Branch:** `audit/arcade-1-5-react-casual-adapter`
- **Workflow:** `.github/workflows/arcade-1-5-level1.yml`
- **Run:** [39204882247](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39204882247)
- **Job:** `117905445128` — completed/success on the first Level 1 attempt.

## Qualified scope

- Approved React casual games only: Kush Crush and 420Buddy; all other canonical game runtimes reject the adapter.
- Immutable game/version/registration/guest-first checks, strict created/loading/ready/running/paused/disposed lifecycle and mount-once/dispose-once semantics.
- React 19 createRoot/render/unmount bridge with scoped component props, pause/resume and restore semantics.
- Defensive-copy per-game save envelope and schema/content version validation; mismatched game IDs, permissions and versions rejected.
- Async cancellation/generation checks, failed renderer cleanup, invalid transitions and malicious context rejection.
- Core adapter Node security/adversarial tests, React bridge test, retained ARC-1.1–ARC-1.3 frontend regressions, TypeScript check, app lint and Vite production build passed.
- No signing keys, Registry authority, wallet requirements, on-chain claims, server-verified scores, or playable game runtime introduced.

## Exact-SHA reconciliation and boundaries

The certificate itself is **evidence-only** and does not change or replace the qualified implementation SHA.

Current main advanced from the starting base through two unrelated Budtender purchase-complete manifest changes. Their changed paths are disjoint from the Arcade core/React adapter, app inputs, tests and configuration. Preserve ARC-1.5's exact-SHA Level 1 success. Check GitHub merge eligibility again immediately before merge.

**Level 2:** not due. **Level 3:** not due. No global suites manually dispatched.  
**Live/testnet:** registry registration, operator bindings and actual chain proofs remain external; real Kush Crush/420Buddy content and client/QA qualification remain subsequent local ARC steps. The launcher intentionally keeps all unimplemented games disabled.

**Next step:** consult the approved canonical ARC roadmap; do not infer a next title.
