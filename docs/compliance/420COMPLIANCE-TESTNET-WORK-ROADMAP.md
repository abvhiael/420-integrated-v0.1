# 420Compliance — Outstanding testnet and external-acceptance work register

**Status: OPEN — not qualified or approved.** This is the consolidated post-C08.6 handoff, not a replacement for the canonical roadmap. All original step IDs C09.1–C09.10 and C10.1–C10.8 remain unchanged. No claims of approved legal interpretations, issuer credentials, deployed consumers, independently anchored recovery, or production authorization are made.

**Repository baseline:** C08.6 qualified implementation `3f12c3b95db160b36f4bafb1491adea8dbd23ef1`; closeout certificate `docs/compliance/qualification/C08.6-level3-closeout.json`; main merge commit `612ada971b57084b8e7df8fb39f49384aa24d95c` (PR #660). Read and preserve `docs/compliance/C08.3-EXTERNAL-AUTHORITY-TESTNET-HANDOFF.md`, `docs/compliance/qualification/C08.3-testnet-work-ledger.json`, and the canonical `docs/compliance/420COMPLIANCE-ROADMAP.md`. This register makes the remaining work executable and auditable without changing canonical requirements.

## 1. Canonical C09 — Deployed testnet qualification

| Canonical step | Outstanding work and required proof | Owner/dependency | Exit disposition |
| --- | --- | --- | --- |
| **C09.1** | Provision isolated production-equivalent Compliance API/evaluators/workers, real PostgreSQL and storage, secrets and pinned-TLS workload identities, approved testnet KMS/HSM signers, independently operated recovery/immutable evidence store, observability, MFA reviewer/operator identities, network policy, RBAC, backups and operator controls. Do not use ephemeral Travel staging as independent recovery authority. | Infrastructure/security/operator approvals; Identity and managed signer providers | OPEN: inventory resource IDs, environment/network identities, signed access matrix, config digests, deployed SHA, recovery-domain separation and independent owners |
| **C09.2** | Deploy only approved adapters/contracts; record addresses, bytecode/code hashes, ABI, canonical registry resolution, frozen-address comparison and deployment transactions. If no contract applies, record evidenced not-applicable decision. | Genesis/Registry/Chain deployment authority | OPEN |
| **C09.3** | Real official federal, BC, Vancouver, applicable Indigenous/licensing and jurisdiction sources with authorized acquisition; store provenance, effective periods, issuer, immutable hashes, changes/conflicts and review queue. Resolve federal product/packaging/equivalency/promotions/payment and BC/Vancouver licensing/delivery-class issues against actual text. | Qualified independent legal reviewer, source operators | OPEN: local source fixtures alone are insufficient |
| **C09.4** | Test managed signing/publishing/rollback, scheduled publication, signer expiry/rotation/revocation, two-person ceremony, instance/consumer generation consistency and immutable anti-rollback checkpoint. | Managed signing/KMS, isolated recovery authority | OPEN |
| **C09.5** | Wire real authorized Identity/Verify/Registry/Location/Notifications, optional Oracle where applicable, issuer/retailer/carrier licence authority and revocation feeds; independently verify account/workload role scope, credential expiry and tenant/region boundary. | External provider accounts, issuer approvals, consumer teams | OPEN: missing integrations must be explicit blockers |
| **C09.6** | Deploy real networked DOOBr/420Travel clients/SDKs and Compliance gateways; run simulated orders and informational Travel journeys across actual deployed browsers/mobile clients, signed change notification, persistent ACKs, multiple replicas and deny/unknown behavior. No regulated deliveries. | DOOBr, Travel, SDK, accessibility and partner test actors | OPEN |
| **C09.7** | Adversarial live multi-instance revocation/staleness/clock skew, source tampering, cross-tenant access, outages/partitions, credential compromise, backup rollback, concurrent checkpoint writers, promotion/recovery, deletion-tombstone replay and missing-authority fail-closed enforcement. | Independent assessor, operators, consumers | OPEN |
| **C09.8** | Production-equivalent capacity, full-duration soak, rate limits, ingress targets, durable true PostgreSQL backup/WAL/PITR restore with measured approved RPO/RTO, privacy/erasure/legal holds, access logging, operator/incident drills, manual independent accessibility and client recovery. | Infra, privacy, DR, independent accessibility and operations | OPEN |
| **C09.9** | Independent security review and qualified jurisdiction/carrier/legal-policy approval with named authorized reviewers, source-to-rule traceability, negative/stale tests, signed exact policy digest, unresolved findings register and remediation/retest. C07.9 independent assessment was not completed by repository fixtures. | Independent qualified security/legal reviewers | OPEN: no implied approval |
| **C09.10** | Testnet phase certificate: exact deployed code/SDK/ABI/chain/env/config/policy SHA, provider identity, artifact checksums, signed review outcomes, workflow/deployment/test logs, remaining blocked C10 gates and explicit deny-first release posture. | Audit owner and independent gatekeepers | OPEN |

## 2. Cross-cutting unfinished work, anchored to unchanged C09/C10 steps

| Workstream / source | Unfinished proof | Primary C09 steps | Follow-on C10 |
| --- | --- | --- | --- |
| **LEGAL / federal, BC, Vancouver and applicable Indigenous authority** | Actual primary-source text, qualified independently signed legal opinion and changing-law review; genuine retailer/carrier/DOOBr operating classifications and lawful payment routing | C09.3, C09.5, C09.9 | C10.1, C10.2, C10.4, C10.7 |
| **IDENTITY & MANAGED SIGNING** | Approved reviewer/operator identities, MFA/WebAuthn, independently scoped workload identity, real KMS keys, revocation, rotation and two-person publication | C09.1, C09.4, C09.5, C09.7 | C10.1, C10.3, C10.7 |
| **CONSUMERS / DOOBr, Travel and SDKs** | Deployed services/clients, end-to-end consumer receipts and persistent ACK, propagation timing, stale/revoked decisions, independent manual accessibility | C09.1, C09.5–C09.8 | C10.2, C10.6, C10.7 |
| **RECOVERY / C07.6** | Dedicated external immutable/WORM high-water generation authority, TLS/RBAC/KMS, disaster domain separation, crash/replay fencing, real base-backup+WAL PITR, retained deletion/hold state and measured incident drills | C09.1, C09.4, C09.7–C09.9 | C10.3, C10.6, C10.7 |
| **INDEPENDENT SECURITY / C07.9** | Qualified external assessor and approval after remediation; local threat-model/verifier evidence does not substitute | C09.7, C09.9 | C10.3, C10.7 |
| **HISTORICAL STANDALONE EVIDENCE** | C06.5, C06.6, C06.7, C06.8 and C07.6 Level 1 original certificates still `NOT_VERIFIED`; retain historical status and recover original SHA/run/artifacts or conduct **targeted scoped repository replay** where independently justified, rather than claiming C07.10 Level 2 proves the original Level 1. Keep live portions in C09. | Repository evidence recovery separately; external scenarios C09.6, C09.7, C09.9 | C10.1, C10.7 |

**Important boundary:** Recovering the five historical standalone Level 1 certificates is repository evidence work, **not a task that requires the active testnet**. It is tracked here to prevent loss of an unfinished item, but must be executed separately as targeted evidence reconciliation. The live/deployed portions belong in C09/C10.

## 3. Canonical C10 — production/operational acceptance (all OPEN)

- **C10.1:** Revalidate official sources, policy digests, qualified reviewer mandate, licence evidence and legal applicability at release.
- **C10.2:** Verify actual DOOBr retailer/courier agreements, licences, insurance, payment, privacy, delivery record ownership and partner acceptance.
- **C10.3:** Explicitly approve production release artifacts/config, separate production identity and non-exportable signer authority, deployment refs, incidents and support.
- **C10.4:** Publish separately reviewed public guidance where allowed; leave transactional regions disabled without their own approvals.
- **C10.5:** Run scoped production shadow evaluation and independently approved canary; shadow never confers authority.
- **C10.6:** Validate actual production DOOBr stage enforcement, Travel informational limitation, expiry, cross-region revocation and incident response.
- **C10.7:** Signed go/no-go by qualified independent authorities; scope by region, actor and action. Preserve DOOBr's independent audit gates.
- **C10.8:** Post-launch incident drills, lawful-change SLAs, coverage review and controlled expansion.

## 4. Acceptance packets and operation rules

For each unfinished item record `step / owner / issuer or legal authority / environment / scope / exact code and policy digest / configuration / source-effective interval / adverse and positive tests / deployment and CI run IDs / artifact SHA-256 / assessor sign-off / outstanding risks / disposition`. Status progresses `OPEN → VERIFIED` only on demonstrable external evidence, with `REJECTED/BLOCKED` where applicable. No secrets or personal credentials in Git.

**No silent skips, no invented providers, no production ALLOW**. Missing, revoked, stale, unlicensed, unavailable or unreviewed mandatory authority yields `UNKNOWN`, `DENY` or `REVIEW_REQUIRED` per existing policy. A successful repo build, testnet pass or simulated order is not regulatory authorization.

## 5. Next work item

Start **C09.1** from the canonical roadmap when approved infrastructure accounts/owners are available. Complete its targeted Level 1 qualification. Keep unrelated global Solidity/Genesis/Integrated/Docs reruns out of ordinary C09 steps unless the actual change or canonical gate requires them. C09.10 is the deployed-testnet phase closeout. C10 is independent production acceptance.
