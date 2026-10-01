# 420Exchange PRE-06 — guarded swap orchestration qualification

**Canonical roadmap:** `docs/420EXCHANGE-PRE-TESTNET-COMPLETION-ROADMAP.md`  
**Step:** PRE-06 — guarded swap orchestration  
**Completion state:** COMPLETE  
**Qualification level:** Level 1 step-specific + Level 2 Exchange lifecycle/authority-integration milestone  
**Audit branch / PR:** `audit/exchange-pretestnet-phase-20260930` / PR #430  
**Audit base SHA:** `4d0ede3692efe55f04a50c7bf5b749afe579eccb`  
**Original qualified implementation SHA:** `011ae238b7fdbf9643a339c71cf9357100391962`  
**Post-PRE-10 requalified accumulated implementation SHA:** `46e97d69a51deaad9460f9145735ee1cf96f658a`  
**Current repository `main` observed at requalification:** `df8f639d8f43b763298c8750ef49d3e5849c597c`

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

### Current accumulated-app requalification

After PRE-07 through PRE-10 were completed and PRE-05 was explicitly revalidated, PRE-06 was reopened against current repository truth rather than relying only on its original closeout.

Exact accumulated implementation SHA:

`46e97d69a51deaad9460f9145735ee1cf96f658a`

Required app-specific workflow:

- **420Exchange Web Verification**
- run `36802037691`
- run number `730`
- event: `pull_request`
- exact head: `46e97d69a51deaad9460f9145735ee1cf96f658a`
- **SUCCESS**

On that exact accumulated implementation SHA, the workflow reran:

- PRE-04/PRE-05 quote backend static/authentication qualification — SUCCESS;
- quote backend unit/HTTP/authentication tests — SUCCESS;
- PRE-10 read-service static and contract/integration tests — SUCCESS;
- complete 420Indexer shared-dependency test suite — SUCCESS;
- Exchange web static checks, including `check-pre06.mjs` — SUCCESS;
- all Exchange web unit/integration tests, including PRE-06 mock-E2E/adversarial coverage — SUCCESS;
- deployable browser artifact build/verification — SUCCESS;
- retained PRE-02 Chromium acceptance — SUCCESS;
- retained PRE-03 authenticated-quote Chromium acceptance — SUCCESS;
- frontend secret scan — SUCCESS.

The requalification confirms that PRE-07 through PRE-10 did not weaken the PRE-06 review/confirmation/preflight/send authority boundary, lifecycle semantics or default-OFF submission behavior.

No executable PRE-06 remediation was required.

### Original PRE-06 closeout

Exact original implementation SHA:

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

At post-PRE-10 PRE-06 requalification, current `main` was `df8f639d8f43b763298c8750ef49d3e5849c597c`.

The 80 main-side commits since the audit base do not modify:

- `exchange/web/**`;
- `exchange/quote-service/**`;
- `exchange/read-service/**`;
- `420-indexer/**`;
- `.github/workflows/exchange-web.yml`.

Therefore there is no upstream PRE-06 implementation conflict requiring step-local reconciliation. Full branch reconciliation remains intentionally deferred to PRE-12.

## Level 3 app-phase status

**Deferred to PRE-12.**

Repository-wide contract/Genesis qualification, 420 Integrated, Geth where applicable, Docs/global reconciliation, final deployment/config reconciliation and final exact-head monolithic merge-candidate qualification remain PRE-12 responsibilities.

## Limitations / deliberately deferred work

- Real public-testnet wallet sends remain disabled by default.
- Real deployed addresses/code hashes, balances, allowance state, gas/nonce conditions and settlement receipts remain live-testnet qualification gates.
- PRE-10 is now COMPLETE and supplies the production Exchange V13 read/Indexer/startup adapter consumed by lifecycle reconciliation; its projections remain non-authoritative.
- PRE-07/PRE-08 are now COMPLETE for order publication/cancellation integration.
- PRE-09 is now COMPLETE for bridge proof/destination-settlement architecture.
- PRE-11 owns final app packaging/security/operations closure.
- PR #430 remains draft and must not merge until PRE-12.

## Post-PRE-10 requalification conclusion

**PRE-06 remains COMPLETE.**

All original canonical exit criteria remain satisfied on the current accumulated Exchange implementation. No executable PRE-06 remediation was required. The current requalification is retained at implementation SHA `46e97d69a51deaad9460f9145735ee1cf96f658a` using Exchange workflow run `36802037691` / #730.

## Next step in the roadmap's recommended dependency order

After PRE-05, the recommended execution order proceeds to **PRE-06**. That dependency-order checkpoint is now explicitly revalidated and COMPLETE.

The next **unfinished** canonical roadmap step is **PRE-11 — CI/security/packaging/operations closure.**
