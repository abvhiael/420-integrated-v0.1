# CMP-9.14 — Long-duration soak qualification evidence

**Operational status: NO-GO; actual CMP-9.14 sustained live soak NOT COMPLETE.**

- Implementation SHA: `35933b58087c532f3b7e245c4fd5136c817df203`, audit branch `cmp-9-14-soak-readiness-20261008`, stacked PR #586 based on prior CMP-9.13 evidence HEAD `508e68fb049d9dbf9f3b0f12fdaf80a48cdd86b5`.
- `main` inspected at outset: `ffc6a4028676907c266714b5c1ae8ba3af9a7137`.
- Files: `compute/ingestion/src/long-soak.mjs`, `compute/ingestion/test/long-soak.test.mjs`, `compute/ingestion/package.json`, `.github/workflows/cmp-9-14-soak.yml`, `docs/compute-market/CMP-9-14-LONG-DURATION-SOAK.md`.
- Required [CMP 9.14 Soak Readiness CI run 37863428515](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37863428515), exact head `35933b58087c532f3b7e245c4fd5136c817df203`. **SUCCESS**, job `113604358783` **SUCCESS**, all required steps including exact-SHA checkout and Node 22 retained ingestion tests passed. Offline readiness implementation Level 1 PASS; live soak remains NO-GO.
- Scope: structural evidence and adversarial tests for minimum duration, checkpoint/failure/recovery proof, indexed reorg/rebuild, source revocation/correction, funding conservation and independent review. The readiness gate does not run a real soak or authenticate user-supplied evidence references.
- Canonical prerequisites missing: live funded/testnet scientific CMP-9.13 demonstration, approved provider evidence, deployed application and Indexer, sustained observation samples, real restart/failover, actual reorg/rebuild and recovery with telemetry, security/independent review and finality.
- Actual live Level 2 operational campaign and accumulated Level 3 are deferred. No global Foundry/Genesis inventory was intentionally dispatched for S-9.14 by this task.
- Exit remains blocked and operational go/no-go remains NO-GO. Next canonical step: **CMP-9.15 — Close CMP-0 operational qualification**, after CMP-9.14 actual soak requirements are proven.

Evidence only; preserves implementation SHA.
