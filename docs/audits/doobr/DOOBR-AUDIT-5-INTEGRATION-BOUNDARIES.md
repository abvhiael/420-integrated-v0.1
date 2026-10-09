# DOOBR-AUDIT-5 — separately authorized service and integration contract

Status: **architecture scope reconciled; independent service not approved for deployment**
Date: 2026-10-09
PR: #598
Inspected main: `f8bbb62e1cdfe68cff25261fd4a036db1840a15c`
Qualification: Level 1, documentary governance boundary and machine-checkable invariants.

## Controlling authority
- `config/genesis-applications.json` freezes application decision v9. DOOBR has no Genesis application approval.
- `config/genesis-consumer-services.json` is a non-promoting registry and does not register an independent DOOBR service. `travel.doobr_transactions` defaults `false`.
- `config/420travel-genesis.json` reserves DOOBR schema hooks but disables transactions.
- `genesis/svc3/travelapp/compatibility.go` owns four versioned structural records and an unconditionally fail-closed transaction gateway.

**Decision: preserve current authorized compatibility-only scope.** The audit cannot invent a governance approval or activate regulated delivery or financial authority. Independent DOOBR functionality is a separate proposed post-Genesis application, requiring explicit approval before execution or main deployment; a future Genesis-facing entry also requires a separate frozen-catalog decision.

## Proposed independent service boundary (conditional; NOT authorized)
- Application service owns customer/dispatcher UX, provider marketplace listings and an off-chain request workflow; it does not own chain identity, credentials, regulated status, canonical locations, payments, escrow, settlement or arbitration.
- Stable service ID and namespace require governance and registry collision checks before registration. **No ID is reserved or committed by this document.**
- API is proposed as versioned `/v1` endpoints with authenticated scopes, opaque ids, idempotency keys, strong ETags, replay protection and explicit 403/409/422 states; **no live routes currently claimed**.
- Workflow states proposed: drafted -> eligibility_checked -> submitted -> provider_accepted -> fulfillment_in_progress -> delivered/declined/cancelled/expired/disputed. Transitions must be persisted and authorization checked per transition; proposed lifecycle is not an existing contract.
- No delivery service can act on compatibility-only `ServiceRequest`; it must verify separate authorization, provider availability and qualified legal jurisdictions.

## Dependency & permission contract

| Domain | Proposed owner / dependency | Preconditions for any live operation | Rejection/failure path | Present status |
| --- | --- | --- | --- | --- |
| Location / service area | 420Location and jurisdiction policy | canonical public place ref; coarse display geography; independent restricted-location validation | private address excluded from index; fail closed on unsupported region | Travel planning only |
| Identity and age | 420Identity + credential/verification authorities | nonrevoked authenticated identity, age eligibility where relevant, explicit role and consent, live revalidation | no order or provider assignment on missing/expired/revoked proof | Not integrated |
| Provider registration | Registry/Verify plus regulator/license provenance | owner control, licensing/permit status, expiry and jurisdiction; independent credential source | provider disabled, pending work stopped on revocation | Not integrated |
| Payment authorization | 420Pay, approved Wallet routes and authorized Swap only if qualified | priced order snapshot, explicit consent, currency/amount limits, idempotent authorization; no implied custody | timeout/replay/underpayment -> no fulfillment | Not integrated |
| Escrow/refund/dispute | approved payment/custody and 420Arbitration services | explicitly authorized contract and independent remedy roles; conservation and reconciliation | freeze or return funds through original authorized rail | Not integrated |
| Dispatch/delivery | regulated delivery provider and jurisdiction policy | eligible dispatcher/courier, verified handoff, legal geographic/time windows | cancel/expire/safely stop on failure or revocation | Not integrated |
| Notifications | 420Notifications | authorized recipients and minimal event payloads; no leaked private addresses | failed delivery cannot imply order success | Not integrated |
| Search / privacy | 420Search, 420Indexer projections | only public approved provider metadata; no private requester/location/identity leakage | removal/revocation propagation and tombstones | Not integrated |
| Reputation / audit | 420Reputation, verification receipts | provenance and independently verified fulfillment; subjective reviews not trust authority | dispute/forgery/replay protections | Not integrated |

## Mandatory security, data, and settlement invariants
1. Travel Genesis `GenesisTravelTransactions` **always** fails closed, irrespective of input or feature flags.
2. Nothing in compatibility records, location listings, reviews or claims grants legal/provider/identity/payment authority.
3. Every request transition must be authorized against fresh identities/roles and revocation policy; failed, stale or repeated authorization cannot progress workflow.
4. Duplicate/replayed payment or delivery messages cannot cause duplicate charges or assignments. Every movement of funds must reconcile to canonical receipt and independently authorized settlement.
5. Privacy by default: off-chain private address, sensitive location, proofs and contact information; never surface them in public Search/Indexer payloads.
6. No execution in unapproved jurisdictions; regulations, age verification and licensing require jurisdiction-by-jurisdiction counsel/operator acceptance before rollout.
7. Cancellation, partial fulfillment, refund, timeouts, disputes, appeal, recovery and unauthorized-provider negative cases need integration and adversarial tests before release.
8. External adapter status/claimed proof must never substitute for live independent eligibility acceptance.

## Release gates and authorization decision
- **Current stage:** documentation/compatibility only, with transaction execution disabled. No deployable standalone DOOBR service or authority is claimed.
- **Pre-implementation governance:** product scope and target jurisdiction, risk/legal owner, catalog classification, service ID/namespace, dependency contracts, allowed money flows, data retention and privacy policy, provider credential trust root. These are separate approvals, not inferred.
- **Pre-testnet:** contracts/interfaces, authenticated requests, durable storage, negative/adversarial/regression tests, independent identity/credential/payment adapter proofs, observability, disaster recovery and qualified exact SHA.
- **Pre-production:** actual live regulator/provider eligibility, age checks, charge/refund/escrow receipts, jurisdiction acceptance, end-to-end field trials, operator runbooks, security audit and explicit launch approval.
- **No testnet requirement to complete this documentation-only DOOBR-AUDIT-5 step.** Future live adapters and acceptance are testnet/external gated.

## Gap disposition
Canonical compatibility/fail-closed boundaries — satisfied by current source; dependency map and proposed independent service interfaces — documented here. Independent DOOBR approval, executable adapters, licensed delivery and live receipts — **not approved / not implemented**, not a failing requirement of the current compatibility-only scope. Never mark a standalone DOOBR production service COMPLETE on the strength of this audit.

Level 1 proof must verify unchanged frozen/config authority and this decision contract against one exact SHA. Level 2 is reserved for a future implementation milestone, Level 3 for full app-phase closure. Full repository Foundry and duplicated Genesis inventory are outside this step.

## DOOBR-AUDIT-5 exact-SHA Level 1 qualification

**Status: COMPLETE — architecture and conditional integration definition only.**
- Qualified implementation/workflow SHA: `84742f4608be6d559ae583cafa5861354d453582`.
- GitHub Actions: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37995990630
- Job `scoped-qualification`: SUCCESS, no failed steps.
- GEN-SVC-0 and GEN-SVC-3 validators: PASS.
- DOOBR AUDIT-2 architecture authority verifier: PASS.
- DOOBR AUDIT-5 integration and governance verifier: PASS.
- Noncached compatibility and fail-closed regression tests: PASS.
- Scoped GEN-SVC-3 Go tests, vet, build: PASS.
- Exact checkout SHA assertion: PASS.
- Files implemented: this document, `scripts/verify-doobr-audit-5.py`, scoped workflow amendment.
- Inspected main: `f8bbb62e1cdfe68cff25261fd4a036db1840a15c`.
- Level 2: not required for documentation governance step; Level 3: deferred to full audit-phase closeout.
- Security condition: no delivery, payment or identity adapter was enabled. Independent DOOBR launch remains blocked on explicit authority and external qualification.
- Unrelated Cloudflare Worker failures and broad global suites are outside the Level 1 coverage.
