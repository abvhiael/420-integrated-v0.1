# HZ-GCA-1.3 — Generate lifecycle

Status: **IMPLEMENTED — Level 1 lifecycle definition**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Machine-readable lifecycle:

`hz/config/gca-generate-lifecycle-v1.json`

This step freezes the 420Hz product lifecycle for Generate without replacing the authoritative lifecycles already owned by 420AI, Compute Market or the Creative Protocol.

## Canonical product lifecycle

`DRAFT → QUOTED → SUBMITTED → RUNNING → SUCCEEDED → REVIEWED → REGISTERED → PUBLISHED`

Exceptional terminal outcomes:

- `FAILED`
- `CANCELLED`

The canonical roadmap notation `SUCCEEDED | FAILED | CANCELLED` describes the execution outcome branch after submission/run. Only `SUCCEEDED` can advance to review and publication.

## State meanings

### DRAFT

A private local `GenerationIntent` exists. No canonical AI job, compute request, compute job, funding, rights or publication is implied.

### QUOTED

The intent has a current application quote/reference for the same exact intent. The quote is not payment finality, compute reservation, provider entitlement or settlement authority.

An expired/rejected/materially changed quote returns the product intent to `DRAFT`; it does not create canonical execution state.

### SUBMITTED

An exact canonical 420AI job ID has been created and bound to this intent.

420AI states `CREATED`, `FUNDED`, `MATCHED` and `ACCEPTED` remain product-level `SUBMITTED`. 420Hz must not present those states as execution already running.

### RUNNING

420Hz has observed canonical 420AI `RUNNING`.

A canonical `RESULT_COMMITTED` state remains product-level `RUNNING` because a provider result commitment alone is not verified success.

### SUCCEEDED

The canonical AI job has reached `VERIFIED` or `SETTLED` with nonzero result/result-manifest commitments.

`VERIFIED` is sufficient for product success; provider economic settlement may complete separately. Product success does not imply Creative rights, registration or publication.

### FAILED

The submitted generation ended through objective canonical failure/expiry or a bounded unrecoverable orchestration failure that produced no runnable/successful job.

`FAILED` is terminal for that intent/run. Retry creates a new intent/run or explicit supersession; history is never rewritten from FAILED back to RUNNING.

### CANCELLED

Before submission, the creator may cancel a `DRAFT` or `QUOTED` intent locally.

After submission, 420Hz may mark `CANCELLED` only after the owning AI/Compute path confirms cancellation. A UI click alone cannot manufacture canonical cancellation, refunds or erase valid external earned entitlement.

`CANCELLED` is terminal for that intent/run.

### REVIEWED

The creator explicitly selects a successful output and confirms the review/provenance/disclosure handoff.

This state is never automatic and still does not establish Creative registration or ownership.

### REGISTERED

Canonical Creative registration has returned native `WorkId` and `RecordingId` references.

The existence of a `PublishIntent` is not enough. Registration must actually succeed in the Creative system.

`REGISTERED` does not itself mean the Recording is active/published.

### PUBLISHED

The canonical Recording is `ACTIVE` and the required release/catalog/media publication succeeds.

This is a historical 420Hz publication milestone. A later Creative withdrawal/restriction does not rewrite the historical product lifecycle; current availability is derived from canonical Creative state.

## Legal transitions

The machine-readable manifest freezes all legal transitions and guards. In summary:

- `DRAFT → QUOTED`
- `DRAFT → CANCELLED`
- `QUOTED → DRAFT` for quote refresh/change
- `QUOTED → SUBMITTED`
- `QUOTED → CANCELLED`
- `SUBMITTED → RUNNING | FAILED | CANCELLED`
- `RUNNING → SUCCEEDED | FAILED | CANCELLED`
- `SUCCEEDED → REVIEWED`
- `REVIEWED → REGISTERED`
- `REGISTERED → PUBLISHED`

No shortcut may skip quote, submission, verification, explicit creator review, Creative registration or Creative publication gates.

## 420AI mapping

| Canonical 420AI status | 420Hz product interpretation |
| --- | --- |
| NONE | invalid / unbound |
| CREATED | SUBMITTED |
| FUNDED | SUBMITTED |
| MATCHED | SUBMITTED |
| ACCEPTED | SUBMITTED |
| RUNNING | RUNNING |
| RESULT_COMMITTED | RUNNING |
| VERIFIED | SUCCEEDED |
| SETTLED | SUCCEEDED |
| CANCELLED | CANCELLED |
| EXPIRED | FAILED |
| FAILED | FAILED |
| DISPUTED | hold at the pre-dispute product phase; no forward success progression |
| REFUNDED | preserve prior FAILED/CANCELLED cause; refund alone is not a product success/failure cause |

This mapping is observational only. 420Hz cannot mutate 420AI into the state it wants to display.

## Disputes

A canonical `DISPUTED` AI/Compute state blocks new forward success transitions.

420Hz preserves the prior product phase and waits for owning-protocol resolution. UI state cannot transform a disputed result into `SUCCEEDED`.

Detailed dispute/recovery behavior remains further refined in HZ-GCA-1.14 and HZ-GCA-1.17.

## Retry and replay

- Failed generation retry uses a new intent/run or explicit supersession.
- Cancelled generation resubmission uses a new intent/run.
- Quote refresh may return `QUOTED → DRAFT` before submission.
- Duplicate submission with the same idempotency/client key must resolve to the same canonical AI job or fail closed.
- Silent creation of parallel payable jobs is forbidden.

## Partial outputs

Partial artifacts may be retained only when the owning AI/Compute result policy explicitly permits them.

Partial output does not automatically mean `SUCCEEDED`. The accepted policy still must reach canonical `VERIFIED` or `SETTLED`.

Partial output cannot bypass review, provenance/disclosure, rights, Creative registration or publication.

## Object bindings

### GenerationIntent.status

Owns the 420Hz product lifecycle state. It cannot be used to drive canonical external state.

### GenerationRunBinding.latestObservedAIStatus

Non-authoritative cache of the exact observed 420AI status. It must not diverge intentionally from the referenced canonical job.

### GenerationOutput.reviewState

Represents output selection/review details only. It cannot independently promote lifecycle to `REVIEWED`.

### PublishIntent.state

Tracks handoff orchestration only. It cannot fabricate `REGISTERED` or `PUBLISHED` without canonical Creative references/status.

## Registration and publication gates

### REVIEWED

Requires:

- lifecycle `SUCCEEDED`;
- explicit creator output selection;
- provenance/disclosure review commitment.

### REGISTERED

Requires:

- lifecycle `REVIEWED`;
- native canonical `WorkId`;
- native canonical `RecordingId`;
- successful Creative registration.

### PUBLISHED

Requires:

- lifecycle `REGISTERED`;
- canonical Recording status `ACTIVE`;
- successful media/release/catalog publication.

## Security and authority consequences

The lifecycle prevents:

- UI success before canonical result verification;
- treating `RESULT_COMMITTED` as verified output;
- a quote being mistaken for funding or settlement;
- local cancellation erasing external earned rights;
- retry rewriting failed history;
- generation success being mistaken for copyright/rights ownership;
- automatic creator review;
- fabricated Work/Recording IDs;
- product `PUBLISHED` state activating Creative contracts;
- replay creating duplicate payable AI jobs.

## Invariants

The machine-readable manifest freezes `HZGCA-LIFE-001` through `HZGCA-LIFE-018`.

These preserve HZ-GCA-1.1 authority boundaries and HZ-GCA-1.2 object ownership while making product transition semantics explicit.

## Source reconciliation

This lifecycle was reconciled against:

- `docs/architecture/420hz/HZ-GCA-1.1-PRODUCT-BOUNDARIES.md`
- `docs/architecture/420hz/HZ-GCA-1.2-CANONICAL-OBJECT-MODEL.md`
- `hz/config/gca-product-boundaries-v1.json`
- `hz/config/gca-object-model-v1.json`
- `contracts/src/ai/AIJobManager.sol`
- `docs/architecture/infrastructure/420ai-compute-infrastructure.md`
- `docs/compute-market/CMP-0.7-AUTHORIZED-JOB-LIFECYCLE.md`
- `contracts/src/creative/music/WorkRegistry420.sol`
- `contracts/src/creative/music/RecordingRegistry420.sol`

The repository already defines authoritative AI/Compute execution lifecycles and Creative registration/activation gates. HZ-GCA-1.3 maps to those systems; it does not create duplicate protocol authority.

## HZ-GCA-1.3 exit criteria

HZ-GCA-1.3 is complete when:

- the complete product lifecycle vocabulary is explicit;
- every legal transition has a guard;
- shortcut/illegal transitions are rejected by the model;
- AI state mapping is explicit;
- cancellation, retry, dispute and partial-output semantics are explicit;
- review, registration and publication gates are distinct;
- the targeted verifier passes on the exact implementation SHA;
- no live provider, ABI, fixed address or testnet claim is invented;
- parent HZ-GCA-1 remains open.

Next work package after qualification:

**HZ-GCA-1.4 — Define AI disclosure rules**
