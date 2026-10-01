# 420Exchange PRE-06 — guarded swap orchestration qualification

**Canonical roadmap:** `docs/420EXCHANGE-PRE-TESTNET-COMPLETION-ROADMAP.md`  
**Step:** PRE-06 — guarded swap orchestration  
**Completion state:** COMPLETE  
**Qualification level:** Level 1 step-specific + Level 2 Exchange lifecycle/authority-integration milestone  
**Audit branch / PR:** `audit/exchange-pretestnet-phase-20260930` / PR #430  
**Audit base SHA:** `4d0ede3692efe55f04a50c7bf5b749afe579eccb`  
**Qualified implementation SHA:** `011ae238b7fdbf9643a339c71cf9357100391962`  
**Current repository `main` observed at implementation closeout:** `53b38901a2d7ead875eb606625ae99bf3c1e1069`

## Canonical requirements and disposition

| Requirement | Disposition |
| --- | --- |
| One complete swap orchestrator/state machine | SATISFIED — `GuardedSwapOrchestrator` owns authenticated preparation, human review, explicit confirmation, preflight, guarded submission and lifecycle observation. |
| Require PRE-05 authenticated provenance | SATISFIED — only `TRUSTED_EXECUTION_QUOTE` carrying verifier-branded PRE-05 evidence is accepted. |
| Fresh generation/account/chain/fingerprint immediately before submit | SATISFIED — submit rechecks the captured execution context and live wallet session, recomputes the transaction fingerprint and reruns the complete preflight immediately before the guarded send boundary. |
| Separate approval/permit review | SATISFIED — `420-exchange-swap-authorization-review-v1` separately binds NONE/ALLOWANCE/PERMIT authorization intent and requires an independent authorization fingerprint confirmation when applicable. |
| Invalidate review after relevant state changes | SATISFIED — the PRE-02 controller now exposes deterministic invalidation subscriptions; pending PRE-06 authority is destroyed on wallet/account/chain/runtime/execution-context invalidation. |
| Integrate required lifecycle states | SATISFIED — PREPARED, AWAITING_CONFIRMATION, SUBMITTED, PENDING, CONFIRMED, REVERTED, REPLACED, DROPPED, REORGED, INDEXER_DELAYED and INDEXER_CONFLICTING are represented deterministically; supporting internal states preserve review/preflight transitions. |
| Transaction hash never equals settlement | SATISFIED — a returned hash advances only to SUBMITTED; confirmation requires subsequent canonical lifecycle inspection. |
| Mock RPC/provider E2E adversarial coverage | SATISFIED — deterministic tests cover wallet rejection, bounded timeout, replacement, reorg, stale nonce, gas-estimate change/fresh preflight, indexer delay/conflict and wallet/session invalidation. |
| Independent default-OFF Wallet send gate | SATISFIED — `submitPreflightedTransaction` defaults to `DEFAULT_SUBMISSION_GATE={enabled:false,mode:'DISABLED'}`; checked-in runtime also pins `execution.swapSubmission=DISABLED_PRETESTNET`. Only named mock/live-qualification harnesses opt in explicitly. |

## Implemented authority pipeline

The qualified PRE-06 flow is:

`wallet/session -> PRE-05 authenticated quote -> canonical prepared swap -> human-readable bound review -> explicit swap confirmation + separate authorization confirmation -> fresh preflight -> independent default-OFF wallet submission gate -> lifecycle tracker`

The orchestrator does not create an alternate quote, calldata, fingerprint, wallet or lifecycle authority. It composes the existing qualified Exchange primitives.

## Principal implementation files

- `exchange/web/core/guarded-swap-orchestrator.js`
- `exchange/web/core/wallet-execution.js`
- `exchange/web/core/browser-execution-controller.js`
- `exchange/web/core/live-swap-qualification.js`
- `exchange/web/core/live-bridge-qualification.js`
- `exchange/web/core/live-limit-order-qualification.js`
- `exchange/web/runtime-config.json`
- `exchange/web/test/pre06-guarded-swap-orchestrator.test.js`
- `exchange/web/test/wallet-execution.test.js`
- `exchange/web/scripts/check-pre06.mjs`
- `exchange/web/package.json`

## Submission safety

PRE-06 makes the final wallet transaction call independently fail closed.

A resolved runtime, authenticated quote, exact human confirmation and successful preflight do **not** enable `eth_sendTransaction`. The low-level sender additionally requires an explicit named submission capability. The default is disabled.

Checked-in browser runtime:

`execution.swapSubmission = DISABLED_PRETESTNET`

Qualification harnesses may explicitly use:

- `PRE06_MOCK` for deterministic offline tests;
- `LIVE_TESTNET_QUALIFICATION` for the pre-existing dedicated live-testnet qualification harnesses.

Neither changes the checked-in production/pre-testnet default.

## Lifecycle semantics

PRE-06 interprets canonical RPC and optional Exchange indexed evidence without treating either a transaction hash or indexer projection as settlement authority.

- wallet hash -> SUBMITTED
- known/included but not sufficiently canonical -> PENDING
- sufficiently canonical RPC plus required reconciliation -> CONFIRMED
- receipt status failure -> REVERTED
- dropped hash with replacement evidence -> REPLACED
- missing transaction -> DROPPED
- inclusion no longer canonical -> REORGED
- canonical RPC but absent index evidence -> INDEXER_DELAYED
- RPC/index evidence disagreement -> INDEXER_CONFLICTING

Bounded lifecycle polling fails with `LIFECYCLE_TIMEOUT`; timeout is never promoted to success.

## Separate authorization review

Allowance/permit authority is not hidden inside swap confirmation.

PRE-06 produces a distinct authorization review fingerprint over:

- mode
- owner
- token
- spender
- exact raw amount
- permit type when applicable
- permit deadline when applicable

A non-NONE authorization must be explicitly confirmed independently, and the allowance preflight must match that reviewed authorization exactly.

## Level 1 qualification

Exact implementation SHA:

`011ae238b7fdbf9643a339c71cf9357100391962`

Required app-specific workflow:

- **420Exchange Web Verification**
- run `36794440699`
- run number `628`
- event: `pull_request`
- exact head: `011ae238b7fdbf9643a339c71cf9357100391962`
- **SUCCESS**

Successful exact-head checks included:

- PRE-04/PRE-05 quote backend static/authenticity checks
- quote backend unit + HTTP + authentication tests
- quote backend secret scan
- Exchange web static checks including PRE-06
- all Exchange web unit/integration tests including PRE-06 mock-E2E/adversarial coverage
- deployable browser artifact build/verification
- retained PRE-02 simulated EIP-1193 Chromium acceptance
- retained PRE-03 metadata-driven/authenticated-quote Chromium acceptance
- frontend secret scan

Earlier development runs exposed retained V15 qualification harnesses that called the low-level sender without the new explicit capability. The root cause was corrected by explicitly opting only those mock/live qualification harnesses into named qualification gates. The default-OFF product gate was not weakened. Those earlier failed runs are not qualification evidence.

## Level 2 milestone qualification

**COMPLETE — Exchange lifecycle/authority-integration milestone.**

PRE-06 is a material app integration boundary: PRE-02 wallet/session authority, PRE-03 human review, PRE-04 backend quote structure, PRE-05 authenticated provenance, canonical transaction construction, fresh preflight, wallet submission controls and transaction lifecycle semantics now converge in one state machine.

The exact-head retained Exchange workflow revalidated those accumulated components together. No repository-wide Solidity/Genesis, Geth, Docs/global or unrelated-app qualification was run as a PRE-06 completion requirement.

## Exit criterion

> full swap path is testable end-to-end with mocks and deterministic state transitions; real sends remain impossible by default.

**SATISFIED.**

The complete swap authority path is deterministic and mock-testable through the guarded wallet boundary and lifecycle tracking. Checked-in runtime and the low-level sender both remain fail-closed for real submission by default.

## Current-main divergence review

At implementation closeout, current `main` was `53b38901a2d7ead875eb606625ae99bf3c1e1069`.

The 59 commits between the audit base and current `main` affect Compute Market contracts/config/docs/scripts and shared qualification workflows. They do not modify:

- `exchange/web/**`
- `exchange/quote-service/**`
- `.github/workflows/exchange-web.yml`

Therefore PRE-06 exact-head Exchange qualification is not invalidated by current-main divergence. Full reconciliation remains intentionally deferred to PRE-12.

## Level 3 app-phase status

**Deferred to PRE-12.**

Repository-wide contract/Genesis qualification, 420 Integrated, Geth where applicable, Docs/global reconciliation, final deployment/config reconciliation and final exact-head monolithic merge-candidate qualification remain PRE-12 responsibilities.

## Limitations / deliberately deferred work

- Real public-testnet wallet sends remain disabled by default.
- Real deployed addresses/code hashes, balances, allowance state, gas/nonce conditions and settlement receipts remain live-testnet qualification gates.
- PRE-10 still owns the production Exchange V13 read/Indexer/startup adapter.
- PRE-07/PRE-08 own complete order publication/cancellation integration.
- PRE-09 owns complete bridge proof/destination-settlement architecture.
- PRE-11 owns final app packaging/security/operations closure.
- PR #430 remains draft and must not merge until PRE-12.

## Next canonical roadmap step

**PRE-07 — limit-order publication lifecycle.**
