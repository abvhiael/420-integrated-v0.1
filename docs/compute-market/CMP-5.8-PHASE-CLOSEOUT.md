# CMP-5.8 — Phase closeout

Status: **LEVEL 3 CLOSEOUT CANDIDATE — exact-head comprehensive qualification pending.**

## Canonical definition

Reconcile the complete accumulated CMP-5 external distributed-compute adapter phase against current `main`, establish one exact merge-candidate implementation SHA, run the required Level 3 qualification once, preserve durable evidence, and hand off to **CMP-6 — Useful-computation rewards**.

## Reconciliation baseline

Current `main` reconciled: `ea76c951b683a2b75ad2e64902e6e99c3a0b06ea`.

Reconciled branch anchor: `58d529c74d9c74db68b729e5f6c37e527d3652f2`.

The branch was 0 commits behind that main baseline at reconciliation. The final substantive closeout commit containing this inventory, verifier, workflow ownership wiring, and roadmap candidate state becomes the exact Level 3 merge-candidate implementation SHA.

## Prerequisites

CMP-5.1 through CMP-5.7 are COMPLETE.

Documented CMP-5 Level 2 integration milestones are:

- CMP-5.2 — BOINC adapter / shared external contribution interface;
- CMP-5.5 — provider-neutral external proof/credit normalization;
- CMP-5.6 — shared one-time external reward-consumption authority;
- CMP-5.7 — authoritative external-result to canonical-work mapping.

## Level 3 ownership

1. **Solidity Contracts** owns the canonical complete repository Foundry inventory exactly once, using four balanced PR shards.
2. **Genesis Address Authority** owns canonical address/namespace/collision/predeploy/frozen-manifest verification and must not duplicate the full Foundry inventory.
3. **420 Integrated Qualification** owns global runtime/build/Geth/fault/soak qualification.
4. **420Docs Qualification** owns global documentation and reconciliation.
5. **Compute Market Qualification** owns the retained Compute contract suite and all retained CMP verifiers, including this closeout verifier.

Missing, cancelled, stale, superseded, skipped-required, or untriggered Level 3 gates are not passing evidence.

## Accumulated CMP-5 protocol surface

The phase contains:

- Folding@home external contribution normalization;
- BOINC external contribution normalization;
- research-cluster normalization;
- university/HPC gateway normalization;
- provider-neutral external proof and credit normalization;
- canonical external-work one-time consumption / double-reward prevention;
- trusted, revocable external-result attestation and canonical-work mapping.

## Security and authority boundaries

CMP-5 closeout preserves strict authority separation:

- external contribution adapters normalize external identities and metrics but do not attest truth or pay rewards;
- proof/credit normalization does not validate external truth or grant economic authority;
- CMP-5.6 owns one-time external reward-claim consumption only;
- CMP-5.7 owns trusted external-result attestation and canonical-work mapping only;
- existing Compute verifier, worker, stake/slash, escrow/Vault, governance, bridge, settlement, and reward authorities remain unchanged;
- CMP-6 remains the owner of useful-computation reward economics and payout integration.

## Client/service applicability

CMP-5 introduces no direct 420Indexer schema/ingestion implementation, no 420RPC method/backend surface, no 420Search consumer, no user-facing frontend/backend application, and no `@420/sdk` surface.

Those direct suites are non-applicable unless the final merge candidate changes the corresponding implementation surface. Indexed external-compute discovery remains CMP-7 and the human-facing application remains CMP-8.

## Deployment/config verification

CMP-5.8 Level 3 must verify:

- Compute Market phase configuration is internally consistent;
- no unauthorized Genesis/frozen-address claim is introduced;
- no deployment manifest or predeploy authority drifts;
- CMP-5 contracts remain repository-ready but are not falsely represented as live public/testnet deployments.

## Repository qualification versus live deployment

CMP-5.8 is repository phase closeout, not live external-provider certification.

Still deferred to later phases/testnet:

- live trusted external-attester governance onboarding;
- ProtocolRegistry publication/deployment evidence;
- provider-specific off-chain evidence validation services;
- funded useful-computation reward integration under CMP-6;
- public/testnet external workload demonstration under CMP-9.

## Next canonical phase

**CMP-6 — Useful-computation rewards**
