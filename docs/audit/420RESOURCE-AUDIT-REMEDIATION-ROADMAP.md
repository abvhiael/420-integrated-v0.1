# 420ResourceProtocol audit remediation roadmap

Status: **ACTIVE**  
Branch: `audit/resource-protocol-remediation-20261002`  
PR: #498

Numbering is durable. Completed steps are not renumbered.

## RESOURCE-AUDIT-1 — canonical definition and repository baseline

Status: **COMPLETE**

- establish current main, branch and PR;
- freeze authoritative architecture/config/doc set;
- inventory four canonical Resource service classes and Storage subprotocol;
- confirm registry-resolved/no-fixed-predeploy address policy.

## RESOURCE-AUDIT-2 — core contract consistency remediation

Status: **COMPLETE**

Qualification evidence: implementation SHA `28df5fae8a54b8959c3afabe82f5c61ce6b2a071`; 420ResourceProtocol Audit Qualification run #15 / `37134673149`; `resource-contract-core` job `111236665760` PASS.

- enforce governance service unit ceiling on offers;
- enforce service unit and duration ceilings on sessions;
- implement declared scoped node metadata update path;
- make Resource session cancellation reachable;
- require nonzero, strictly advancing cumulative receipts;
- wire exact node-scoped receipt delegation;
- add mutation/lifecycle events needed for deterministic derived reconstruction.

Exit: dedicated Resource core build/tests pass on exact substantive head.

## RESOURCE-AUDIT-3 — adversarial and lifecycle test expansion

Status: **COMPLETE**

Qualification evidence: implementation SHA `28df5fae8a54b8959c3afabe82f5c61ce6b2a071`; run #15 / `37134673149`; `resource-contract-core` job `111236665760` PASS and `resource-security` job `111236665730` PASS.

Required retained coverage:

- provider stake/default-deny;
- service-class isolation;
- offer/session/receipt replay and caps;
- session expiry;
- settlement scope/max spend;
- policy max-units and max-duration bypass attempts;
- node update authorization and ACTIVE-state mutation rejection;
- receipt delegate default deny and exact-scope grant;
- zero/non-advancing receipt rejection;
- consumer-only cancellation.

Exit: ResourceGenesis420 suite passes under CI and hardening profiles on exact head.

## RESOURCE-AUDIT-4 — Storage protocol retained qualification

Status: **COMPLETE**

Qualification evidence: implementation SHA `28df5fae8a54b8959c3afabe82f5c61ce6b2a071`; run #15 / `37134673149`; `resource-storage` job `111236665605` PASS.

Run exact-head:

- StorageCapacityRegistry420;
- StorageProofProtocol420;
- StorageAgreementRegistry420;
- StorageObjectManifestRegistry420;
- StorageSettlementRegistry420.

Exit: all targeted Store/proof/manifest/settlement suites pass.

## RESOURCE-AUDIT-5 — runtime and SDK qualification

Status: **COMPLETE**

Qualification evidence: implementation SHA `28df5fae8a54b8959c3afabe82f5c61ce6b2a071`; run #15 / `37134673149`; `resource-runtime-sdk` job `111236665713` PASS.

Run:

- `go test ./execution/storage/...`
- `go test ./sdk/storage420/...`

Retain exact run/job IDs and final head.

## RESOURCE-AUDIT-6 — static/security qualification

Status: **COMPLETE**

Qualification evidence: implementation SHA `28df5fae8a54b8959c3afabe82f5c61ce6b2a071`; run #15 / `37134673149`; `resource-security` job `111236665730` PASS.

- forbidden primitive scan for `delegatecall`, `selfdestruct`, `tx.origin`;
- Resource core hardening-profile tests;
- targeted Slither;
- fail on high-severity Resource-source finding.

## RESOURCE-AUDIT-7 — documentation/config reconciliation

Status: **COMPLETE**

Qualification level: **Level 1 — app-scoped documentation/config reconciliation**

Implementation SHA: `17c440e3c0033a68440cb896575c9f9753abe56e`  
Durable closeout evidence SHA: `de68cda0f2ca474a8b2c0d331d0a3cb7d585041f`  
Audit baseline / merge base: `d37d751dfa232b20c8158d55c20c13cc1d7a10ef`  
Current `main` at closeout refresh: `6716f475850f6dbcbb0ca1287a02bf3f8771966b`

Qualification evidence: 420ResourceProtocol Audit Qualification run #18 / `37172437118`; `resource-contract-core` job `111348008324` PASS; `resource-storage` job `111348008422` PASS; `resource-runtime-sdk` job `111348008387` PASS; `resource-security` job `111348008250` PASS.

Requirements satisfied:

- retained this audit report and roadmap;
- documented canonical Resource/Storage action identifiers, remediated events and lifecycle/state transitions in `docs/developers/storage-and-resource-integration.md`;
- reconciled `420resource-genesis.json` lifecycle semantics: repository review found no authoritative global genesis-config migration enum, so `IMPLEMENTATION_QUALIFICATION` is intentionally retained and explicitly defined as non-deployment/non-Genesis readiness rather than silently rewritten;
- documented deterministic dependency order, constructor bindings, artifact/runtime codehash verification, `eth_getCode` verification, Registry publication constraints, operator activation flow and recovery boundaries;
- preserved the registry-resolved/no-fixed-predeploy architecture and deferred creation of the executable/versioned deployment package itself to RESOURCE-AUDIT-8.

Milestone status: no separate Level 2 milestone is required for this documentation/config-only step.  
Intentionally deferred Level 3 work: reconcile the full accumulated audit branch with current `main` and run comprehensive merge-candidate qualification once at app-phase closeout.  
Blockers for RESOURCE-AUDIT-7: **none**.  
Next canonical step: **RESOURCE-AUDIT-8 — deterministic deployment package**.

Exit: Resource app-specific exact-head qualification PASS on the documentation implementation SHA; no executable/config schema mutation was introduced by this step.

## RESOURCE-AUDIT-8 — deterministic deployment package

Status: **COMPLETE**

Qualification level: **Level 1 — app-scoped deployment-package qualification**

Substantive implementation SHA: `4e0fa1c117bb8ce490f4aeec5e18c8ae71a33487`  
Exact qualified head: `ab23f86e4662aab89bbee885e51aee6ab6dd0343`  
420ResourceProtocol Audit Qualification: run #28 / `37173973465` — **PASS**

Jobs:
- `resource-contract-core` job `111352607872` — PASS: deterministic deployment-package verifier, Resource build, Resource deployment binding suite, Resource adversarial suite and Solidity formatting;
- `resource-storage` job `111352607923` — PASS: retained Storage protocol suites;
- `resource-runtime-sdk` job `111352607936` — PASS: Resource Network runtime and storage SDK;
- `resource-security` job `111352607803` — PASS: dangerous-primitive scan, hardening profile and targeted Slither high-severity gate.

Requirements satisfied:
- versioned machine-readable deployment package at `contracts/config/resource/resource-audit-8-deployment-package.json`;
- deterministic 15-contract Resource/Storage constructor/dependency order;
- GovernanceTimelock, ProtocolRegistry, CapabilityRegistry and per-settlement Vault binding policy;
- canonical ProtocolRegistry service identity `420/service/resource-protocol/v1` with version/metadata/manifest/interface/dependency commitments;
- explicit prohibition on inventing a Resource router component identifier where none is canonically approved;
- exact artifact/runtime-codehash commitment and live `eth_getCode` verification requirements;
- post-deployment constructor, Registry, capability, Vault and smoke verification rules;
- rollback/recovery boundaries preserving historical protocol state;
- local-EVM deployment binding suite and fail-closed package verifier;
- Resource genesis descriptor linkage and CI ownership.

Live addresses, transactions, runtime hashes, Registry publication receipts, Capability grant/revocation receipts, Vault binding receipts and smoke transactions remain intentionally empty. They are not RESOURCE-AUDIT-8 exit criteria and are owned by RESOURCE-AUDIT-9.

Level 2: no separate run required; the deployment package was directly exercised with the real Resource/Storage graph and ProtocolRegistry in Level 1 while retained Resource/Storage/runtime/security suites also passed.  
Level 3: performed at repository handoff/merge reconciliation before PR #498 merge.  
Blockers for RESOURCE-AUDIT-8: **none**.  
Next canonical step: **RESOURCE-AUDIT-9 — production-equivalent testnet deployment**.

Exit: **SATISFIED — RESOURCE-AUDIT-8 COMPLETE.**

### RESOURCE-AUDIT-8A.2 C6 — production collateral policy disposition

**Status: DISPOSITIONED — production economic approval deferred to pre-testnet governance; repository qualification not blocked.**

The canonical [policy record](https://github.com/abvhiael/420-integrated-v0.1/blob/main/contracts/config/resource/resource-8a2-collateral-policy.json) retains null minimum collateral, minimum slashable backing, coverage basis points and withdrawal delay; acceptingNew is false. No approval evidence, approved revision or activation transaction is asserted. Provider admission remains fail-closed through ResourceProviderRegistry420._eligible and governance-only policy publication. Existing test fixture values are not production values.

The outstanding external approval and activation preparation is owned by [GOV-PRE-RESOURCE-COLLATERAL](420GOVERNANCE-AUDIT-REMEDIATION-ROADMAP.md#gov-pre-resource-collateral--resource-provider-economic-policy). Governance must approve Resource-specific values before production-equivalent admission; verified deployment and authorized on-chain publication/readback are retained under RESOURCE-AUDIT-9. No validator or Compute policy inheritance is authorized. This disposition does not assert live readiness.

## RESOURCE-AUDIT-8A.2 — C7 retained collateral qualification

Original qualified source: `6837f137229ff0d9496d2d74d1cb0bea50680de5`, run 45731694723. Custody 20/20, policy 6/6, Resource adversarial 14/14, deployment binding 3/3, Storage 31/31; 150,000 policy fuzz runs; 2,048 x 256 and 4,096 x 384 invariant profiles (2,097,152 calls, zero unexpected reverts); zero high-severity Slither findings. The counts are for the original standard/hardening qualification, not a sum of subsequent reruns.

The [consolidated evidence manifest](420RESOURCE-8A2-qualification/manifest.json) binds retained actual timestamped CI extracts, job/step outcomes, local-EVM deployment emissions, test configuration and source commitments to their respective exact revisions. The [compiler archive](420RESOURCE-8A2-artifacts/sha256.json) retains before/after ABI, storage layout and bytecode commitments for ten contracts. C5.2 SDK repository tests passed; deployed-contract integration was explicitly deferred. C5.3 verified 44 events and real PostgreSQL recovery using a controlled chain source, with three tests passed and none skipped. C6 retains unapproved economic parameters and disabled admission; approval is assigned to GOV-PRE-RESOURCE-COLLATERAL. The inherited Genesis V4 authority dependency is not a Resource implementation defect and remains fail-closed. Session economic discharge binding remains owned by RESOURCE-AUDIT-8A5.

C7 records historical, repository-scoped evidence, not live deployment authorization. C8 final integrated closeout remains separate. All live deployment evidence remains empty; RESOURCE-AUDIT-9 owns testnet verification.

## RESOURCE-AUDIT-9 — production-equivalent testnet deployment

Status: **BLOCKED — TESTNET/INFRASTRUCTURE**

On the canonical production-equivalent testnet retain:

- exact chain/genesis identity;
- deployed addresses and `eth_getCode`;
- runtime codehashes matching the qualified artifacts;
- correct immutable constructor dependencies;
- authorized ProtocolRegistry publication;
- CapabilityRegistry grant/revocation behavior;
- provider/node/offer/session/receipt live flow;
- Store capacity/commitment/proof/agreement/manifest/Vault settlement flow;
- restart/reorg/recovery and RPC disagreement behavior;
- Resource Network runtime/SDK against verified deployment.

Repository simulation is not a substitute.

### RESOURCE-AUDIT-9 — C5.2 deferred collateral SDK qualification

Status: **DEFERRED TO TESTNET — USER-APPROVED 2026-11-25**

Repository SDK implementation and controlled RPC regression tests: PR #1427, exact tested implementation head `b9e3e9acc1c66fa1d0cd5d44cffee7a20497977e`. Resource protocol and Reefer Review RR-5 workflows passed. This is repository qualification, not deployed-contract integration evidence.

At testnet launch:
- Bind the SDK to the verified chain ID, genesis hash, ProtocolRegistry runtime identity, published Resource Router and code-hash-bound collateral authority.
- Exercise actual contract reads for positions, policies, discipline, reservations, penalties, exit maturity and withdrawal eligibility; reconcile full-width amounts with contract state.
- Prepare, explicitly authorize and submit deposit/top-up, exit and withdrawal transactions; verify receipts, nonce replay rejection, unauthorized callers, premature withdrawal and outstanding-obligation rejection.
- Verify wrong-chain, stale/reorganized block, unavailable RPC, incorrect code hash and unverified authority rejection; ensure no HTTP transport response is treated as authoritative collateral state.
- Retain exact SDK and deployment commits, block hashes, transaction receipts, reconciliation reports and negative-path results; close deferred C5.2 integration only upon passing.

No production policy activation, live authority or deployed-contract readiness is implied by this deferral.


## RESOURCE-AUDIT-10 — Genesis acceptance closeout

Status: **BLOCKED BY RESOURCE-AUDIT-8/9**

Reconcile exact deployed evidence with:

- Genesis application contract map;
- address namespace policy;
- Resource genesis invariants 001–014;
- Registry publication;
- Vault/stake/governance dependencies;
- final security/test/docs evidence.

## RESOURCE-AUDIT-11 — production qualification

Status: **BLOCKED BY GENESIS ACCEPTANCE**

Perform production endpoint/topology/credentials/monitoring/load/failure/incident/recovery qualification and record final release evidence. Production readiness cannot be inherited from testnet or repository CI.
