# 420Rights RIGHTS-AUDIT-4 qualification evidence

## Status

**RIGHTS-AUDIT-4 — Deterministic release materialization and Registry publication — COMPLETE**

Qualification level: **Level 1 — per-roadmap-step fast qualification**

Qualified implementation SHA: `94473daae80d4f5ede9f74414d65a5a8774d6237`  
Baseline/current `main`: `1b9330871f7e9d0e79014955a61599baf70134fa`  
Audit branch: `audit/420rights-complete-20261003`  
PR: #508  
Dedicated workflow: `420Rights audit qualification`  
Primary implementation qualification run: `37178521825` (run #18)  
Primary qualify job: `111366155922` — PASS  
Primary security job: `111366155820` — PASS  
Evidence/current branch HEAD: `f35cb1f7ba23c3aa8e76e53dc9678e9b79c0a157`  
Latest exact-head confirmation run: `37178941263` (run #21) — PASS  
Latest qualify job: `111367356810` — PASS  
Latest security job: `111367356945` — PASS

The implementation SHA is the authority for executable/configuration qualification. The three commits from `94473daae80d4f5ede9f74414d65a5a8774d6237` through `f35cb1f7ba23c3aa8e76e53dc9678e9b79c0a157` change only audit documentation, so they are evidence-only and do not supersede the executable implementation SHA. Run #21 nevertheless requalified the exact current head successfully.

## Requirements satisfied

- deterministic deployment order and constructor graph frozen for RightsAuthorization420, RightsPolicyRegistry420, RightsAssetRegistry420, RightsClaimRegistry420, RightsLicenseRegistry420 and RightsRouter420;
- CapabilityRegistry420 release dependency retained as the canonical candidate `0x0000000000000000000000000000000000000447`, explicitly `CANDIDATE_NOT_DEPLOYED_NOT_FROZEN`;
- RightsRouter420 remains `REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS`; no fixed predeploy or CREATE2 address was invented;
- governed metadata-commitment policy defined for all eight canonical right classes without inventing Genesis metadata hashes;
- release artifact paths and retained compiler artifact/runtime-template identities recorded;
- canonical `420/service/rights/v1` publication is exercised through ProtocolRegistry `publishRegisteredService` with nonzero manifest/interface/dependency commitments;
- Indexer binding now requires Registry-resolved addresses plus nonzero runtime code hashes for every Rights event registry;
- local-EVM smoke qualification covers subject registration, claim declaration, license grant/use, service deprecation fail-closed behavior and sequential-version recovery;
- rollback/recovery procedure is recorded;
- every live/testnet receipt/address/block/codehash field remains null/empty and is explicitly owned by RIGHTS-AUDIT-5.

## Implementation files

- `contracts/config/rights/rights-audit-4-release-materialization.json`
- `contracts/config/420rights-genesis.json`
- `contracts/test/RightsDeploymentBinding420.t.sol`
- `scripts/verify-rights-audit-4-release.py`
- `420-indexer/src/rights-descriptors.ts`
- `420-indexer/test/rights420-descriptors.test.ts`
- `.github/workflows/420rights-audit.yml`

No canonical Rights contract semantics were weakened or broadened for this step.

## Level 1 qualification results

Primary implementation qualification: run `37178521825` qualified exact executable/configuration SHA `94473daae80d4f5ede9f74414d65a5a8774d6237`.

Latest exact-head confirmation: run `37178941263` qualified current evidence HEAD `f35cb1f7ba23c3aa8e76e53dc9678e9b79c0a157`. The diff from the executable implementation SHA contains only:
- `docs/audit/420RIGHTS-AUDIT-4-QUALIFICATION.md`;
- `docs/audit/420RIGHTS-AUDIT-REMEDIATION-ROADMAP.md`;
- `docs/audit/420RIGHTS-COMPLETE-AUDIT-20261003.md`.

Run #21 results:
- qualify job `111367356810` — PASS;
- security job `111367356945` — PASS;
- canonical formatting/build/verifiers — PASS;
- RIGHTS-AUDIT-4 deployment and ProtocolRegistry binding qualification — PASS;
- complete Rights contract qualification suite — PASS;
- 420Indexer build and Rights descriptor/lifecycle qualification — PASS;
- hardening suite and targeted Slither high-severity gate — PASS.

Original run #18 details retained below for implementation evidence.

Qualify job `111366155922`:
- exact-head checkout: PASS;
- canonical Rights formatting: PASS;
- canonical Rights graph build: PASS;
- retained inventory/ABI/lifecycle/address-authority verifier: PASS;
- RIGHTS-AUDIT-4 release-materialization verifier: PASS;
- compiled artifact identity retention: PASS;
- RIGHTS-AUDIT-4 deployment/Registry binding suite: **3 passed, 0 failed, 0 skipped**;
- complete Rights Foundry suite: **15 passed, 0 failed, 0 skipped**;
- forbidden primitive scan: PASS;
- 420Indexer dependency install/build: PASS;
- Rights Indexer descriptor/lifecycle qualification: PASS, reported **20 passing tests**.

Security job `111366155820`:
- exact-head checkout: PASS;
- hardening-profile Rights suite: **15 passed, 0 failed, 0 skipped**;
- targeted Slither high-severity gate: PASS;
- high-severity Rights findings: **0**;
- two retained timestamp findings are low-impact validity-window semantics.

## Retained artifact identities

| Contract | Artifact SHA-256 | Compiler runtime-template SHA-256 |
|---|---|---|
| RightsAuthorization420 | `8df6c92f27f9f8d41f4169aba284e4f26819cd4a82f0e6c24b95558e717584d9` | `7fb4d316d143b08072f316b8f841c0fd7cd5fc7376e72bced6c8842639750955` |
| RightsPolicyRegistry420 | `ce33bb01d2fcba16f2ebcf64487f9e6005fbf787738423c6be803d7a8bb9c727` | `4184e644d90817b41ace93ed32d8a3d6dc775fd52515341c6d3c182db9e28abf` |
| RightsAssetRegistry420 | `4d0fb1980d98f57ccdffeac403ccbb4596f75900d49d7ea9a31e07b77261d555` | `bd5e948f213cc823abf67b7e72b3d7129b1ee29d8c0a57fa76b260959845a921` |
| RightsClaimRegistry420 | `be8f4fc522de7803a6f0bc9ad72d1f0e6b4b9e83d7fe80dd63037fcecd6567f7` | `1dbfc312833b04563bc36b390dc6f5286992db1edb2c3036e2fe50aa8cc23b7b` |
| RightsLicenseRegistry420 | `473f2bd4b5c62e7c5074275dacabcb33925d55e8fb30f5123f74b9d445a0f73d` | `f95d2f09ba553a73124857b5411a7f409da66364211958911241108459ea2d62` |
| RightsRouter420 | `91eee769e4673482f892ad6ff2028100448a09fb31a34fcd1af0d24f15ffcac2` | `b6c610821b2463c090566814bf76c68960b5ce29490de591a2f7bbfc80578c70` |

These are repository/compiler artifact identities from the exact qualified implementation. They are **not** fabricated live deployment EXTCODEHASH evidence. Live runtime identities remain a RIGHTS-AUDIT-5 requirement.

## Milestone / broader qualification

No separate Level 2 run is required for this ordinary step: the Level 1 workflow directly revalidated the complete Rights graph, real local ProtocolRegistry publication/recovery path, Indexer binding, retained Rights regression suite and targeted security gate. The next meaningful milestone is the production-equivalent public testnet work in RIGHTS-AUDIT-5.

Level 3 repository-wide closeout is intentionally deferred to the final app-phase closeout. Full repository Solidity inventory, Genesis/address-authority closeout, 420 Integrated/global qualification and global Docs reconciliation are not claimed by this Level 1 evidence.

## Limitations / blockers

There is no live Rights deployment evidence yet. Specifically absent by design:
- public-testnet chain/block identities;
- actual deployed Rights addresses and deployment transaction receipts;
- live ProtocolRegistry publication receipts;
- live runtime EXTCODEHASH values;
- governed final Genesis metadata hashes;
- live CapabilityRegistry authority qualification;
- reorg/finality/wrong-network production-equivalent evidence.

Those are not blockers to RIGHTS-AUDIT-4 because they are explicitly owned by the next canonical step.

## Completion

**RIGHTS-AUDIT-4 is COMPLETE at repository Level 1.**

Next canonical roadmap step: **RIGHTS-AUDIT-5 — Production-equivalent public testnet qualification**.
