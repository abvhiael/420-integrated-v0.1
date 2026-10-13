# R04 accumulated Level 2 — exact-SHA qualification

**Disposition: COMPLETE — repository app integration only.** INT-R04-01 through INT-R04-05 are resolved. No Level 3, complete R05 phase, deployed operation or production release is certified.

- Implementation SHA: `93655ca49f0e305f99cd0c13f53f88479b20b316`.
- Qualification branch: `qualification/highcountry-r04-level2-integration`; [draft PR #627](https://github.com/abvhiael/420-integrated-v0.1/pull/627), targeting the unmerged R04.14 audit branch.
- [Dedicated workflow run #38358551332](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38358551332): completed SUCCESS. All four jobs check out/assert that exact implementation SHA.
- Foundry 1.8.5, Solidity 0.8.24/Cancun, Node 22 and PostgreSQL 16. Runtime fixture explicitly disables dynamic test linking.

| Required job | GitHub evidence | Result |
|---|---|---|
| postgres-integration | [Job 115167032562](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38358551332/job/115167032562) | Actual SERIALIZABLE contention, replay, settlement/persistence; durable session/wallet nonce restart and least-privilege/RLS denial PASS |
| retained-app | [Job 115167032817](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38358551332/job/115167032817) | Build/bytecode-size PASS; 304 tests in 65 suites, zero failures/skips; canonical verifier PASS |
| economy-service | [Job 115167032865](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38358551332/job/115167032865) | 35 tests PASS, zero failures/skips |
| runtime-canonical | [Job 115167032918](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38358551332/job/115167032918) | Actual local Anvil + PostgreSQL + authenticated HTTP + canonical Identity/claimed mission + BUDS + owner-authorized escrow + operator transaction + finalized receipt + restarted-worker reconciliation after unlink PASS |

All required qualification steps were inspected and passed. Tests contain actual production contract/adapter composition as well as retained mocked unit coverage. A local CI issuer/catalogue/release hash is a fixture, not an independently approved deployed credential, production reward number or funded vault receipt.

## Resolved findings and security acceptance

- **INT-R04-01:** actual immutable harvest provenance, recorded-block confirmation/finality policy, optional shared entitlement and canonical Cup/scoped cross-game consumers. Forged facts/source block, wrong scope/profile/source, revocation, disputes and confirmation/submission/finalization/issuance replay fail.
- **INT-R04-02:** canonical root-pinned, one-time scoped emergency binding and risk-domain enforcement; manufacturing loss/refund, escrow cancellation, equipment recovery and actual lease/license/plant exit remain valid. Catalogue deactivation preserves existing reserved refunds/authorized losses while blocking new ingress.
- **INT-R04-03:** authenticated sessions/source envelopes, durable EOA/ERC1271 wallet consent/nonces/epochs, actual canonical completion and bounded issuance, code/hash/finality validation, durable operator submission/receipt reconciliation and PostgreSQL role isolation. Durable chain parties allow final settlement/refund after unlink or revocation; new submission still requires current authority. Nonzero source-epoch revocation and duplicate off-chain custody admission defects are corrected.
- **INT-R04-04:** completed manufacturing output is consumed before deterministic single-use equipment issuance; actual equipment/lifecycle/cultivation, shared-authority lease/license/plant, independently capability/policy/budget-gated Treasury/Identity and scoped shared Cup acceptance are retained.
- **INT-R04-05:** current implementation is independently identified from historical Level 1/retained-only qualification and this evidence-only descendant.

Retained actual council tests include restricted ingress, denied/revoked/vetoed release, delayed recovery and replay. Upgrade tests retain codehash, independent review, timelock/cancellation and provenance without an implicit immutable-consumer replacement. This is regression/security acceptance within the app suite, not an external production security approval.

## SHA, ancestry and phase continuity

All 14 R04 development PRs remain draft/open/unmerged. Each head was compared against `2dd0f75c994b1e475da65f607addf548a91ae5ff` (zero behind), followed by the two linear commits `ccc031f21578f9a88390b2050fee730402e28ea1` and this qualified implementation. Qualified R04.14 `3503761ef5746064abfd7c3c1ed3cf9a6f6fe2e5` and evidence parent `7cbd375079a6187aa03bea8b79c8d131762456de` remain ancestors. No audit PR was merged or retargeted.

Main observed at `81c21541acdc1b900b9a15c6f6b75ff2d7c2b5d9`; its drift from `bc0faa5dafecda3de0620a9581f9953b89cd95fb` concerns BnB/global workflow wiring, not changed High Country/imported shared implementation. Main is **not reconciled** by this certificate. Separate Level 3 must use one reconciled merge-candidate SHA, canonical Solidity-owned complete Foundry inventory (approximately four balanced shards), independent Genesis address/namespace/manifests without duplicate full Foundry, and required global/Docs/app/security/client/service/deployment checks.

R04 ends at R04.14. R05.1 remains the next canonical phase step; scoped R05-owned runtime dependencies implemented for this milestone do not certify or automatically advance the complete R05 phase. No R04.15 exists.

## Limitations and independent gates

Live deployed address/code/grant manifests; real officers/source/session/operator/catalogue credentials; production finality/quorum/reorg/network drills; funded Treasury/vault movement and independent approvals; TLS/secrets/backup/failover/monitoring; operational/security release approval; and R07.5 drain/migration/replacement/replay/rollback rehearsal remain OPEN. The separate full R05 provider/cloud-save/migration/Indexer/SDK/client/abuse/privacy engineering scope also remains with its canonical owners. These are not waived or silently represented as testnet-only coding gaps.

## Evidence identity

This record and the review/testnet-status reconciliation change documentation only. The executed implementation remains `93655ca49f0e305f99cd0c13f53f88479b20b316`; evidence HEAD is not falsely claimed as a rerun implementation. Machine-readable [certificate](R04-LEVEL2-EXACT-SHA.json) includes job/step dispositions, original canonical verifier input hashes and retained PR heads. [Integration review](../R04-LEVEL2-INTEGRATION-REVIEW.md) and [canonical integration contract](../R04-LEVEL2-CANONICAL-INTEGRATION.md) distinguish actual production adapters, mocked retained units, CI fixtures and deployment dependencies.

Historical retained-only run #38345072933 at `700d52f771fe15d5f58f88e7d92bc444e6bcee54` passed 293 Foundry/26 Node/PostgreSQL checks while the milestone remained NOT COMPLETE. It is superseded for corrected app implementation by this four-job exact-SHA result; historical Level 1 records remain unchanged.
