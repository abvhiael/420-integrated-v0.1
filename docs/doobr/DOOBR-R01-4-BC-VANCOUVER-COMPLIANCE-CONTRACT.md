# DOOBR R01.4 — BC/Vancouver regulatory matrix and 420Compliance dependency contract
Status: Level 1 pending. Canonical step unchanged: **R01.4 BC/Vancouver legal matrix, three carrier classifications, eligibility and 420Compliance-owned policy versioning; written regulatory-review questions and dependency contract.**
Baseline main `c5a4f220d1fbda01f707d359aa9bb32921a138b1`; PR #601. **Engineering specification, NOT a legal opinion, licence or live delivery authorization.** Reviewed BC government delivery guidance (last updated 2024-09-19), current consolidated Cannabis Licensing Regulation, and City of Vancouver cannabis retail licensing information (accessed 2026-10-09). Check revisions and authoritative handbook before any release.

## Primary authority / sourcing
- [BC cannabis delivery guidance](https://www2.gov.bc.ca/gov/content/employment-business/business/liquor-regulation-licensing/cannabis-licences/cannabis-resources-information/delivering-cannabis): preparation, permissible delivery agents, Selling it Right, prepaid sales, hours, handoff, exceptions, record retention.
- [Cannabis Licensing Regulation — current consolidated](https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/202_2018): retail store regulations, delivery classes, 9–23 limitations applicable to employee/delivery-person; signature.
- [BC Cannabis Control and Licensing Act](https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/18029): sale/supply authorization and carrier boundaries.
- [Vancouver cannabis retailer municipal licence](https://vancouver.ca/doing-business/cannabis-retail-dealer-business-licence.aspx) and [licence application process](https://vancouver.ca/doing-business/cannabis-retail-dealer-business-licence-applicants.aspx): existing retailers must hold provincial plus municipal permissions; does **not** establish DOOBR courier company licence class.
- Regulatory facts here are dated source-derived design candidates; legal/policy owner in 420Compliance must approve final executable interpretations and independent carrier model.

## Carrier class matrix — no collapsing distinct requirements
| Classification | Eligibility/transport | Place, time, evidence and return |
| --- | --- | --- |
| `LICENSEE_EMPLOYEE` | Retail licensee or employee; verify current retailer authority and required licence copy carried for delivery; employee is not automatically DOOBR's independent courier | BC retailer-origin order; 9:00–23:00 unless narrower restriction; purchaser-designated BC address or immediately outside retail store (curbside) as permitted; adult recipient name/signature. Failed delivery by employee must return to originating store same day. |
| `DELIVERY_PERSON` | Independent delivery person aged 19+; valid Selling it Right certificate; signed qualified relationship to licensee; verify expiry/revocation | 9:00–23:00 unless narrower restriction; designated BC delivery address, **not employee-only curbside privilege**; adult recipient name/signature. Failed delivery must return to originating store **same day**. |
| `COMMON_CARRIER` | Common carrier aged 19+ and qualifying under applicable legal classification and licensee contract; Selling it Right is specified for delivery persons, do not silently extend or waive common carrier requirements | BC-only and any local hours/restrictions; driver-inaccessible cannabis during vehicle travel, federally compliant packaging; name/signature. Failed carrier delivery must return to originating store, but may be on same or another day. Do not blindly apply the delivery-person 9–23 statutory clause without checking handbook/local rules. |

## BC/Vancouver legal requirement -> DOOBR policy + test map
| ID | Source-derived requirement / acceptance owner | Planned application guard and negative test |
| --- | --- | --- |
| BC-01 | Licensed CRS/PRS retailer remains original seller; Vancouver retailer requires provincial and municipal authorizations | DENY retailer unlicensed, suspended, wrong premises, or unverified municipality; seller-of-record immutable |
| BC-02 | Retail licensee/employees prepare order inside the originating licensed store, securely packaged/closed/contents not visible | DENY wrong originating store, unsealed pickup or package mismatch |
| BC-03 | Retailer must receive payment before departure; disclose product and delivery fee when ordered; courier cannot charge extra at door | DENY unpaid sale, double service fee, unauthorized doorstep payment; 420Pay only when separately approved; protect retailer funds |
| BC-04 | Delivery within BC; local government/Indigenous laws may narrow time/place rules | DENY interprovincial destination, unapproved municipal zone, absent effective policy; record source/effective version |
| BC-05 | Delivery-person/employee 9:00–23:00 time constraints, subject to narrower applicable limits; other carrier rules separately validated | Boundary 08:59,09:00,22:59,23:00 and DST using `America/Vancouver`; prohibit incorrect common-carrier inheritance |
| BC-06 | Minimum age 19 for delivery person/common carrier and recipient adult; cannot supply to minor or visibly intoxicated recipient | DENY expired/absent age or ineligible recipient, regardless of wallet claim |
| BC-07 | Delivery person must have valid Selling it Right certificate; courier classification verified | DENY forged, expired, wrong-category certificate; revalidate before handoff |
| BC-08 | Required recipient name and signature; adult delegate may accept where permitted | DENY missing/forged name/signature, unattended drop or mismatched recipient |
| BC-09 | Failed delivery by delivery person/employee returns to original retailer same day; common carrier return may differ | DENY false DELIVERED, enforce `RETURN_REQUIRED`; per-category deadline and evidence |
| BC-10 | Cannabis sale transaction limit 30g dried/equivalent | DENY over-limit or missing verified retailer quantity/equivalence |
| BC-11 | Licensee delivery records: dates/times, courier/provider, address, each product quantity/price, delivery fee, recipient name/signature and carrier contracts | Generate encrypted restricted evidence; support six-year retention with separate cancellation/transfer exception validation and privacy rules |
| BC-12 | Minor cannot be in vehicle; common-carrier in-motion inaccessibility and federal packaging | DENY or investigate unsafe transport/packaging, class-specific custody requirements |
| BC-13 | Courier/carrier cannot solicit additional products; cannabis marketing subject to federal restrictions | DENY upsells, unrestricted public promotions or cross-selling in workflow |
| VAN-01 | Vancouver retail zoning/development permit and municipal business licensing are separate from courier-company authority | Require retailer evidence; mark DOOBR business classification and local licensing **UNRESOLVED** until City response |
| FIN-01 | Canonical application revenue policy and `DevelopmentCompensationVault420`, rather than BC cannabis sale itself, govern fee allocation | No gross-sale skim, independent escrow or unauthorized fee route; reject duplicated revenue references |

**Privacy:** Full delivery addresses, GPS traces, identity documents, recipient names/signatures and sales records stay encrypted off-chain and never appear in Travel/Maps/Search public projections or on-chain commitments. Regulator/retailer retention obligations require controlled access and erasure exceptions.

## 420Compliance-owned decision interface (proposed, NOT deployed)
Authority: the parallel 420Compliance service owns legal source registry, signed immutable policy versions, jurisdiction inheritance, effective/expiry/revocation dates and decision signatures. DOOBR is a consumer of verified decisions and cannot override them. A public availability projection is never a dispatch authorization.

**Request `ComplianceEvaluateDelivery/v1`:** `request_id`, `tenant_id`, `action` (`DISCOVER|QUOTE|DISPATCH|PICKUP|HANDOFF|RETURN`), `service_category`, `origin_country/province/municipality/zone`, `destination_country/province/municipality/zone`, IANA `timezone`, event UTC timestamp, `carrier_class`, qualified opaque retailer/courier credential references and status snapshots, package aggregate product equivalent, originating retailer purchase/payment-proof reference and audience/client identity. No plaintext customer name, street address, identity document or GPS in service-to-service logs; scope opaque references to least privilege.

**Response `ComplianceDecision/v1`:** `decision_id`, `request_hash`, `scope`, `ALLOW|DENY|UNKNOWN`, stable `reason_codes[]`, `policy_id`, `policy_version`, source-citation/effective-window references, `issued_at`, `expires_at`, `revocation_epoch`, `issuer_key_id`, verifiable signature and permitted actor/scope. `ALLOW` alone does not grant retailer authorization, payment finality or physical courier competence. Acceptance must verify signature, issuer, nonce/idempotency, bound request/tenant/action/jurisdiction, expiry, revocation and material state changes. `UNKNOWN` is never `ALLOW`. Refresh at DISPATCH and HANDOFF and on credential/policy change. All errors/timeout/unsupported jurisdiction/clock ambiguity/replay -> **fail closed** for new fulfillment; in-flight jobs enter safe regulated exception/return rather than blanket cancellation.

**Public `ComplianceCoverage/v1`:** distinct coarse, approved jurisdiction/service-category eligibility, not courier count or order authorization. 420Travel/Maps may combine separately approved public 420Compliance projection with DOOBR coarse `AVAILABLE|LIMITED|UNAVAILABLE|UNKNOWN` and deep-link only; retain freshness/anonymity thresholds. No address, GPS, order or age proof is published.

**Version control:** canonical hierarchy country -> province/territory -> municipality -> service zone; explicitly precedence-resolved and policy-signed by 420Compliance. DOOBR persists decision reference/version, expiry, reason and approval evidence for audit, but not its own editable regulatory policy. New BC municipality or province requires policy review, capability/licence checks, contract tests, staged disabled-by-default enablement, legal/operator approval and rollback.

## Written regulator / legal review questions (unanswered = launch blocker)
1. Can DOOBR operate as a third-party **delivery person** platform across multiple independent Vancouver licensed retailers under each licensee's custody and contract, or does the dispatch operator itself need additional provincial authorization?
2. What differentiates delivery person from **common carrier** for DOOBR's proposed bicycle, vehicle and gig-economy workforce; can a single business support both without role confusion?
3. Which exact Vancouver municipal business-licence classification(s), delivery-hour bylaws, insurance, labor and premises requirements apply to DOOBR independently of the retailer's cannabis retail licence?
4. Which worker identity/age/Selling it Right checks and source-of-truth revocation refresh are acceptable, and what evidence must a retailer retain?
5. What is required for age, intoxication, name and signature verification of a delegate adult, including electronic signatures and accessibility contingencies?
6. Do local government or Indigenous Nation regulations restrict courier hours or destination zones beyond the province baseline? Does the common-carrier exception change permitted timing for our operating model?
7. How should same-day return obligations work at 23:00 cutoff, courier outage, inaccessible retailer, adverse weather, parcel loss or police seizure?
8. Must records be retained six years after delivery, and how do cancellation/transfer, privacy erasure requests, retention clocks and proof redaction interact?
9. What are the permitted arrangements for a separately billed platform fee, retailer-billed delivery charge, courier compensation, card/crypto rails and 420 Integrated Labs eligible net revenue routing; which payment methods are lawful and acquirer-supported?
10. Which public DOOBR/Travel/Maps regional-availability notices or referral deep links constitute restricted cannabis advertising/promotion?
11. Which contract and insurance allocations are required among seller of record, DOOBR dispatch operator, independent contractor, delivery person and common carrier?
12. Who owns regulatory updates, effective-date legal signoffs, incident reporting, regulatory audits and policy emergency disablement across BC and later provinces?

## Boundary / step disposition
**R01.4 deliverables:** [x] BC and Vancouver source/legal matrix with dated URLs and test IDs; [x] differentiated `LICENSEE_EMPLOYEE`, `DELIVERY_PERSON`, `COMMON_CARRIER` matrix; [x] explicit eligibility, dispatch/handoff, returns, record/privacy constraints; [x] 420Compliance-owned signed versioned request/decision/public projection draft; [x] written open regulator questions and launch gates. [ ] Targeted exact-head Level 1 source assertions and workflow PASS.

No live integration, regulator signoff or definitive legal determination is claimed by passing this documentary step. R01.8 Level 2 and R05.10 Level 3 are intentionally deferred; DOOBR-AUDIT-9 and -10 remain testnet/external gated. Next canonical **R01.5 Protocol authority contracts, 420Compliance decision-adapter contract, and protected 420Travel/Maps read-only presence integration.**
