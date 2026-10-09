# HZ-GCA-1.9 — Generation economics

Status: **IMPLEMENTED — Level 1 economics definition**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Machine-readable policy:

`hz/config/gca-generation-economics-v1.json`

This step freezes 420Hz Generate economics without creating new custody, Vault, settlement or pricing authority.

## Economic authority

420Hz may present price/capacity information and orchestrate the user flow.

Canonical authority remains with:

- 420AI for AI request/max-spend semantics;
- ComputeMarket for offers, accepted price, provider/resource/beneficiary, verification and job economics;
- Vault/settlement for actual funding, claimability, payout and refund movement;
- Wallet/SmartAccount for explicit payer authorization.

Native **$420** remains the default Genesis compute settlement asset in the existing AI/Compute architecture.

420Hz does not custody generation funds.

## Economic state model

The product distinguishes:

`ESTIMATE → QUOTED → AUTHORIZED_MAX → FUNDED → ACCEPTED_PRICE → VERIFIED_EARNED → PROVIDER_CLAIMABLE → PROVIDER_PAID`

and the payer residual/refund path:

`PAYER_REFUNDABLE → PAYER_REFUND_CLAIMABLE → PAYER_REFUND_PAID`

with **DISPUTE_HOLD** as a bounded hold classification, not newly created value.

These states are deliberately separate.

A quote is not funding.

Funding is not accepted price.

Accepted price is not provider earning.

Verified earning is not provider payment.

Refundable is not refunded.

## ESTIMATE / QUOTED

ESTIMATE is a non-binding preview.

QUOTED is a versioned, expiring application quote snapshot for the exact GenerationIntent.

A quote must bind enough context to make its meaning unambiguous, including:

- request/intent commitment;
- model/version or capability class;
- workload controls materially affecting price;
- privacy and verification profile;
- pricing policy/version source;
- amount or range;
- maximum shown to the user;
- settlement asset;
- expiry;
- source timestamp/reference.

QUOTED creates no provider capacity reservation, funding, accepted match, entitlement or payout.

A material request change, stale provider/resource revision, quote expiry or incompatible privacy/verification/capacity change requires re-quote.

## Payer authorization and funding

The payer maximum must be explicit and bounded for the exact request.

420Hz must not use an unbounded legacy max-spend path for paid Generate.

Requester and payer may differ only with independent payer authorization.

Actual FUNDED state requires canonical job-specific payer-backed funding evidence.

Vault-wide free balance, donor surplus, a generic payment receipt or a 420Hz application ledger is insufficient.

If 420Pay is later used to acquire funds from a user, it does not replace ComputeMarket/Vault funding/settlement authority.

## Accepted price

The canonical accepted price must satisfy all three bounds:

1. accepted price <= payer-authorized maximum;
2. accepted price <= actual job-specific funded credit;
3. accepted price <= scoped accept-match capability amount.

The accepted economic snapshot freezes:

- payer/funding reference;
- provider;
- resource/revision;
- provider-derived beneficiary;
- pricing policy/version;
- accepted amount.

Matching/acceptance itself creates no provider earning and moves no funds to the provider.

## Provider earning and payout

Provider earning requires canonical verification under the accepted verification policy.

`RESULT_COMMITTED` is not verified earning.

A provider/worker signature alone is not enough.

Across retries and resubmissions, the same payable unit/result has one canonical entitlement.

The accounting bound is:

`verified earnings + explicit accepted fees <= accepted price <= payer maximum <= payer-backed funded reserve`

Provider economic states remain distinct:

- **VERIFIED_EARNED**
- **PROVIDER_CLAIMABLE**
- **PROVIDER_PAID**

420Hz must not label a provider paid merely because the application sees a successful result or a facade status.

The payout recipient remains the canonical frozen beneficiary. 420Hz may not substitute a recipient.

## Cancellation, failure and refunds

DRAFT/QUOTED cancellation before canonical funding creates no provider charge and does not need a fabricated refund.

After funding, cancellation/expiry/failure/refund behavior follows canonical AI/Compute/Vault state.

A local cancel action cannot promise an immediate/full refund.

Unused/unearned payer-backed value remains payer-bound.

The product must distinguish:

- **PAYER_REFUNDABLE** — accounting class only;
- **PAYER_REFUND_CLAIMABLE** — canonical payer withdrawal/claim is available;
- **PAYER_REFUND_PAID** — actual external refund/withdrawal completed.

`cancelObligation` or a freed internal Vault balance is not itself an external payer refund.

## Retry / replay economics

Transient retries must not create a second provider entitlement or second user charge.

Duplicate client idempotency keys must resolve to the same economic intent/job or fail closed.

A genuinely new paid attempt after terminal failure/cancellation requires a fresh intent/run and fresh authorization unless canonical recovery explicitly reuses the existing entitlement/funding path.

Provider/network timeout recovery must first reconcile canonical state before any new charge is allowed.

## Partial results

Partial earning is allowed only if the accepted policy explicitly supports partial units/results.

Subjective dissatisfaction is not authority to reverse already verified earning.

Conversely, incomplete/unverified work cannot be paid merely because a partial file exists.

## Disputes

A dispute may hold only the specific contested, not-yet-released entitlement/refund under the accepted policy.

It cannot:

- mint a second entitlement;
- alter the frozen beneficiary;
- consume another payer's balance;
- use popularity/reputation alone as payment/refund authority.

Uncontested portions may proceed when canonical policy permits.

## Sponsorship / subsidy

Optional canonical sponsorship, grant, research-pool or ecosystem funding may reduce the user's own funded portion only when an actual canonical source explicitly backs the exact job/request.

420Hz must not fabricate a discount from:

- a community score;
- award popularity;
- a sponsor label with no funded record;
- a useful-computation reward that is unrelated to this job.

CMP-6 useful-computation/research reward accounting remains a distinct economic surface from Compute job settlement.

If subsidy funding disappears or is insufficient before acceptance, the request must re-quote/re-authorize or fail closed. The amount must not silently shift to the user.

## 420Hz application fee

HZ-GCA-1.9 defines **no hidden or implicit 420Hz surcharge**.

No current application fee is introduced by this step.

Any future 420Hz application/service fee requires:

- explicit versioned policy;
- separate line item;
- explicit beneficiary;
- separate user authorization;
- inclusion in the displayed total maximum.

It cannot be hidden inside provider cost.

## UI truthfulness

Before submission, show:

- asset;
- estimate vs quote status;
- quoted amount/range;
- payer maximum;
- expiry;
- sponsor/subsidy source if applicable.

After canonical acceptance, show the exact accepted price separately from the earlier quote.

The UI must separately show provider earned/claimable/paid and payer refundable/claimable/paid.

Stale/unavailable canonical pricing must be shown as unavailable/stale, not replaced by invented defaults.

## Reconciliation

The economic reconciliation identity is:

`funded = provider earned/claimable/paid + payer refundable/claimable/paid + still reserved + explicit accepted fees/holds`

Each amount is counted once.

A dispute hold reclassifies an existing bounded liability; it does not create value.

Quotes/estimates are excluded from reconciliation until canonical funding/acceptance exists.

## Fail-closed cases

Generation economics fail closed for:

- quote above payer maximum;
- accepted price above actual funded credit;
- accepted price above scoped capability;
- stale quote at paid submission;
- unauthorized payer/requester mismatch;
- beneficiary substitution;
- duplicate entitlement;
- payout before verification/finality;
- refund to a non-bound payer route;
- PAID/REFUNDED UI claims without canonical evidence;
- fake subsidy;
- silent sponsor-to-user cost transfer;
- hidden 420Hz surcharge;
- app/canonical economic-state disagreement on a new spending action.

## Invariants

The machine-readable policy freezes **HZGCA-ECON-001 through HZGCA-ECON-018**.

These preserve price bounds, at-most-once payment, payer isolation, truthful refund states, subsidy separation and zero hidden application surcharge.

## Source reconciliation

This policy was reconciled against current repository economics, including:

- 420AI max-spend/funding/settlement mirrors;
- ComputeMarket accepted-price reservation;
- payer-backed Vault funding;
- provider payout boundaries;
- refund/claimability distinctions;
- dispute holds;
- CMP-6 funding/reward accounting.

The branch was reconciled to current `main` before this step because current main contains the merged CMP-6 economics work. HZ-GCA-1.9 does not reinterpret those reward surfaces as consumer Generate payments.

## HZ-GCA-1.9 exit criteria

HZ-GCA-1.9 is complete when:

- estimate/quote/max/funding/accepted-price states are explicit;
- provider earned/claimable/paid and payer refundable/claimable/paid remain distinct;
- accepted-price bounds and frozen beneficiary rules are explicit;
- cancellation/failure/refund/dispute/retry economics are explicit;
- sponsorship/subsidy is canonical and distinct from provider rewards/refunds;
- hidden 420Hz surcharge is prohibited;
- UI truthfulness/reconciliation rules are explicit;
- targeted exact-head verifier passes;
- no live quote, provider price, production fee or testnet state is invented;
- parent HZ-GCA-1 remains open.

Next canonical work package:

**HZ-GCA-1.10 — Define Community authority model**
