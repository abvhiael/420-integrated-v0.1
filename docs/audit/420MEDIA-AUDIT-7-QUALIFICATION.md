# 420Media — MEDIA-AUDIT-7 qualification evidence

## Step

**MEDIA-AUDIT-7 — Pay and Compute integration**

Status: **COMPLETE**

Qualification level: **Level 1 — app-scoped fast qualification**

## Authoritative implementation

- implementation SHA: `a0aeb709b10a155fe7959781a9994a15368a9b4a`
- current main/base SHA at qualification: `23ebff000a471bfbc4439894f797f3b17a530867`
- original audit baseline SHA: `d86a3810d2901dc1082b65dc9061896c46e1911d`
- audit branch: `audit/420media-complete-20261006`
- active PR: **#536**

## Canonical definition

MEDIA-AUDIT-7 requires Media to replace opaque/legacy compatibility assumptions with explicit canonical Pay settlement and Compute Market coordination boundaries where applicable while preserving:

- non-custodial accounting;
- canonical payer/beneficiary binding;
- idempotency/replay protection;
- refund/failure behavior;
- Pay and Compute as the authoritative protocols for their own state.

The step does not make 420Media a Pay router, Vault, Compute scheduler, Compute verifier, Compute settlement authority, or wallet-signing authority.

## Implementation completed

### Canonical Pay boundary

Added `MediaPayComputeAdapter420` with PaymentRegistry-backed Pay evidence.

Pay funding requires:

- Media job status ACCEPTED;
- exact canonical Media payer/requester;
- exact Media operator settlement beneficiary;
- nonzero Pay invoice ID;
- canonical Pay status SETTLED;
- exact Pay payer == Media payer;
- exact Pay merchant == Media beneficiary;
- nonzero settlement amount no greater than Media max spend;
- nonzero canonical receipt hash;
- zero prior refund;
- one-use payment ID.

The canonical payment ID becomes the Media funding reference. Media does not repeat or execute the Pay value transfer.

Terminal Pay settlement re-reads the same canonical payment state before closing Media settlement.

Terminal Pay refund requires canonical REFUNDED/PARTIALLY_REFUNDED state and refunded coverage at least equal to the Media funded ceiling.

### Canonical Compute boundary

The legacy `computeProviderRef` remains a compatibility datum only.

Added `computeProviderRefOf(operatorId)` and cross-checked it against canonical Compute state.

Compute binding requires:

- exact current nonzero `ICompute420.componentGraphHash()`;
- canonical Compute job status ACCEPTED;
- Compute owner == Media payer;
- canonical funding credit owned by the same payer and proven funded;
- canonical accepted match and price reservation;
- exact request/match/provider/resource identity agreement;
- accepted price within Media max spend and funded credit;
- exact Compute beneficiary == Media operator settlement account;
- exact Media operator account == canonical Compute match operator;
- Media `computeProviderRef` == canonical Compute provider ID;
- canonical Compute provider ACTIVE;
- canonical provider operator/settlement account agreement.

Media records the canonical Compute obligation as its vault reference and the Compute job ID as its funding reference. It never reserves or moves Compute funds.

### Exact terminal accounting

`MediaSettlement420` now distinguishes the funded ceiling from the final canonical settled amount:

- `settledAmounts[jobId]`
- `canonicalSettlementRefs[jobId]`
- `canonicalRefundRefs[jobId]`

`releaseCanonical` permits a nonzero canonical settled amount no greater than the funded ceiling.

This prevents Media from overstating a Compute payout when the canonical verified entitlement earns less than the amount originally funded/reserved.

### Canonical Compute settlement

Terminal Compute settlement requires:

- canonical Compute job status SETTLED;
- nonzero settlement and verification refs;
- canonical entitlement for the same job/request/match;
- exact payer/provider/resource/beneficiary identity;
- exact accepted amount equal to Media funded ceiling;
- earned amount > 0 and <= funded ceiling;
- exact verification reference;
- canonical settlement adapter confirmation of the settlement ref.

Media records the canonical **earned amount** rather than automatically recording the entire funding ceiling.

### Canonical Compute refund

Terminal Compute refund requires:

- Compute job status REFUNDED;
- canonical refund proof for the Compute settlement/refund reference;
- claimable, paid, non-residual payer refund;
- exact Media payer;
- exact payout/refund reference;
- refund amount covering at least the Media funded ceiling.

Residual payer refunds after a successful Compute settlement are not treated as Media job failure.

### Graph drift / stale dependency protection

Every terminal Compute settlement/refund observation revalidates the stored Compute component graph hash.

A changed canonical Compute graph causes Media to fail closed rather than silently continuing against stale component bindings.

## Files changed

Executable/source/test changes:

- `contracts/src/media/MediaPayComputeAdapter420.sol`
- `contracts/src/media/MediaSettlement420.sol`
- `contracts/src/media/MediaOperatorRegistry420.sol`
- `contracts/test/MediaPhase1PayCompute420.t.sol`
- `scripts/verify-420media-audit.py`

Documentation/audit changes included in the qualified implementation SHA:

- `docs/420-MEDIA-PAY-COMPUTE.md`
- `docs/420MEDIA-AUDIT.md`

## Security / adversarial / failure-path coverage

PASS:

- exact Pay payer binding;
- exact Pay merchant/beneficiary binding;
- Pay payment replay prevention;
- Pay settled-state requirement;
- Pay receipt presence requirement;
- Pay refunded-state coverage;
- Media max-spend enforcement;
- exact Compute graph binding;
- graph mismatch failure;
- canonical Compute funded-credit validation;
- accepted-match and price-reservation validation;
- canonical provider ID validation;
- exact operator identity validation;
- exact provider settlement beneficiary validation;
- inactive/mismatched provider failure;
- accepted-price ceiling enforcement;
- canonical Compute settlement evidence;
- actual earned amount retained instead of funding ceiling;
- canonical terminal payer refund evidence;
- non-residual refund requirement;
- one Media economic binding per job;
- terminal idempotency;
- no Media direct value custody;
- retained Phase-1 settlement callback atomicity;
- retained Phase-1 non-custody, SLA, operator and beneficiary regressions;
- retained Media Go and Anvil regressions.

## CI diagnosis history

A superseded candidate exposed one **test-harness compile defect**:

- the test attempted tuple destructuring of `adapter.binding()`, which returns a Solidity struct;
- no protocol behavior failed;
- the test was corrected to read `MediaPayComputeAdapter420.Binding memory` directly;
- no implementation semantics, authorization rule, accounting rule or assertion were weakened.

The repaired exact implementation SHA was then qualified successfully.

## Exact-head Level 1 qualification

Workflow: **420Media audit**

- run: **37511396911**
- run number: **74**
- job: **112433293029**
- exact implementation SHA assertion: **PASS**
- canonical Media audit verifier: **PASS**
- changed-surface gofmt gate: **PASS**
- GEN-SVC feature contract validator: **PASS**
- `go test ./media/... ./cmd/420media-node`: **PASS**
- `go vet ./media/... ./cmd/420media-node`: **PASS**
- Media Solidity build: **PASS**
- `forge test --match-path "test/MediaPhase1*420.t.sol" -vvv`: **PASS**
- Media Anvil integration: **PASS**
- workflow conclusion: **SUCCESS**

## Current-main dependency check

At closeout:

- current `main`: `23ebff000a471bfbc4439894f797f3b17a530867`;
- audit branch is 12 commits behind current main;
- those 12 commits modify PuffBuddies and repository/global CI optimization only;
- no Media, Pay or Compute source/interface/config dependency used by MEDIA-AUDIT-7 changed in those commits.

Therefore app-phase Level 1 reconciliation against current main is **not required** for this step. Final accumulated reconciliation remains Level 3 work.

## Level 2 status

No new Level 2 milestone is defined for MEDIA-AUDIT-7.

The previously completed MEDIA-AUDIT-5 Level 2 milestone remains the latest Media app-integration milestone.

No ceremonial Level 2 rerun was performed.

## Intentionally deferred Level 3 work

Deferred to MEDIA-AUDIT-11 app-phase closeout:

- reconciliation of the complete Media branch against then-current `main`;
- canonical full repository Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- Docs/global reconciliation;
- complete affected client/service/Indexer/Search/RPC/frontend/backend inventory;
- final security/static/deployment/configuration qualification;
- exact accumulated merge-candidate qualification.

## Deferred live/release work

- real Pay/Compute deployment addresses and Registry publication — MEDIA-AUDIT-12/13;
- production-equivalent funded Pay/Compute journeys — MEDIA-AUDIT-12;
- public `/v1` transaction preparation and typed SDK — MEDIA-AUDIT-9;
- user-facing wallet/payment/compute UX — MEDIA-AUDIT-10.

## Exit-criterion verification

- explicit canonical Pay settlement boundary: **SATISFIED**
- explicit canonical Compute coordination boundary: **SATISFIED**
- opaque provider reference no longer trusted alone: **SATISFIED**
- non-custodial accounting preserved: **SATISFIED**
- canonical beneficiary binding preserved: **SATISFIED**
- idempotency/replay protection: **SATISFIED**
- refund/failure behavior: **SATISFIED**
- affected build/contract qualification: **PASS**
- negative/adversarial/failure-path checks: **PASS**
- retained Media regressions: **PASS**
- exact implementation SHA qualification: **PASS**
- durable documentation: **SATISFIED**

## Blockers

None for MEDIA-AUDIT-7 repository Level 1 completion.

## Next canonical roadmap step

**MEDIA-AUDIT-8 — Search, Notifications and indexing projections**
