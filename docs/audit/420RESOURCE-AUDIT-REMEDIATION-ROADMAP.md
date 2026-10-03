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

Status: **IMPLEMENTED / QUALIFICATION PENDING**

- enforce governance service unit ceiling on offers;
- enforce service unit and duration ceilings on sessions;
- implement declared scoped node metadata update path;
- make Resource session cancellation reachable;
- require nonzero, strictly advancing cumulative receipts;
- wire exact node-scoped receipt delegation;
- add mutation/lifecycle events needed for deterministic derived reconstruction.

Exit: dedicated Resource core build/tests pass on exact substantive head.

## RESOURCE-AUDIT-3 — adversarial and lifecycle test expansion

Status: **IMPLEMENTED / QUALIFICATION PENDING**

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

Status: **PENDING EXACT-HEAD RUN**

Run exact-head:

- StorageCapacityRegistry420;
- StorageProofProtocol420;
- StorageAgreementRegistry420;
- StorageObjectManifestRegistry420;
- StorageSettlementRegistry420.

Exit: all targeted Store/proof/manifest/settlement suites pass.

## RESOURCE-AUDIT-5 — runtime and SDK qualification

Status: **PENDING FINAL-HEAD EVIDENCE**

Run:

- `go test ./execution/storage/...`
- `go test ./sdk/storage420/...`

Retain exact run/job IDs and final head.

## RESOURCE-AUDIT-6 — static/security qualification

Status: **PENDING FINAL-HEAD EVIDENCE**

- forbidden primitive scan for `delegatecall`, `selfdestruct`, `tx.origin`;
- Resource core hardening-profile tests;
- targeted Slither;
- fail on high-severity Resource-source finding.

## RESOURCE-AUDIT-7 — documentation/config reconciliation

Status: **PARTIAL**

- retain this audit report and roadmap;
- document remediated event/action/state transitions;
- reconcile `420resource-genesis.json` lifecycle status only after canonical status vocabulary is established;
- add deterministic contract deployment/verification/operator instructions.

## RESOURCE-AUDIT-8 — deterministic deployment package

Status: **MISSING / REPOSITORY WORK**

Create a versioned deployment package for the registry-resolved Resource contract graph:

- dependency/deployment order;
- constructor arguments;
- chain/network identity;
- governance/CapabilityRegistry/Vault bindings;
- compiled artifact/runtime codehash commitments;
- ProtocolRegistry service key/version/interface/dependency metadata;
- post-deployment verification and smoke checks;
- rollback/recovery boundaries.

This step must not allocate a new fixed Genesis predeploy.

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
