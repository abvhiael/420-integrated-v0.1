# BNB-1.4 — Protocol Authority and Integration Boundaries

**Status:** Architecture contract, not a deployed adapter or protocol authorization.  
**Prior:** BNB-1.1 source inventory; BNB-1.2 product journeys; BNB-1.3 domain model and M1 checks. **Next:** BNB-1.5 — Payment and Settlement Architecture.  
**Release guard:** `travel.bnb_booking=false` and `bnb_compatibility.enabled_at_genesis=false` remain mandatory. No modification to frozen Genesis decisions or system addresses.

## 1. Canonical authority model

BnB is a replaceable, off-chain-first accommodation marketplace, not a new chain protocol. Once independently authorized, BnB may own property-specific listing drafts, unit capacity, calendar holds, quote acceptance, booking workflow, policy snapshots and its reservation state machine. These **application** records cannot determine protocol-owned payment finality, verified identity, Registry records, attestations, arbitrated remedies or on-chain custody. Discovery caches, client state, notifications and analytics are derived and never authoritative for booking inventory.

| Integration | Canonical source / repository evidence | Allowed BnB adapter responsibility | Explicit boundary and fail-closed case |
| --- | --- | --- | --- |
| 420Travel | `docs/genesis-services/GEN-SVC-3-TRAVEL.md`, `genesis/svc3/travelapp/compatibility.go` | Discovery handoff for destination/place IDs and public listing projection; versioned planning reference | `travel-compat/v1` objects do not create listings, quotes, payments or reservations; `GenesisTravelTransactions` always disabled |
| 420Location | `docs/genesis-services/GEN-SVC-0-ROADMAP.md`, GEN-SVC-3 | Resolve public place identifiers and location precision | BnB does not confer rights to a place or expose exact private rental coordinates |
| 420Identity | GEN-SVC-0 shared authority; Travel session boundary | Independently verify host/guest session audience, expiration, revocation, identity principal and authorization at each write | A client-supplied identity ref, stale token or public profile does not verify host ownership |
| 420Registry | GEN-SVC-0; `docs/apps/pay/deployment-operations.md` | Resolve approved service records, versioned manifests and provenance | Registry discovery is not licensing, endorsement, hosting authority or an address guessed from a UI |
| 420Verify | GEN-SVC-3 provenance | Display appropriately scoped attestations with issuer, validity and expiry | A Verify badge does not create legal compliance, property control or Registry authority |
| 420Names | GEN-SVC-0 identity and service conventions | Optional display resolution after authenticated canonical principal binding | Name collision, reassignment, wrong chain or stale resolution cannot change host or payout beneficiary |
| 420Wallet | `docs/commerce/COM-1.5-ECOSYSTEM-ADAPTER-DESIGN.md` | Present user-approved signatures and chain-aware transaction requests | Wallet connection does not equal Identity verified session, payment finality or unlimited approval |
| 420Pay | `contracts/src/pay/PaymentRouter420.sol`, Pay deployment runbook, Commerce integration design | Create approved financial intent and reconcile canonical invoice/payment/refund/payout references | BnB API/host/moderator cannot mark finality, transfer user assets, or use hardcoded Pay deployment addresses |
| 420Swap | Commerce integration design and Pay canonical settlement adapter | Only use permitted quote/execution path via approved Pay authority where supported | No synthetic FX, expired quote, route substitution, unlocked slippage or unverified receipt |
| 420Arbitration | GEN-SVC-0 moderation; Commerce integration design | Submit evidence/cases; consume authorized outcomes for BnB policy transitions | Moderator or support action cannot itself move funds; evidence alone not finalized remedy |
| 420Reputation | `docs/genesis-services/GEN-SVC-3-TRAVEL.md`, `genesis/svc3/travelapp/reputation_adapter.go` | Submit/consume domain-scoped verified stay evidence, reviews, host responses and moderation outcomes | BnB cannot mint verified review interactions, overwrite subjective ratings or equate ratings with 420Trust |
| 420Notifications | GEN-SVC-0 service conventions | Idempotent, privacy-filtered booking and host alerts after authorized source events | Notification sent/read is not reservation or settlement acknowledgment |
| 420Search / 420Analytics | GEN-SVC-0 public visibility and provenance conventions | Public listing discovery, aggregated telemetry and reversible indexes | Stale search index cannot promise inventory; neither index nor analytics stores unredacted private address or guest data |
| 420Storage / 420Rights | GEN-SVC-0 on/off-chain split | Media references with scoped access and ownership/license attribution, where service contract adopted | Media upload is not proof of property title; do not publish personal documents or unlock restricted media |
| 420Governance / Treasury | Frozen Genesis authority and Pay deployment runbook | Read separately approved platform fee/policy and governance actions | BnB operator policy does not replace Timelock decisions or confer treasury spending power |
| Oracle Interface Layer / 420Bridge / 420Compute | Future conditional adapters | Only where an approved pricing, proof, conversion or compute flow actually needs them | No assumed cross-chain booking or settlement, no unverified oracles, no implicit chain authority |
| 420Events / DOOBR | GEN-SVC-3 boundary | Optional nearby-events descriptions / separate delivery-service links | An accommodation booking does not provide cannabis delivery or ticketing authority |

## 2. Normative adapter envelope and service ownership

Proposed future `bnb-api/v1` adapters carry `schema_version`, `source_service_id`, `source_version`, `chain_id` where applicable, `principal_ref`, `aggregate_id`, `request_digest`, `idempotency_key`, `issued_at`, `expires_at`, `authority_proof_ref` and `correlation_id`. No interface is represented as already deployed; wire-format details remain subordinate to the canonical owning service and BNB-1.6. Each authority-bearing proof must bind subject/action/resource/amount/asset/network and replay domain as applicable, rather than trust an arbitrary HTTP callback body.

**Proposed adapter operations:** `ResolvePublishedPlace`, `VerifyGuestSession`, `VerifyPropertyController`, `ResolveServiceManifest`, `ResolveListingReputation`, `RequestPaymentIntent`, `VerifyPaymentFinality`, `RequestRefund`, `ResolveRefundFinality`, `ResolveHostPayout`, `OpenArbitrationCase`, `ResolveBindingDecision`, `EmitNotification`, `PublishPublicListingProjection`. Their implementation, schemas, ABI compatibility, capability requirements and live-service qualification remain for BNB-1.5–1.10. No invented Registry service ID or deployed address is established by these names.

## 3. Cross-service journey sequencing and proof

1. **Publication:** authenticated host → independently verified property/controller authority → scoped listing draft/policy → authorized publication → public Search/Travel projection. Provenance and location-visibility filters must execute before indexing.
2. **Booking:** authenticated guest → authoritative capacity read and atomic hold → versioned binding quote → user approval → approved Pay intent → finality proof reconciliation → CONFIRMED. Network inclusion/receipt without finality must stay pending. Multiple instances cannot create competing holds.
3. **Cancellation/refund:** binding cancellation policy snapshot → authorized case decision → BnB inventory/lifecycle reconciliation → Pay-approved refund request and finality → accurate UI status. Failed Pay or Arbitration does not produce a fictitious settlement.
4. **Host payout:** settled stay/eligibility → approved Pay payout controller and verified beneficiary → canonical payout result → derived dashboard. A host edit cannot rewrite the recorded beneficiary or settlement history.
5. **Review/dispute:** independently verified stay interaction → Reputation review eligibility; dispute goes to Arbitration with provenance and separately authorized Pay remedy. Moderation does not adjudicate chain settlement.

## 4. Failure, replay and threat contract

Every adapter must reject unknown service/ABI/chain; mismatched resource IDs, principals or payout beneficiaries; expired/revoked credentials; stale listing revisions or policies; unsigned or replayed callbacks; synthetic receipts; late payment after hold expiry; unauthorized public disclosures; and mismatched settlement totals. External read failure cannot be silently replaced by a mock-derived 'verified' response. Writes require bounded retry, immutable idempotency identity and deduped outbox delivery; use `UNAVAILABLE`, `UNAUTHORIZED`, `STALE_REVISION`, `EXPIRED`, `CONFLICT`, `PROOF_INVALID`, `FINALITY_PENDING`, `WRONG_ASSET`, `POLICY_BLOCKED` and `SETTLEMENT_FAILED` as suggested machine-readable classes pending BNB-1.6 canonical API reconciliation. All sensitive audit payloads must be redacted.

## 5. Open authority and deployment decisions

**Still unverified / explicitly blocked:** a published BnB Registry service identity, actual typed adapters or deployed BnB APIs, production equivalent Identity session authority, property-control and regulatory validation, authoritative venue inventory database, canonical Pay/Swap live addresses and receipts, approved escrow and refund settlement governance, real Arbitration finality, public-review interaction proof, authorized public/private location release rules, DNS/server deployment and external integrations. No new address or Genesis catalog promotion is claimed. These are tracked to BNB-1.5 through BNB-1.10 and testnet as applicable.

**Frozen boundaries:** `config/genesis-applications.json` remains unchanged. `config/genesis-consumer-services.json` is not promotion authority. The static Travel compatibility types remain structurally unchanged and `GenesisTravelTransactions` must reject all booking/payment/escrow routes.

## 6. BNB-1.4 acceptance and traceability

| ID | Authority requirement | Corresponding test obligation |
| --- | --- | --- |
| BNB-A01 | Travel / Location discovery is nonbinding | No fabricated listing or reserve on Travel compatibility |
| BNB-A02 | Independent Identity/Registry/Verify/Names resolution | Reject spoofed, expired, revoked or wrong-controller proof |
| BNB-A03 | Wallet and chain binding | Reject wrong chain, missing consent, expired capabilities |
| BNB-A04 | Pay/Swap ownership and economic finality | Reject unfinalized receipts, wrong beneficiary/asset, replay |
| BNB-A05 | Arbitration/refund/payout authority | No host/moderator-controlled remedy or double payout |
| BNB-A06 | Reputation and proof boundaries | No self-verified review or reputation ownership |
| BNB-A07 | Search/Analytics/Notifications are derived | No stale/unauthorized public inventory projection or PII leak |
| BNB-A08 | Storage/Rights and privacy | No private address/credential/document publication |
| BNB-A09 | Governance, address and frozen catalog | No unreviewed address, authority or application promotion |
| BNB-A10 | Typed adapter security and degraded mode | Domain/replay/idempotency/provenance/failure-path checks |

**BNB-1.4 exit:** document authority for every material dependency, expected adapter calls and trust edges, required authorization/finality/replay/error checks, proof and data-privacy boundaries, unresolved decisions and BNB-A01–A10 acceptance obligations. Level 1 validates this exact source-bound architecture; no Level 2 rerun at this ordinary step (M2 occurs after BNB-1.5). Phase-wide Level 3 only at BNB-1.10.

**Next canonical step:** BNB-1.5 — Payment and Settlement Architecture.
