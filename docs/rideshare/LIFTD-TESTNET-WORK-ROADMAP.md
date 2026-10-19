# LIFTd — retained external and official-testnet acceptance

All entries remain pending. Deferral is not qualification or a waiver. Local implementations, synthetic keys and mocked adapters cannot satisfy these gates. Complete repository-only adapter/state/security work under L01/L02 before collecting external evidence.

| Gate | Acceptance needed | Owner |
| --- | --- | --- |
| LT-01 | Official network/deployment/Registry provenance and application permission evidence | Registry / network |
| LT-02 | Real Identity issuer/session/recovery/revocation and rider/driver account binding (L01.2 repository verifier/transport/service tests passed; L01.6 repository driver-availability/session revalidation passed; independent live Identity/driver-session/availability acceptance still pending) | Identity / Wallet |
| LT-03 | Explicit Wallet consent; independently approved platform subsidy reservations; real quote-bound Pay capture, finality, reorg recovery, refund/payout and split conservation | Wallet / Pay / Treasury |
| LT-04 | Independently approved passenger-transport jurisdiction, operator/driver/vehicle/insurance eligibility, managed trust roots and revocation (L01.3 repository projection/adapter checks passed; live passenger authority acceptance pending; L01.7 repository signed fare/earnings/allowance-rule enforcement passed, with independent live fare/tax/charge/legal applicability acceptance pending) | Compliance / authorized transport operator |
| LT-05 | Provider-authorized routing, private coordinates, operational device permissions, retention and reliable mobile sessions (L01.5 repository signed Location/private PostgreSQL/precision/access/retention and M-L01-A integration passed; independent live provider, approved geographic classifier and device acceptance pending) | Location / device operators |
| LT-06 | Independent emergency/support operation, incident recovery, staffing and accessibility/device acceptance | Safety / operations |
| LT-07 | Managed deployment, TLS/keys, multi-instance fault/restart evidence, database recovery, monitoring and audit access (L01.4 repository PostgreSQL concurrency/application restart/database crash recovery passed; L01.5 encrypted private storage/expiry erasure/tombstone recovery passed; independent managed encryption keys/rotation, retention scheduler, backup-tombstone replay, deployment and failover acceptance pending; L01.6 repository concurrent dispatch/lease recovery passed, while live availability/assignment TTL acceptance and independently granted expiry-worker scheduling remain pending) | Service operations |
| LT-08 | Actual Travel, Notifications, Reputation and Arbitration consuming-service acceptance | Respective canonical owners |

The owner explicitly selected Vancouver, BC and adopted pilot fares, fees and compensation allocations on 2026-10-13; see [economic policy v1](LIFTD-VANCOUVER-PILOT-ECONOMIC-POLICY.md). Economic implementation, operating-cost validation, detailed cancellation/waiting policy and commercial approvals remain pending. DOOBr delivery approval cannot authorize passenger transport. Nothing in this scaffold changes Genesis configuration, registers a predeploy or enables live rides.

L01.7 repository immutable quotes, exact rider consent, zero-fee pre-trip cancellation and signed pickup/subsidy viability passed. This does not satisfy live rate/applicability, actual funded-reservation or Wallet/Pay acceptance. L01.8 scoped Wallet/Pay consumer, actual earning/allowance/tip/top-up/refund/finality and conserved payout projections passed repository Level 1. Independent live Wallet consent, canonical asset/FX/current finality/refund/payout/funded Treasury witnesses and actual statutory pay-period acceptance remain LT-03/LT-04. LC-01's percentage conflict was resolved by owner-approved 10% LIFTd policy; canonical settlement authorization, recipient, denominator and live Pay/Treasury/Vault acceptance still gate development execution, and testnet wiring alone cannot certify it. Existing LT-03/LT-04/LT-05/LT-07 approvals remain pending.

## L03.8 — operational safety external acceptance work (LT-06; TN-0 through TN-6)

**Canonical status: NOT ACCEPTED.** Repository safeguards and five SAFE execution adapters are already qualified at their original exact implementation SHAs (see [repository safeguards evidence](L03.8-REPOSITORY-SAFEGUARDS-EVIDENCE.md) and [SAFE execution evidence](L03.8-SAFE-GATES-EXECUTION-EVIDENCE.md)). This transfer does not reopen or rerun qualified local work, does not close L03.8, and does not advance to L03.9.

| Existing TN gate | External interaction and required proof | Disposition |
| --- | --- | --- |
| TN-0 | Appoint independent safety lead, support/duty and backup supervisors, IAM/privacy/recovery owners and independent evaluator; approve coverage, escalation SLAs and exercise boundaries; freeze exact release/image/config/authority fingerprints | NOT ACCEPTED |
| TN-1 | Independent operator deploys isolated nonproduction LIFTd, protected rider/driver/operator identities, live staffed support/escalation, managed IAM, vault, audit, monitoring and restoration facilities; public passenger traffic and payments disabled | NOT ACCEPTED |
| TN-2 | Witness and capture deployed SAFE-OPERATOR authorization/revocation, separation of duties, cross-tenant and forged access denials and protected SAFE-INCIDENT evidence handling | NOT ACCEPTED |
| TN-3 | Exercise staffed SAFE-SUPPORT case ownership and appeals and SAFE-ESCALATION delivery, acknowledgment, missed-SLA, backup/supervisor and outage routes with independently verified receipts | NOT ACCEPTED |
| TN-4 | Independently witness SAFE-INCIDENT, SAFE-SUPPORT, SAFE-ESCALATION, SAFE-OPERATOR and SAFE-DRILL; actually halt admission, fail providers/workers/DB, restore/rollback pinned release, verify ledgers/holds, measure RTO/RPO and deny unsafe reopening | NOT ACCEPTED |
| TN-5 | Obtain five separately signed deployment-bound SAFE decisions, immutable redacted evidence, independent reviewer and operations approval, expiry and exception disposition | NOT ACCEPTED |
| TN-6 | Separately approve production recovery, staffed operational coverage, insurance/transport authority and final restricted release; no technical PASS grants public passenger dispatch/payment | NOT ACCEPTED |

**Authoritative scenario definitions:** [L03.8 operational safety acceptance](L03.8-OPERATIONAL-SAFETY-ACCEPTANCE.md) and [full testnet roadmap](LIFTD-TESTNET-ROADMAP.md). The existing LT-06 and TN-0–TN-6 identifiers and canonical L03.8 exit criteria are unchanged. No credentials, personal location, raw incident documents or reviewer private records belong in Git.
