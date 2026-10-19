# ARC-1.2 — Durable exact-SHA Level 1 qualification certificate

**Step:** ARC-1.2 — Implement navigation, application shell and responsive interface

**Disposition:** PASS — scoped launcher navigation and responsive shell. Not complete playable games or full browser/device accessibility certification.

- **Qualified implementation SHA:** `0f8199c7d4d6433cc91b6218f0e23c5856d2bc0c`
- **Reconciliation base SHA:** `6d65bf62412db7a3259bd923065f7696d63e3400`
- **PR:** [#748](https://github.com/abvhiael/420-integrated-v0.1/pull/748)
- **Branch:** `audit/arcade-1-2-navigation-shell`
- **Owning workflow:** `.github/workflows/arcade-1-2-level1.yml`
- **Successful run:** [39196560310](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39196560310)
- **Successful job:** `117880498495` — completed/success.

## Scoped qualification

- Reproducible npm lockfile install, syntax/security lint and TypeScript compilation.
- Existing ARC-1.1 regression plus ARC-1.2 route and React-render tests, including eleven canonical disabled game cards.
- Allowlisted catalog, individual game, About and Accessibility routes; malformed/path-traversal/nonapproved routes fail closed.
- Responsive navigation, primary nav semantics, active route, single h1 per route, skip link, focus management and reduced-motion styling.
- Production Vite build and deployable output verification passed.
- Guest-first wallet-free display and no new Registry, score or economic authority.

**Failure history:** Run [39196514240](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39196514240), job `117880363390`, failed because changed status wording broke existing ARC-1.1 regression. Restored the original `No games installed` status wording rather than weakening the earlier test. The corrected full ARC-1.2 run above passed.

No Level 2 or Level 3 invoked, and no unrelated global suite manually dispatched. Earlier ARC-0.1–ARC-1.1 evidence remains intact; no frozen canonical manifests or SDK authority changed.

**Known limits:** No actual browser/device WCAG certification, offline game play, production deployment, registered games or real score verification claimed. Those are later application and/or testnet release gates.

**Evidence-only SHA:** the commit adding this certificate, not the qualified implementation SHA. Re-evaluate GitHub eligibility against current main before merge.
