# ARC-1.1 — Durable exact-SHA Level 1 qualification certificate

**Step:** ARC-1.1 — Initialize arcade-web application and build tooling

**Disposition:** PASS — React/TypeScript/Vite launcher bootstrap and scoped build tooling, NOT full game implementation or phase closeout.

- **Qualified implementation SHA:** `5674ee143574939c8f70457a58c022e1e422178d`
- **Reconciliation base:** `500ab26eab13dcadc5b546c21d98accc6dcb6fed`
- **Branch:** `audit/arcade-1-1-bootstrap`
- **PR:** [#747](https://github.com/abvhiael/420-integrated-v0.1/pull/747)
- **Workflow:** `.github/workflows/arcade-1-1-level1.yml`
- **Successful run:** [39195834421](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39195834421)
- **Successful job:** `117878294031` — completed/success
- **Evidence commit SHA:** separate document-only commit; do not treat as new tested implementation.
- **Prior superseded candidates:** intermediate failed runs `39195268885` (lint self-scan), `39195439118` (obsolete static-app test), and `39195679124` (SSR HTML entity assertion); all diagnosed, corrected with unchanged security constraints and superseded by the successful exact SHA. The successful `39195745032` (job `117878024029`) preceded removal of unused preview files; the final run above qualifies that cleanup.

## Verified qualification inventory

1. Pinned React 19.1.0, ReactDOM 19.1.0, TypeScript 5.8.3 and Vite 6.3.5 with npm v3 dependency lock; `npm ci` succeeded.
2. Syntactic/security lint and `tsc --noEmit` succeeded.
3. React SSR rendering validated all eleven game display names, safe text escaping, disabled/not-yet-playable state, accessible skip link, status announcements and screen-size/reduced-motion CSS.
4. Adversarial roster tests rejected foreign/replayed game identities, malformed slugs, unauthorized registration, wallet-gated core, and truncated roster.
5. Vite production build succeeded and emitted verified `dist/index.html` plus JavaScript bundles.
6. No new privileged protocol, signing/wallet grant, claims/competitive verified result or release permission was introduced.
7. Superseded dependency-free JS bootstrap sources removed from final tree.
8. ARC-0.1–ARC-0.7 evidence and frozen identity/module/platform inputs unchanged.

No Level 2 integration milestone or Level 3 phase closeout was triggered. No broad Solidity/Genesis/Integrated/Geth/Docs rerun manually dispatched. No production deployment or actual browser/device WCAG certification is claimed. Individual games, playable mechanics, offline/service-worker acceptance and testnet Gaming Protocol registration remain later canonical implementation/release gates.

**Merge preflight:** branch was zero behind current main and GitHub mergeable when inspected at the final implementation SHA. Verify merge eligibility anew before merging.
