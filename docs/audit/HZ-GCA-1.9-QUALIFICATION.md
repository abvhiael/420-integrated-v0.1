# HZ-GCA-1.9 — Generation economics qualification evidence

Status: **COMPLETE — Level 1**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Work package: **HZ-GCA-1.9 — Define generation economics**

## Qualification identity

- Repository: `abvhiael/420-integrated-v0.1`
- PR: **#565 — Add 420Hz Generate, Community & Awards roadmap phase**
- Branch: `feature/420hz-generate-community-awards-roadmap`
- Current `main` / reconciliation base: `c6b62a6ea75be97564564e56b779dfad7df3f784`
- Reconciled branch anchor before HZ-GCA-1.9 implementation: `004bf6a802a566bab70cb71dcc2d3da43a09fa41`
- Qualified implementation SHA: `aa49e21ef8593038e9b37ced56bd50afcbd8df95`
- Qualification level: **Level 1 — per-roadmap-step fast qualification**
- Level 2 milestone: **NOT REQUIRED for HZ-GCA-1.9**
- Level 3: **DEFERRED to HZ-GCA-17 phase closeout**

## Main reconciliation

Current main had advanced from the previous 420Hz base because CMP-6 useful-computation rewards had merged.

Because HZ-GCA-1.9 directly depends on current ComputeMarket economic semantics, the branch was reconciled to current main before defining generation economics.

The new CMP-6 reward/funding surfaces are preserved as separate canonical economics and are not reinterpreted as 420Hz generation payment/refund state.

## Implementation completed

Added:

- `hz/config/gca-generation-economics-v1.json`
- `docs/architecture/420hz/HZ-GCA-1.9-GENERATION-ECONOMICS.md`
- `scripts/verify-420hz-gca-1-9.py`

Updated:

- `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`
- `.github/workflows/420hz-gca.yml`

## Requirements satisfied

### Economic state vocabulary

Frozen states:

- ESTIMATE
- QUOTED
- AUTHORIZED_MAX
- FUNDED
- ACCEPTED_PRICE
- VERIFIED_EARNED
- PROVIDER_CLAIMABLE
- PROVIDER_PAID
- PAYER_REFUNDABLE
- PAYER_REFUND_CLAIMABLE
- PAYER_REFUND_PAID
- DISPUTE_HOLD

The policy explicitly prevents semantic collapse between quote, funding, accepted price, earning, payout and refund.

### Quote / authorization / funding

- QUOTED is non-canonical application state.
- Quote expiry/material request or provider/resource drift requires re-quote.
- payer maximum authorization is explicit and bounded.
- unbounded legacy max-spend is prohibited for paid Generate.
- payer/requester separation requires independent payer authorization.
- actual funding must be job-specific/payer-backed.
- Vault-wide balance, donor surplus or app bookkeeping is not job funding.

### Accepted-price bounds

Accepted price must remain bounded by all of:

1. payer-authorized maximum;
2. actual job-specific Vault-backed funded credit;
3. scoped accept-match capability amount.

The accepted snapshot freezes provider/resource revision, beneficiary, pricing policy/version and amount.

### Provider settlement

- match/acceptance creates no earning;
- RESULT_COMMITTED is not verified earning;
- provider earning requires canonical verification;
- retry/replay cannot create a second payable entitlement;
- VERIFIED_EARNED, PROVIDER_CLAIMABLE and PROVIDER_PAID remain distinct;
- payout recipient is the frozen canonical beneficiary.

### Refund economics

- pre-funding cancellation creates no fake refund;
- post-funding cancellation/failure follows canonical AI/Compute/Vault state;
- PAYER_REFUNDABLE, PAYER_REFUND_CLAIMABLE and PAYER_REFUND_PAID remain distinct;
- `cancelObligation`/free internal balance is not an external refund;
- refunds remain payer-bound.

### Retry and recovery

- same economic intent/job cannot silently create a second user charge;
- duplicate idempotency keys resolve to the same economic intent or fail closed;
- a genuinely new paid attempt requires fresh intent/quote/authorization unless canonical recovery preserves the existing entitlement;
- timeout/lost-response handling reconciles canonical state before any new charge.

### Sponsorship / subsidy

Optional sponsor/grant/research/ecosystem funding is recognized only when a canonical source explicitly backs the exact job.

CMP-6 rewards/funding are separate from consumer generation provider payment and user refunds.

Community/Awards popularity cannot fabricate a subsidy or provider entitlement.

### Fees

HZ-GCA-1.9 introduces **no 420Hz application fee and forbids hidden 420Hz surcharge**.

Any later fee requires explicit versioned policy, separate line item, beneficiary and separate user authorization.

## Economic invariants

The manifest freezes **HZGCA-ECON-001 through HZGCA-ECON-018**.

The targeted verifier checks:

- exact economic state vocabulary;
- quote/non-canonical boundaries;
- bounded payer authorization;
- exact accepted-price triple bound;
- frozen beneficiary;
- verification-gated earning;
- at-most-once entitlement;
- payout/refund state separation;
- retry/replay non-double-charge rules;
- canonical sponsorship/subsidy separation;
- zero hidden application surcharge;
- reconciliation equation;
- fail-closed economic cases;
- source-document existence;
- current AIJobManager maxSpend/FundingExceedsMaximum evidence;
- roadmap Level-1/non-milestone classification.

## Level-1 qualification

Dedicated workflow:

**420Hz GCA Qualification**

Successful exact-head run:

- Run ID: **37732618496**
- Run number: **#102**
- Job: **HZ-GCA Level 1**
- Job ID: **113164969937**
- Exact tested SHA: `aa49e21ef8593038e9b37ced56bd50afcbd8df95`
- Result: **PASS**

Successful checks:

1. exact PR-head checkout/verification;
2. all GCA JSON manifest syntax validation;
3. retained HZ-GCA-1.1 verifier;
4. retained HZ-GCA-1.2 verifier;
5. retained HZ-GCA-1.3 verifier;
6. retained HZ-GCA-1.4 verifier;
7. retained HZ-GCA-1.5 verifier;
8. retained HZ-GCA-1.6 verifier;
9. retained HZ-GCA-1.7 verifier;
10. retained HZ-GCA-1.8 verifier;
11. HZ-GCA-1.9 generation economics verifier.

The concurrently triggered **420Hz Web Qualification #73** also passed on the same exact implementation SHA. It is collateral evidence, not a substitute for GCA Level 1.

## Diagnosed failed attempts

Two exact-head runs failed only in the new HZ-GCA-1.9 verifier while all retained HZ-GCA-1.1 through 1.8 checks passed.

### First attempt

- SHA: `027b9f8009608eae92156a4db2a6e2b7445d142d`
- Run: **37732434117**
- Job: **113164379414**
- Failure: verifier expected the literal phrase `must never silently recharge`.

The normative document already required canonical reconciliation before any new charge. This was a string-match/test-harness defect.

### Second attempt

- SHA: `e127d59702909548cfc087f8c9838e3b0aeaba5c`
- Run: **37732510496**
- Job: **113164622593**
- Failure: verifier still expected a phrase not present verbatim in the normative document.

The verifier was aligned to the actual normative phrase:

`before any new charge is allowed`

No economic rule, price bound, refund rule, replay protection, authorization check or assertion was removed or weakened.

The repaired exact SHA then passed.

## Security / adversarial result

Result: **PASS**

The verifier fails policies that:

- allow accepted price above payer max/funding/capability;
- permit provider-beneficiary substitution;
- pay on match or unverified result;
- duplicate payable entitlement across retries;
- call internal Vault cancellation a refund;
- refund to an alternate recipient;
- fabricate sponsored funding;
- silently transfer sponsor shortfall to the user;
- introduce hidden 420Hz surcharge;
- claim PAID/REFUNDED without canonical evidence.

## Level 2 status

**Not run / not required.**

HZ-GCA-1.9 is an architecture/economic-policy work package. It changes no shared executable settlement component and is not the documented HZ-GCA-1 milestone boundary.

The HZ-GCA-1 Level-2 milestone remains **HZ-GCA-1.20**.

## Intentionally deferred Level 3

Deferred to HZ-GCA-17:

- canonical full Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- repository-wide Docs/global reconciliation;
- retained 420Hz app suite;
- broad clients/services/Indexer/Search/RPC/frontend/backend qualification;
- full adversarial/invariant/static/security qualification;
- deployment/config verification.

At Level 3, Solidity Contracts owns the canonical full Foundry inventory and Genesis/address-authority qualification remains separate without duplicating that inventory.

## Limitations

HZ-GCA-1.9 intentionally does not implement:

- live pricing/provider quotes;
- production funding UI;
- a new escrow/Vault adapter;
- payment acquisition;
- real sponsor subsidy UX;
- provider payout/refund execution;
- a 420Hz fee;
- testnet/production settlement deployment.

Those remain later implementation/testnet work.

## Blockers

None for HZ-GCA-1.9.

## Completion state

**HZ-GCA-1.9 — COMPLETE (Level 1).**

Parent **HZ-GCA-1 remains IN PROGRESS**.

Next canonical work package:

**HZ-GCA-1.10 — Define Community authority model**
