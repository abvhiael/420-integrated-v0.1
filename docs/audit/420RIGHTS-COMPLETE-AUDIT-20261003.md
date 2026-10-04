# 420Rights complete repository audit — 2026-10-03

## Scope and baseline

Repository: `abvhiael/420-integrated-v0.1`  
Audit branch: `audit/420rights-complete-20261003`  
Baseline `main`: `1b9330871f7e9d0e79014955a61599baf70134fa`  
Original implementation: PR #23, “feat(420rights): add Genesis rights and licensing foundation”.

The canonical sources establish 420Rights as a Genesis protocol suite for subject provenance, declared rights, succession and licensing. It records protocol claims and permissions but does not adjudicate external legal ownership. Repository documentation classifies 420 Rights as a covered protocol, not a standalone public Genesis application. A dedicated standalone frontend/backend is therefore not required for canonical completeness; Wallet discovery, on-chain state, derived Indexer/Search surfaces and deployment/operation evidence are the relevant application surfaces.

## Canonical architecture

Seven-contract suite:
1. `RightsIds420.sol`
2. `RightsAuthorization420.sol`
3. `RightsPolicyRegistry420.sol`
4. `RightsAssetRegistry420.sol`
5. `RightsClaimRegistry420.sol`
6. `RightsLicenseRegistry420.sol`
7. `RightsRouter420.sol`

Canonical integrations:
- CapabilityRegistry420 — required scoped authorization dependency.
- GovernanceTimelock/SystemAccess — right-class policy authority.
- ProtocolRegistry — canonical service discovery; Rights router is Registry-resolved, not a fixed predeploy.
- 420Wallet/Smart Accounts — discovery/execution boundary; Rights does not receive wallet signing authority.
- 420Indexer/Search — non-authoritative projections/discovery.
- 420Market — may reference/list license IDs but cannot mutate Rights state.
- 420Identity — optional holder/profile reference.
- 420Vault and 420Pay — explicitly future license settlement integrations in the current Genesis config, not implemented Rights dependencies.
- 420Verify — technical provenance evidence only; never creates/transfers rights or licenses.
- Arbitration/external legal process — may handle disputes where explicitly integrated; Rights itself is not a court.

## File inventory and baseline defects

### Present and canonical
- all seven Rights Solidity sources;
- Genesis config and invariant set;
- canonical service ID `420/service/rights/v1`;
- Genesis dApp contract-map entry;
- Registry-resolved address-namespace entry for `rights-router`;
- architecture documentation and troubleshooting coverage;
- Wallet catalogue awareness;
- Search public Rights discovery;
- Indexer protocol catalogue and generic SQL Rights views;
- two retained Foundry Rights suites.

### Baseline gaps repaired by this audit branch
1. Indexer lifecycle reducer used obsolete synthetic event names (`RightRegistered`, `LicenseIssued`, `RightRevoked`, `LicenseExpired`) that the canonical contracts do not emit.
2. Indexer object-key extraction did not support Rights `subjectId`.
3. `ClaimSuperseded(oldRightId,...)` had no normalization to the original `rightId` lifecycle object.
4. No artifact-derived, fail-closed Rights descriptor manifest/binding implementation existed for Registry-resolved Rights contracts.
5. `RightsPolicyRegistry420` was absent from the shared Rights ABI classification.
6. No dedicated Rights exact-head audit workflow existed; generic Solidity PR shards skip ordinary audit branches.
7. Negative contract coverage omitted several important policy, evidence, scope/action, finite-license and unauthorized-transition cases.

### Release materialization added by RIGHTS-AUDIT-4
- deterministic Rights deployment order and constructor graph;
- governed metadata-commitment policy for all eight right classes, with live/final hashes intentionally left unset;
- canonical CapabilityRegistry candidate identity/status retained without promoting it to deployed/frozen authority;
- compiler artifact/runtime-template identities retained for the exact qualified repository implementation;
- local-EVM ProtocolRegistry publication, deprecation and recovery qualification for `420/service/rights/v1`;
- Indexer binding extended to require Registry-resolved addresses plus nonzero runtime code hashes;
- rollback/recovery procedure and explicit empty live-testnet evidence fields.

### Still absent / intentionally not fabricated
- live deployed Rights addresses/runtime EXTCODEHASH values;
- public-testnet deployment and ProtocolRegistry transaction receipts;
- live CapabilityRegistry dependency qualification;
- governed final Genesis metadata hashes for the eight right classes;
- live testnet receipts/blocks/reorg/finality evidence;
- final Rights operator/threat-model/Genesis acceptance closeout package.

## Smart-contract assessment

| Component | Assessment |
|---|---|
| RightsIds420 | COMPLETE for source-level canonical IDs/classes/actions |
| RightsAuthorization420 | COMPLETE for scoped CapabilityRegistry delegation; live dependency qualification remains deployment work |
| RightsPolicyRegistry420 | COMPLETE source behavior; exact Genesis policy metadata initialization remains release materialization work |
| RightsAssetRegistry420 | COMPLETE source behavior for registration/metadata authority |
| RightsClaimRegistry420 | COMPLETE source behavior for claim validation, replay rejection, supersession, succession and effective-time checks |
| RightsLicenseRegistry420 | COMPLETE source behavior for deterministic licenses, right-time bounds, revocation/renunciation and succession continuity |
| RightsRouter420 | COMPLETE source behavior for bounded effective-right/license reads |

No reentrancy/custody path exists in the Rights suite; it does not transfer native/ERC assets. No `delegatecall`, `selfdestruct` or `tx.origin` authority pattern is intended. External calls are bounded to protocol dependencies/read paths. Repository review identified no unresolved source-level critical fund-loss or arbitrary-call vulnerability. Deployment authority and live dependency safety remain unqualified until RIGHTS-AUDIT-4/5.

## Requirement matrix

| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| Seven-contract Rights suite | Genesis config / architecture | present | Foundry | architecture | COMPLETE | exact-head qualify |
| Eight canonical right classes | Genesis config / IDs | present | policy setup/negatives | architecture | COMPLETE | freeze release metadata commitments |
| Subject provenance/metadata authority | RIGHTS-INV-001 | present | lifecycle + scope/action negative | architecture | COMPLETE | live capability qualification |
| Claim subject/class/evidence validation | RIGHTS-INV-002 | present | added inactive-class/evidence negatives | architecture | COMPLETE | exact-head qualify |
| Exact semantic replay rejection | RIGHTS-INV-003 | present | hardening | architecture | COMPLETE | exact-head qualify |
| Explicit supersession/history | RIGHTS-INV-004 | present | hardening + Indexer lifecycle | architecture | COMPLETE | live/reorg qualification |
| Holder succession authority/evidence | RIGHTS-INV-005 | present | hardening + unauthorized negative | architecture | COMPLETE | live capability qualification |
| Capability expiry/revocation fail closed | RIGHTS-INV-006 | present | hardening | architecture | COMPLETE | live CapabilityRegistry qualification |
| Deterministic license identity/replay | RIGHTS-INV-007 | present | hardening | architecture | COMPLETE | exact-head qualify |
| License/right temporal bounds | RIGHTS-INV-008/009 | present | time edges + finite-right negative | architecture | COMPLETE | exact-head qualify |
| License continuity after succession | RIGHTS-INV-010/011 | present | hardening | architecture | COMPLETE | live scenario |
| Market cannot mutate Rights | RIGHTS-INV-012 | no mutation integration found | indirect boundary | architecture | COMPLETE | preserve boundary in release |
| Registry-resolved/no-fixed address model | address namespace | present | mechanical verifier | architecture/config | COMPLETE | materialize actual release addresses |
| Canonical service ID | ServiceIds420 | present | Wallet catalogue coverage | docs/catalog | COMPLETE | publish live Registry service |
| Wallet discovery/execution boundary | Wallet catalog/docs | catalogue present; no dedicated Rights client required by covered-protocol classification | catalogue tests retained | Wallet docs | COMPLETE | live discovery/handoff smoke test |
| Indexer canonical event descriptors | Indexer architecture | added by audit | descriptor drift tests | audit report | COMPLETE | bind deployed addresses at release |
| Indexer lifecycle | actual emitted events | repaired by audit | lifecycle regression | audit report | COMPLETE | live reorg/rebuild qualification |
| Search Rights discovery | Search architecture | present | existing Search tests | Search docs | COMPLETE | live Indexer/Search qualification |
| Dedicated standalone frontend/backend | documentation classification | not present | N/A | covered-protocol classification | NOT APPLICABLE | none |
| Deterministic deployment package | Genesis readiness | materialized repository release package | local deployment/binding suite | RIGHTS-AUDIT-4 evidence | COMPLETE | live deployment remains RIGHTS-AUDIT-5 |
| ProtocolRegistry publication evidence | integration model | canonical local-EVM publication/deprecation/recovery path materialized | deployment/binding suite | RIGHTS-AUDIT-4 evidence | COMPLETE at repository scope | retain live publication receipts in RIGHTS-AUDIT-5 |
| Exact runtime hashes/deployment identities | Genesis readiness | exact compiler artifact/runtime-template identities retained; live addresses/codehashes intentionally empty | artifact identity gate + local deployment binding | RIGHTS-AUDIT-4 evidence | COMPLETE at repository scope | retain live addresses/EXTCODEHASH in RIGHTS-AUDIT-5 |
| Production-equivalent testnet qualification | release readiness | no live evidence | absent | absent | BLOCKED | RIGHTS-AUDIT-5 |
| Operator/recovery/monitoring qualification | release readiness | incomplete | absent live | incomplete | PARTIAL | RIGHTS-AUDIT-6 |
| Genesis acceptance evidence | Genesis requirements | absent | absent | absent | MISSING | RIGHTS-AUDIT-6 after testnet |

## Security disposition

Verified/mitigated at repository level:
- default-deny scoped capability authorization;
- exact subject/right/action scopes;
- capability expiration/revocation;
- claim/license replay protection;
- deterministic license identity;
- finite validity boundaries;
- unauthorized supersession/transfer rejection;
- no token/native custody in the Rights suite;
- non-adjudication and non-authoritative Indexer/Search boundaries.

Accepted design risks:
- distinct competing claims may coexist by design;
- evidence hashes commit to external evidence but do not prove legal truth;
- governance controls right-class policy;
- live CapabilityRegistry correctness is a dependency.

Unresolved release risks:
- no live deployed dependency/address/EXTCODEHASH/Registry-publication receipt evidence;
- no production-equivalent testnet/reorg/finality qualification;
- final governed Genesis right-class metadata hashes are intentionally not frozen until the live release authority step.

## Documentation assessment

Verified:
- Rights/Verify architecture;
- canonical Genesis config/invariants;
- service ID and address namespace;
- troubleshooting entry;
- Wallet catalogue and ecosystem architecture;
- Search/Indexer authority boundaries.

Added by this audit:
- complete audit report;
- stable remediation roadmap;
- mechanical audit verifier;
- exact-head Rights workflow.

Still required:
- live deployment/Registry publication record tied to the public testnet release;
- operator/deployment guide tied to the live release;
- Rights-specific final threat-model/recovery/monitoring closeout;
- Genesis acceptance/testnet evidence.

## Readiness

- CODE COMPLETE: **YES** for the canonical repository-level Rights protocol implementation.
- BUILD COMPLETE: **YES** for the repository-qualified implementation.
- CONTRACT COMPLETE: **YES** at source scope; release deployment materialization remains separate.
- TEST COMPLETE: **NO** — repository tests can qualify source behavior, but live deployment/reorg/finality/testnet scenarios remain.
- DOCUMENTATION COMPLETE: **NO** — deployment/operator/threat-model/Genesis acceptance documents remain.
- INTEGRATION COMPLETE: **NO** — offline Indexer/Search/Wallet boundaries exist, but live Registry/address/codehash binding is absent.
- SECURITY QUALIFIED: **NO** — repository hardening is not production-equivalent deployment security qualification.
- TESTNET READY: **YES at repository-package scope** — deterministic release materialization is qualified; execution is blocked only on live public testnet/deployment identities.
- GENESIS READY: **NO** — blocked on RIGHTS-AUDIT-5 and RIGHTS-AUDIT-6.
- PRODUCTION READY: **NO** — blocked on testnet and final release/security closeout.

## Exact-head repository qualification

Qualified implementation SHA: `b3ea84e8a92524cfbf0f3512975efda73542b310`  
Dedicated workflow: `420Rights audit qualification`  
Passing run: `37177524144`  
Qualify job: `111363160613`  
Security job: `111363160767`

Results:
- Rights formatting: PASS;
- canonical Rights build: PASS;
- inventory/ABI/lifecycle/address-authority verifier: PASS;
- Foundry Rights suites: 12 passed, 0 failed, 0 skipped;
- forbidden primitive scan: PASS;
- 420Indexer build: PASS;
- Rights descriptor/lifecycle tests: 18 passed, 0 failed;
- hardening-profile Rights suite: PASS;
- targeted Slither high-severity gate: PASS, 0 high-severity findings; two low-impact timestamp findings.

The subsequent audit bookkeeping commit is documentation-only and does not modify the qualified implementation.

## Final determination

420Rights was not genuinely complete at the audited `main` baseline despite having a coherent contract suite and retained tests. The baseline had a concrete Indexer lifecycle mismatch and lacked a Rights-specific release descriptor/qualification path. The audit branch repairs those repository-level integration/test gaps without changing the canonical authority model.

The source-level protocol is now repository-qualified as code/contract complete on implementation SHA `b3ea84e8a92524cfbf0f3512975efda73542b310`, dedicated workflow run `37177524144` (qualify job `111363160613`, security job `111363160767`). The run passed formatting, canonical build, repository verifier, 12/12 Foundry Rights tests, forbidden-primitive scan, 420Indexer build, 18/18 Rights Indexer descriptor/lifecycle tests, hardening-profile tests and the targeted Slither high-severity gate with zero high-severity findings. Slither retained two low-impact timestamp findings consistent with the protocol's explicit validity-window semantics.

RIGHTS-AUDIT-4 subsequently completed repository release materialization on exact implementation SHA `94473daae80d4f5ede9f74414d65a5a8774d6237`, run `37178521825` (qualify job `111366155922`, security job `111366155820`). The step qualified the deterministic deployment/constructor graph, governed eight-class metadata commitment policy, compiler artifact identities, local ProtocolRegistry publication/deprecation/recovery, runtime-code-identity-aware Indexer binding, 15/15 Rights Foundry tests, 20 passing Indexer descriptor/lifecycle tests, hardening tests and a zero-high-severity Slither gate. Durable evidence is retained in `docs/audit/420RIGHTS-AUDIT-4-QUALIFICATION.md`.

Genesis/production completion must not be declared until live ProtocolRegistry publication, production-equivalent public-testnet qualification and final operational/security documentation are retained as exact evidence under RIGHTS-AUDIT-5/6.
