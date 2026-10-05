# AI-AUDIT-6 — provider runtime and private payload path qualification

Status: **COMPLETE**  
Qualification: **Level 1 step qualification**  
Application: **420AI**  
Repository: `abvhiael/420-integrated-v0.1`  
Audit branch: `audit/420ai-complete-20261002`  
Pull request: **#491**  
Qualified implementation SHA: `0a70e753256e3d3c8cead2894ee9924c72d1b570`  
Qualification base / PR base SHA: `b58b09a17e641a42b81d832bad913a83c7caada9`  
Current main observed at durable closeout: `d37d751dfa232b20c8158d55c20c13cc1d7a10ef`  
Workflow: **420AI Audit Qualification**  
Workflow run: **37099378185**

## Canonical requirements satisfied

AI-AUDIT-6 requires a rebuilt off-chain `420ai` provider service against the current RPC/Registry/CMP boundary, signed execution manifests, private-payload encryption/retention, receipt submission, retry/idempotency, restart recovery, observability and bounded failure behavior.

The qualified implementation adds a runnable service at `services/420ai-provider` and does not revive stale provider code.

### Canonical authority boundary

The runtime consumes a narrow injected canonical client and re-reads canonical environment/job state before execution and receipt recovery. It fails closed on:

- wrong chain ID;
- changed ComputeMarket component graph;
- provider mismatch;
- resource outside the configured allowed set;
- non-RUNNING canonical job state;
- expired job deadline;
- private-input commitment mismatch; and
- canonical assignment change during receipt submission.

Local queues, health state and restart state are explicitly non-authoritative.

### Signed execution evidence

The runtime produces domain-separated provider-signed execution manifests and provider-signed receipts.

The execution manifest binds:

- chain ID and ComputeMarket graph;
- AI request, CMP request and canonical job identities;
- assignment;
- provider/resource;
- model version and workload;
- privacy-policy and verification-profile references;
- input commitment;
- canonical manifest hash;
- runtime identity;
- issue time and bounded expiry.

The signed receipt binds the manifest digest, assignment/provider/resource, result commitment, optional evidence reference and completion time.

These service signatures are off-chain provenance evidence. They do not replace the current canonical CMP on-chain worker/receipt authorization path.

### Private payload handling

Private inputs are stored through AES-256-GCM with assignment-scoped authenticated data. The storage layer enforces:

- a 32-byte encryption key;
- an explicit maximum retention interval;
- expiry fail-closed behavior;
- deletion on expired read;
- authenticated job/assignment/input-commitment scope; and
- no plaintext persistence in runtime workflow state.

Observability recursively redacts payload, prompt, document/dataset-sensitive key classes, token, secret, credential, private-key/API-key and raw byte fields.

### Retry, idempotency and recovery

Receipt identity is stable and receipt-derived. Submission uses bounded retry and a finite deadline.

Before a retry, and after a submission error, the runtime re-reads canonical state. If the same result commitment already exists canonically, the operation is reconciled rather than duplicated.

Restart recovery:

- reconciles already-committed canonical results without rerunning inference;
- marks canonical terminal jobs terminal locally;
- preserves nonsecret signed manifest/receipt state for pending submission;
- resumes a pending receipt without re-decrypting or re-executing the workload; and
- refuses silent re-execution after an interrupted workload, requiring the explicit `retryExecution` path after canonical revalidation.

## Exact-head qualification

420AI Audit Qualification **run 37099378185** passed against exact implementation SHA `0a70e753256e3d3c8cead2894ee9924c72d1b570`:

- `focused-ai-contracts` — job **111135768844** — PASS
  - AI contract build — PASS
  - retained focused AI Foundry suites — PASS
- `v1-modules` — job **111135768883** — PASS
- `provider-runtime` — job **111135768935** — PASS
  - provider-runtime tests — **14 passed; 0 failed; 0 skipped**
  - AI-AUDIT-6 structural verifier — PASS
- `audit-state` — job **111135768966** — PASS
- `compute-integration` — job **111135768976** — PASS
- `genesis-compatibility` — job **111135768981** — PASS

## Qualification defects diagnosed during the step

The implementation was not blindly rerun after deterministic failures.

1. The first provider-runtime execution exposed a real deterministic-clock defect in retry handling and an accidental `structuredClone` callback-argument bug in memory-state enumeration. Both root causes were fixed.
2. The next run proved all provider tests green but exposed brittle verifier string matching. The verifier was corrected to inspect actual implementation semantics rather than cosmetic aliases.
3. Before closeout, restart handling was strengthened so a crash after execution but before receipt submission does not force duplicate inference: nonsecret signed receipt state is persisted and can be resumed directly, while interrupted execution requires explicit re-execution.

The final exact head passed all app-specific qualification jobs.

## Security and adversarial coverage

The committed runtime tests prove that:

- signed execution-object tampering fails;
- ciphertext does not contain private plaintext;
- wrong authenticated payload scope fails;
- retention beyond the configured maximum fails;
- expired private payloads fail and are removed;
- ordinary replay does not re-execute or resubmit;
- transient failures use bounded retry;
- non-transient failures are not retried;
- lost-response canonical success reconciles without duplicate submission;
- pending receipts survive restart without private-data access or re-execution;
- interrupted execution requires explicit re-execution;
- wrong chain/ComputeMarket graph/provider/resource/deadline/input commitment fail closed;
- terminal canonical jobs cannot be reopened by recovery; and
- logs redact sensitive payload/credential material.

## Qualification level

AI-AUDIT-6 is a service-scoped implementation boundary. **Level 1** is the required qualification level for this step.

No separate Level 2 milestone is required here: the broader AI/ComputeMarket integration milestone was already qualified at AI-AUDIT-4, and this step adds a replaceable off-chain runtime without redefining that protocol boundary.

Level 3 remains deferred to the complete app-phase/pre-testnet closeout.

## Intentionally deferred

AI-AUDIT-5 custody, settlement and dispute reconciliation remains outstanding and is not claimed by this step.

AI-AUDIT-7 owns the canonical AI read API/indexer.

AI-AUDIT-8 owns the user-facing client.

AI-AUDIT-9 and later own deployment materialization, ProtocolRegistry publication, production-equivalent testnet evidence and final release qualification.

## Base/main note

The implementation was qualified while PR #491's base remained `b58b09a17e641a42b81d832bad913a83c7caada9`. At durable-evidence closeout, repository `main` had advanced to `d37d751dfa232b20c8158d55c20c13cc1d7a10ef`.

This evidence-only closeout records that divergence explicitly. It does not claim current-main reconciliation and does not alter the qualified implementation.

## Completion

All AI-AUDIT-6 repository-side exit criteria are satisfied. There are no AI-AUDIT-6 blockers.

**AI-AUDIT-6 is COMPLETE.**

**Next canonical roadmap step: AI-AUDIT-7 — read API / indexer.**
