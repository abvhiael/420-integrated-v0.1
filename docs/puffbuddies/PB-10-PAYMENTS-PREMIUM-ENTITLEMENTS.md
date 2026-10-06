# PB-10 — Payments and premium entitlements

## Purpose
Implement PuffBuddies premium-entitlement policy over canonical current 420Pay settlement evidence while preserving the absolute separation between economic state and interpersonal consent, eligibility, lifecycle, block/safety authority and protected-user data.

420Pay owns payment settlement/accounting truth. PuffBuddies owns only the product-specific conclusion that a bounded convenience/presentation feature entitlement is currently active.

## Promoted PB-0.2 premium subset
PB-10 promotes the safe entitlement layer for:
- paid advanced filters;
- liked-you views;
- incognito/premium visibility controls;
- profile customization;
- paid undo/rewind;
- cosmetic convenience features.

Subscriptions may bundle these feature entitlements.

PB-10 does **not** implement the PB-11 UI/runtime mechanics of those features. Any later use of an entitlement must still pass the owning profile/discovery/relationship/safety authorization at action time.

Growth/ranking/location products such as boosts, priority placement, super-like paid attention signals and travel/passport behavior remain deferred until a later explicit ranking/location design establishes their non-coercive mechanics.

## Canonical requirements
1. 420Pay remains canonical owner of payment/settlement evidence.
2. PuffBuddies remains canonical owner of product-specific premium entitlement conclusions.
3. PB-10 consumes only current 420Pay payment lifecycle evidence and never creates a contradictory payment truth.
4. A payment grants entitlement only when status is SETTLED.
5. SUBMITTED, INCLUDED, CERTIFIED, FINALIZED, FAILED, REFUNDED or PARTIALLY_REFUNDED do not grant a fresh entitlement.
6. Any refund or partial refund revokes the affected entitlement under current PB-10 policy.
7. Payment evidence must bind the exact approved invoice, PuffBuddies merchant, settlement asset and settlement amount for the offer.
8. A transient private profile→payer binding must match the canonical payer for the payment.
9. Profile→payer/wallet linkage is operation-scoped only and must not be persisted in PuffBuddies entitlement state.
10. 420Pay outages/missing evidence fail closed for grant/reconciliation.
11. Future/stale payment observations fail closed.
12. Premium policy version is PuffBuddies-owned; a stale policy cannot remain active merely because 420Pay still reports SETTLED.
13. Entitlements are time-bounded and expire fail-closed.
14. Entitlement persistence stores profile, feature, non-sensitive offer ID, state, policy/source versions, issuance/expiry and version only.
15. Entitlement persistence excludes payment ID, invoice ID, payer/wallet address, receipt hash, settlement asset/amount and transaction history.
16. Optimistic concurrency prevents stale entitlement writes.
17. Premium/payment state cannot create a like, reciprocal match, unblock, rematch, ordinary messaging authorization or consent.
18. Premium/payment state cannot activate/reactivate, unsuspend, unban or cancel deletion.
19. Premium/payment state cannot bypass current block, safety, eligibility, lifecycle, visibility or deletion authority.
20. Premium/payment state cannot buy access to another user's private preferences, precise/coarse protected location, messages, matches, blocks, reports, moderation/safety state or restricted profile fields.
21. Premium must not convert a cannabis preference/compatibility into sale/purchase/delivery/brokering authority.
22. Wallet balance, token holdings, stake, spending or payment history cannot become discovery desirability/reputation signals.
23. The free/core safety and consent journey remains non-premium: matching, matched messaging, block, report, unmatch, deactivation and deletion cannot require premium.
24. Liked-you/undo/incognito/advanced-filter entitlements grant only feature availability; the underlying data/action remains subject to current canonical authorization.
25. Payment success does not create notification, Messenger, profile, discovery or relationship state.
26. No PuffBuddies payment contract, escrow/date marketplace, tokenized dating identity, fixed Pay address, new Pay service ID, provider credential, production billing backend or live deployment is introduced.

## 420Pay dependency
PB-10 consumes repository-qualified 420Pay V1 lifecycle semantics:
`NONE, SUBMITTED, INCLUDED, CERTIFIED, FINALIZED, SETTLED, REFUNDED, PARTIALLY_REFUNDED, FAILED`.

The canonical service ID remains `420/service/pay/v1`. PB-10 does not change 420Pay contracts, manifests, Registry publication or deployment state.

## Qualification
PB-10 requires:
- **Level 1** exact-head PuffBuddies targeted qualification;
- **Level 2** retained app integration because PB-10 introduces the material 420Pay→PuffBuddies entitlement authority boundary;
- direct static 420Pay interface verification with `scripts/verify-420pay-audit.py`.

Level 2 remains app-focused. No full Foundry/Genesis/global inventory is duplicated.

## Affected components
- `puffbuddies/domain/premium_entitlements.py`
- private `entitlement` persistence schema
- existing PuffBuddies authorization/lifecycle boundaries
- canonical 420Pay V1 lifecycle as read-only dependency
- PB-10 targeted/integration tests and workflow
- roadmap/PB-0.19 reconciliation
- durable qualification evidence

## Dependencies
PB-0.2, PB-0.3, PB-0.4, PB-0.5, PB-0.7, PB-0.8, PB-0.9, PB-0.10, PB-0.12, PB-0.13, PB-0.14, PB-0.16; PB-1 persistence; PB-2/PB-5/PB-8 authorization/lifecycle/safety; **PB-9 — Verification and reputation — COMPLETE**; canonical 420Pay repository implementation.

## Exit criteria
Exact SETTLED evidence can grant only approved bounded feature entitlements; non-settled/refunded/mismatched/stale evidence fails or revokes; policy/lifetime expiry revokes; private persistence has no payment/wallet linkage; lifecycle/block/consent/safety remain supreme; no purchased private-person access exists; direct Pay verifier passes unchanged; targeted Level-1 and Level-2 integration plus retained PuffBuddies regressions pass on one exact SHA; durable evidence is recorded.
