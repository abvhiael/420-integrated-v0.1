# 420Compliance — Production signing, evaluation and acceptance gates

**Status: REPOSITORY IMPLEMENTATION IN PROGRESS; NOT DEPLOYED OR APPROVED.** No production cannabis transaction permissions are issued by this repository change.

## Implemented, and what is not
The `services/complianceauth` Go package offers Ed25519 manifest validation, scope-bound directory discovery, a managed-key signer interface, strict review/evidence adapter interfaces and a deterministic policy decision model. Its independent signer, legal authority and credential authority implementations require external production integrations. The `PolicyGate` remains hard-denied; an `ALLOW` returned by a locally tested pure policy evaluator is not a transaction entitlement. DOOBr still requires separately qualified stage-bound enforcement; Travel's transaction endpoints remain disabled.

## Independent legal review
A qualified and authorized legal reviewer must review each exact source/effective-interval/policy digest for the jurisdiction, document their mandate and conflict-of-interest screening, explicitly identify ambiguities, and sign a distinct review record. Software engineering commits, governance approvals and self-attested Boolean fields do not constitute legal approval. The production approval adapter must authenticate the reviewer with 420Identity or another approved identity source, validate role/revocation and require independent reviewer/publisher separation. **No such external approval has been received or minted by this change.**

## Operating-partner acceptance
For each operating retailer and courier/carrier, independently confirm applicable licences/authority, party identity, geographic and vehicle/store scope, permit status, expiry, revocation feed and the actual regulatory interpretation. Store attestations off-chain with minimum retention and auditable consent. DOOBr must own dispatch/handover/return/custody and partner gates. **No real partner is marked approved by this change.**

## Credentials, managed signing and service discovery
Production rollout requires an approved managed non-exportable Ed25519 signing key in a reviewed KMS/HSM with dedicated workload identity, dual control, rotation, audit logging, public-key pin publication and tested compromise/revocation response. Do not commit private keys or assume keys were provisioned. Endpoint resolution must come from signed/controlled environment configuration or approved service registry, use mTLS identity/audience validation, and reject unknown/unhealthy/stale addresses. Staging/testnet/prod credentials and signing audiences must be distinct. Fail closed on unavailable authorities or keys.

## Production deployment and independent acceptance sequence
1. Establish the approved identity and attestation issuers plus independent reviewer access and legal-source approval evidence.
2. Implement/adapt KMS/HSM signer and verified key registry; separately authorize signing workload and publisher identity.
3. Deploy separate public-redacted, internal-evaluator and private-review services with PostgreSQL/PostGIS, encrypted snapshot storage, change-feed/outbox and traceable immutable audit records.
4. Deploy authenticated service registry with mTLS, environment pins, revocation/status and resilience testing; deploy independent credential/reviewer adapters, not caller assertions.
5. Run app-level integration for source → review → publication → fresh evaluation → DOOBr stage check → refusal/safe return, including expired, tampered, missing, replay, revocation, outage, wrong tenant/jurisdiction and actor/partner mismatch.
6. Perform signed independent legal and partner acceptance, privacy/security assessment, disaster recovery, key compromise simulation, SLA alerting and production change authorization; retain exact deployed artifacts and CI SHA.
7. Only after all gates approve, use a separate reviewed release PR/authorization to change runtime activation. Never activate on software CI success alone.

## Required evidence to change production status
Reviewer identity/mandate/legal memo, exact reviewed policy/effective times, publisher approval, partner licence and carrier checks, trusted credential issuer/revocation, KMS key metadata (not private bytes), service identity certificate/trust anchors, deployment URL and environment IDs, production test results, independent security/ops sign-off, rollback plan and incident/runbook proof. All are **PENDING EXTERNAL ACCEPTANCE**; do not substitute synthetic fixtures.

C01.8 owns architecture Level 2; C08.5 owns phase Level 3. Repository-level test success is not legal or live readiness.