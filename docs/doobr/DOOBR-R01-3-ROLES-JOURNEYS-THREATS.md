# DOOBR R01.3 — roles, journeys, abuse cases and operational limits
Status: PROPOSED DESIGN BASELINE; Level 1 qualification pending. Scope: exact canonical R01.3 on PR #601; current main baseline `c5a4f220d1fbda01f707d359aa9bb32921a138b1`. Predecessor R01.2 approves only disabled-by-default development, NOT live delivery/payment or Genesis promotion.

## Role definitions and least privilege
| Actor | Allowed actions, once separately authorized | Forbidden authority |
| --- | --- | --- |
| CONSUMER | Explore legally permitted service coverage, authenticate, request approved retailer-origin service, consent, view own order and accessible receipts, cancel/dispute through governed paths | Cannot self-assert legal age/credential, pay by bypassing 420Pay, view courier personal GPS, change retailer status or assign courier |
| COURIER | Enroll with independently verified age/credentials and carrier class, declare availability, accept eligible offers, view minimum need-to-know active pickup/drop-off addresses, record sealed pickup and verified handoff/return | Cannot certify own eligibility, override destination/hours, complete without required verification, see other orders, collect unapproved extra doorstep fee, mutate canonical settlements |
| RETAILER | Manage retailer-owned catalog references and pre-paid, approved sale handoff, validate pickup readiness, request regulated delivery, view own status and reconciliation, report returns | Cannot use platform as an unlicensed seller, self-approve a licence, reveal other merchant orders, bypass policy or pay authority, assert courier handoff without evidence |
| OPERATOR | Manage support queues, investigate audited exceptions, suspend access, observe coarse fleet and service status, propose governed corrective actions | No unilateral fee/settlement, Compliance, identity, Registry, override, secret disclosure, address bulk export, retroactive event edits or arbitrary courier dispatch |
| COMPLIANCE_SERVICE | Return authenticated, signed/time-bound policy evaluations and revocations scoped to jurisdiction, carrier type, category and action | Not a courier dispatcher, retailer, pay authority or creator of licenses |
| SYSTEM_SERVICE | Execute separately scoped, auditable, idempotent background transitions on tenant-owned records | No generic superuser service token or automatic bypass of human approvals |

Consumers, couriers, retailers and operators each have independent scoped credentials, sessions, consent and revocation; partner service accounts cannot impersonate end users. Separation of duties: operator-initiated refunds and payment corrections require canonical independently approved 420Pay/Arbitration workflow; any exceptional manual override must require dual control and remain unable to override legal denials.

## Canonical journeys and event boundaries (designed, NOT deployed)
1. **Consumer discovery:** 420Travel/Maps sees only coarse region `AVAILABLE|LIMITED|UNAVAILABLE|UNKNOWN` with expiry and minimum-anonymity threshold. Deep-link to DOOBR; Travel never displays courier GPS/private address/order data and cannot checkout.
2. **Consumer order:** signed-in adult requests service for a retailer-origin, independently paid order; DOOBR obtains fresh retailer, courier, recipient, quantity, geography, time and category evaluations from 420Compliance and credential authorities. Missing, unsigned, expired or denied decisions block dispatch. Approved price/fee disclosure and Wallet consent route through 420Pay only when authorized.
3. **Retailer handoff:** verified retailer submits prepaid sale/order reference and quantity-equivalent declaration; signed evidence of sealed package and custody handoff. Retailer remains seller of record; courier may not alter product/quantity or collect unapproved additional fees.
4. **Courier lifecycle:** enrolled eligible courier sets availability, receives least-information offer, accepts an atomically reserved assignment, navigates with temporary access to route details, obtains required age/name/signature handoff evidence, completes after verified authorization. Recipient failure produces carrier-specific secure return, never success.
5. **Operator exceptions:** tenant and role scoped inspection, stop/suspend, lost/failed delivery, disputes, cancellations, charge reversals and privacy requests; independently governed remedies and append-only auditable action references.
6. **Reconciliation:** merchant sale funds never become DOOBR custody. 420Pay remains canonical settlement/receipt authority. Approved eligible net protocol revenue alone is the Dev Compensation Vault contribution basis; never gross cannabis proceeds, taxes, tips, courier earnings or deposits by default.

## Lifecycle and finite operational states
States: `DRAFT -> ELIGIBILITY_PENDING -> ELIGIBLE -> RETAILER_READY -> OFFERED -> ASSIGNED -> PICKED_UP -> IN_TRANSIT -> HANDOFF_PENDING -> DELIVERED -> CLOSED`. Rejection/cancellation/expiry before custody; after custody, `DELIVERY_FAILED -> RETURN_REQUIRED -> RETURNED -> RECONCILED`; disputed/refund handling is a separate authority-controlled financial case rather than silent change of delivery state. Every transition requires stable order+tenant ID, actor scope, version/ETag, idempotency key, policy reference and authoritative evidence. No state, including RETURNED or DELIVERED, is authoritative merely because a webhook arrived. Concurrent assignments must permit at most one active courier; retries must not duplicate charges, assignments or DevComp contributions.

## Abuse and adversarial test matrix (R01.3 design acceptance, runtime coverage planned R02–R05)
| ID | Abuse/failure case | Mandatory rejection/recovery |
| --- | --- | --- |
| R13-T01 | Consumer underage, revoked identity or changed recipient | DENY assignment/handoff; require fresh independent verification |
| R13-T02 | Retailer unlicensed, revoked or self-asserted approval | DENY, suspend and audit evidence |
| R13-T03 | Courier underage, certification expired or wrong carrier category | DENY offers/assignment, safe stop mid-route |
| R13-T04 | Unsupported province, Vancouver municipality override, outside approved hours | DENY signed policy decision; no geographic fallback |
| R13-T05 | 420Compliance unavailable, forged/stale/replayed decision | FAIL CLOSED; in-flight exception/return |
| R13-T06 | 30g-equivalent threshold/incorrect package evidence | DENY until retailer-authoritative validation |
| R13-T07 | Concurrent accepts/duplicate delivery callbacks | One assignment/one monotonic transition; replay rejected |
| R13-T08 | Consumer, courier, retailer or operator cross-tenant access | Identical private not-found/denial; no PII exposure |
| R13-T09 | Bulk courier location, address export or Travel/Maps indexing leak | DENY, minimize and revoke access; fail privacy tests |
| R13-T10 | Unpaid retailer order or unauthorized payment rail | DENY dispatch; 420Pay authority required |
| R13-T11 | Operator bypass, single-party approval or settlement modification | DENY; dual control + canonical financial authority |
| R13-T12 | Extra doorstep charges, developer compensation from gross order | DENY; preserve reconciled eligible net revenue only |
| R13-T13 | Recipient not present/failed age, no signature or unattended drop | DELIVERY_FAILED/RETURN_REQUIRED, not DELIVERED |
| R13-T14 | App offline, GPS revoked, late/out-of-order provider event | Fail-safe recovery, revalidate policy/credential and custody |
| R13-T15 | Retention/deletion request versus mandated evidence records | Apply legal basis and restricted-access retention, no public indexing |
| R13-T16 | Forged pickup proof, asset reuse or identity/session substitution | Reject scoped signature and append evidence anomaly |
| R13-T17 | Cancellation/partial refund/failed fee routing | No double refund or payout; canonical reconciliation |
| R13-T18 | Tenant-scope breach through retailer API key or support console | Deny, revoke key, capture minimal incident audit |

## Operational limits and release constraints
- Regulatory design baseline `CA-BC-VANCOUVER-cannabis-delivery/v1`; final BC/Vancouver interpretation, courier/common-carrier distinctions, age rules and permitted delivery/return windows must be confirmed by 420Compliance policy and legally reviewed at rollout. No hard-coded license grants. All unsupported regions remain inactive.
- Role-scoped rate limits, document size limits, max active assignments, quote TTL, route TTL, consent TTL and availability expiry are **configurable unapproved values**, not invented production thresholds. Safe default: deny if unset, unsupported, invalid or expired.
- Public presence must be coarse, aggregated, freshness-bound and privacy-preserving; no actual courier counts below the anonymity threshold. Operator monitoring is more detailed only under least privilege; production debugging must redact identity, location and financial secrets.
- Courier GPS and customer location handled encrypted off-chain with disclosure only during active assignment; disable background tracking outside required active route consent. Wallet disconnect or permission revocation cannot leave a privileged live session.
- All regulated fulfillment, production payout, live provider access and private address display remain disabled until independently approved and qualified. No promotional/public checkout functionality is implied by UI design.
- 420Compliance governs eligibility policy, 420Identity/Verify credentials, 420Pay settlement, Dev Compensation Vault eligible net revenue, Arbitration final remedies, 420Location discovery. No local competing source of authority.

## Requirements and qualification
R01.3 deliverables: role/permission matrix, six canonical journey descriptions, lifecycle state and permission boundaries, eighteen adversarial scenarios, safety/operating limits and explicit future test ownership. This step adds documentary design, not active endpoints. Scoped Level 1 verifies these requirements with assertions against the exact implementation SHA; R01.8 Level 2, R05.10 Level 3, DOOBR-AUDIT-9/10 external tests remain deferred.
Next canonical step: **R01.4 BC/Vancouver legal matrix, three carrier classifications, eligibility and 420Compliance-owned policy versioning; written regulatory-review questions and dependency contract.**
