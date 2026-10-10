# GROW-V2-07 — Level 1 exact-SHA qualification

**Status: COMPLETE / Level 1.** Canonical step: Equipment adapters, monitoring and safe controls.

- **Qualified implementation SHA:** `d4bc7ca541bda9af942395ba066cd397d6812eea`.
- **Current main/base at closeout:** `ffc6a4028676907c266714b5c1ae8ba3af9a7137`, 100 ahead / 0 behind at audit.
- **PR:** #582, branch `audit/420grow-v2-01-product-decision-20261008`; open, draft, unmerged.
- **Implementation:** tenant-scoped equipment observation adapter; offline and unauthenticated fail-closed behavior; signed approval preconditions bound to DB-authoritative device Ed25519 keys; range, interlock, override and time-bound authorization checks; physical `Dispatch` unconditionally denies; private PostgreSQL equipment registry, atomic nonce reservation, row-level security and tenant/facility/zone foreign keys.
- **Changed files:** `grow/equipment/service.go`, `service_test.go`, `postgres.go`, `qualify.sql`, `grow/storage/migrations/0005_equipment.up.sql`, `scripts/grow-v2-migrate.py`, `.github/workflows/420grow-v2-fast.yml`, `docs/audit/420GROW-V2-07-EQUIPMENT-SAFETY.md`.
- **[420Grow V2 fast #37870067867](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37870067867)** — exact SHA, job `113625861105`, **SUCCESS**, no failed steps. V2-07 security Go tests, race/vet/gofmt, PostgreSQL schema/replay and tenant/nonce/FK checks and retained V2-02–06 affected checks qualified.
- **[Retained 420Grow fast #37870067647](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37870067647)** — exact SHA, job `113625860693`, **SUCCESS**, no failed steps. Original Grow app and dependent regressions qualified.
- **Remediation:** Earlier intermediate V2-07 run failed only its Go formatting gate. One-time formatting run 37869843018 succeeded and helper was removed before this qualified exact implementation SHA; required tests requalified.
- **Security negatives:** wrong tenant/principal/role, bad cryptographic signature/untrusted device key, expired/oversized control window, unsafe target, disabled interlock, offline state, manual override, database nonce replay and cross-tenant references. No physical actuation enabled or certified.
- **Milestones:** Level 2 previously passed at V2-05, next accumulation at V2-10; no new broad Level 2 rerun. Level 3 deferred to V2-15, with canonical full Solidity Foundry owned separately from Genesis address verification; live production-equivalent acceptance V2-16.
- **Outstanding external limitation:** real trusted device drivers, command journal and hardware interlock acceptance needed before any deployment can enable equipment actuation; no live device controls are qualified.
- **Next canonical step:** GROW-V2-08 — Nutrients, irrigation and environmental history.

This documentation-only closeout inherits the successfully tested implementation SHA.
