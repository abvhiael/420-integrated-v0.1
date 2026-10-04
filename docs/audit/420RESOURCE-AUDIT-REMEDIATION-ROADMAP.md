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
