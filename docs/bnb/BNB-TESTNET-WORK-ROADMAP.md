# 420BnB — testnet-dependent work roadmap

Status: DEFERRED TO OFFICIAL TESTNET / EXTERNAL GOVERNANCE. This is a handoff, **not** a declaration that BNB-2.1 passed, that issuers were approved, or that BnB may enable booking/payments.

Source: PR #600 BNB-2.1 authority gap reconciliation; canonical 420Identity ID-AUDIT-9 and official network manifests govern. Repository truth and current main override this handoff. All stages require approved operators, real deployment provenance and non-secret, independently reproducible exact-SHA evidence. Do not create fake issuer credentials, addresses, receipts, or governance approvals.

## T-BNB-IDENTITY-1 — Official network and Identity420 lifecycle (upstream dependency)

**Prerequisite:** official `developer-hub/manifests/testnet.json` published through network governance, deployed Identity420 with canonical frozen address `0x0000000000000000000000000000000000000436`, approved Genesis/chain ID, runtime code hash, GovernanceTimelock authority, wallet/indexer/search/explorer consistency.

**Run:** canonical `ID-AUDIT-9` production-equivalent acceptance, including profile/issuer/credential lifecycle, real approval/issuance/revocation/expiry transactions, chain reorg/dependency failure and independently checked immutable/config/storage hashes. Reference the upstream qualified SHA and original receipts; do not duplicate Foundry/global suite runs.

**Exit evidence:** valid official manifest, transaction hashes/receipts, code/storage witnesses, runtime hash and matching verifier PASS. BLOCKED while upstream ID-AUDIT-9 is incomplete.

## T-BNB-IDENTITY-2 — Trusted session verifier and production signing keys

**Prerequisite:** independently authenticated Wallet/420Identity session verifier with service-specific BnB audience/chain/network; governance/operator-approved issuer and security owners; a deployed KMS/HSM or equivalent key custody policy (no private keys in repository).

**Run:** pin trusted issuer provenance; exercise key ID rotation with overlap and retirement, revoked-session and inactive-subject denial on *every* protected mutation, compromised-signing-key shutdown/reissuance, provider outage/timeouts, wrong-chain/audience, expiration, clock skew, stale caches, independent recovery, fail-closed restarts and multi-instance consistency.

**Exit evidence:** non-secret issuer metadata, approval reference, verifier runtime/version identities, signed key lineage/public fingerprints, revocation/rotation/incident drill timestamps, request/response and audit-trace IDs, negative test results. No claimed live acceptance from synthetic JWTs.

## T-BNB-PROPERTY-1 — Independently approved host/property issuer

**Prerequisite:** governance approval explicitly naming the authorized legal/operational property verification service and responsible reviewing operators. 420Verify software-build verification is **not** property title/tenancy/licensing authority.

**Policy to approve:** jurisdiction-specific proof of lawful ownership or authorization to host; verified controller and property identifiers; right-to-let and licensing applicability; consent, minimization and retention; evidence freshness; independent reviewer separation of duties; anti-self-attestation; appeals/disputes; issuer suspension and compromised-key response; JTI/subject/property binding, expiry and revocation; audit and removal/escalation standards.

**Run:** verify actual external issuer provenance and revocation checks. Test forged/expired/cross-property claims, disputed or revoked license, changed controller, operator compromise and outage. Claims remain pending until independent verification; no approval by submitting a signed software attestation.

**Exit evidence:** governance decision reference, policy version, issuer identity/public signing-key lineage, reviewer/audit proof, redacted sample claim and valid/revoked history tied to specific properties. No BnB self-approval.

## T-BNB-INTEGRATION-1 — Production-equivalent cross-instance acceptance

**Prerequisite:** all three above gates qualified against the same testnet deployment and release SHA, production-equivalent PostgreSQL and HTTPS services.

**Run:** two or more BnB instances sharing PostgreSQL; actual provider-backed login/logout/revocation/recovery; concurrent session revocation vs property/hold operations, replay and IDOR, cross-tenant/manager capability expiry, property claim forgery/review/withdrawal, policy snapshots, expired credentials, key rotation, outage/restart/recovery, browser and HTTP API permission matrix. Record each request-to-auth-decision with sanitized trace evidence.

**Exit evidence:** reproducible test plan; service images/digests; exact SHA; chain/issuer identifiers; migration/checkpoint IDs; per-case PASS/FAIL and non-secret traces; operator and independent security signoff. Any failed condition keeps publication, settlements and protected actions fail-closed.

## Repository-side work that is NOT deferred

BNB-2.1 code and security acceptance must still implement: fail-closed signed proofs, local account/session/recovery authorization; caller-header spoof resistance; independently reviewed property capability enforcement; PostgreSQL adversarial replay/collision/cross-account tests; affected API route and browser permission matrix; bounded endpoint/issuer configuration, negative verifier tests, key rotation and revocation adapter contracts; CI on exact implementation SHA. These can be completed and recorded as *repository-side Level 1*, not as live external acceptance.

## Qualification and closure

- Preserve Level 1 targeted BnB CI and exact-SHA evidence for local work; no redundant global Foundry/Genesis/Docs qualification.
- Record the above as a separate **testnet handoff**; do not mark them complete merely because unit tests pass.
- BNB-2.1 overall remains **PARTIAL / LIVE-DEPENDENCIES-DEFERRED** until the external gates are witnessed. A later governance decision may define a narrower repository-only milestone, but cannot retroactively assert live acceptance.
- Do not merge or activate restricted functions based solely on this document. Reconcile with current main and apply the usual PR-specific merge approval and qualification rules.
