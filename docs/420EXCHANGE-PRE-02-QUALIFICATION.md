# 420Exchange PRE-02 — Wallet/session invalidation closure qualification

**Canonical roadmap:** `docs/420EXCHANGE-PRE-TESTNET-COMPLETION-ROADMAP.md`  
**Step:** PRE-02 — Wallet identity, request-generation and invalidation closure  
**Completion state:** COMPLETE  
**Qualification level:** Level 1 — per-roadmap-step fast qualification  
**Audit branch / PR:** `audit/exchange-pretestnet-phase-20260930` / PR #430  
**Base `main` SHA:** `4d0ede3692efe55f04a50c7bf5b749afe579eccb`  
**Qualified implementation SHA:** `323f0c8cf1400d54cdee3d4dda53aae5615de681`

## Canonical requirements and disposition

| Requirement | Disposition |
| --- | --- |
| Selected V15 provider/session is the sole future execution identity | SATISFIED — V14 display application remains unable to create/own a Wallet session or signing/submission authority; V15 `BrowserExecutionController` owns the selected provider/session. |
| Invalidate requests, quote candidates, preflight and proposed confirmation state on account/chain/provider/runtime/page/trade-input changes | SATISFIED — controller generation is the central execution-context authority; wallet/provider events, `replaceRuntime`, page/navigation/visibility and read-only trade-input edits advance or revoke that generation. A new quote request also supersedes the previous quote epoch, so a changed route/path cannot reuse an earlier review. |
| Superseded asynchronous responses cannot restore authority | SATISFIED — quote reviews bind to `captureExecutionContext()` / `assertExecutionContext()`; stale provider connection, late quote responses and preflight completion after invalidation fail closed. |
| Deterministic listener/controller disposal across provider replacement, navigation/remount and teardown | SATISFIED — prior provider listeners are removed, prior WalletController is disposed, pagehide teardown removes browser listeners, and discovery/provider replacement cannot preserve the superseded session. |
| V14 display surfaces cannot create or reuse execution authority | SATISFIED — retained PRE-02 V14 containment regressions prohibit Wallet construction, EIP-1193 account requests, signing builders and send/sign methods in the V14 display app. |
| Deterministic browser/DOM coverage for reconnect, input/navigation and slow/ignored-abort races | SATISFIED — retained PRE-02 provider/session/disposal tests plus new central invalidation/preflight tests cover these paths. |
| Signing/submission remains hard-off | SATISFIED — browser execution controls remain locked; PRE-02 does not enable live `eth_sendTransaction` or typed-data signing. |

## Gap analysis resolved

The pre-existing V15.11 implementation already handled provider/account/chain replacement and local quote-panel clearing, but page/input/runtime invalidation was not a single authority shared by quote review, preflight and future confirmation state. PRE-02 closes that gap by making the BrowserExecutionController generation the central invalidation boundary.

Implemented:

- `invalidateExecution(reason)` for non-wallet execution-context invalidation;
- reasoned `unbind(reason)` for provider authority revocation;
- `replaceRuntime(runtime)` to revoke the old Wallet authority when deployment/runtime identity changes;
- `captureExecutionContext()` and `assertExecutionContext()` for review/preflight/confirmation generation binding;
- QuoteReviewSession binding to the controller execution token rather than only local wallet fields;
- browser navigation, page visibility, view replacement and trade-input changes wired into central invalidation;
- stale-preflight regression proving invalidation after gas estimation starts prevents `eth_sendTransaction`;
- late-quote regression proving central navigation invalidation rejects the result even when transport ignores abort;
- updated read-only/quote-session harnesses and static qualification markers.

## Files changed on the qualified implementation head

- `exchange/web/core/browser-execution-controller.js`
- `exchange/web/core/quote-review-session.js`
- `exchange/web/browser-wallet-ui.js`
- `exchange/web/read-only-swap-review-ui.js`
- `exchange/web/test/pre02-execution-invalidation.test.js`
- `exchange/web/test/pre02-browser-session-guards.test.js`
- `exchange/web/test/quote-review-session.test.js`
- `exchange/web/test/read-only-swap-review-ui.test.js`
- `exchange/web/scripts/check-v15.11.mjs`
- `exchange/web/v15.11-qualification.json`

## Level 1 qualification

Exact implementation SHA: `323f0c8cf1400d54cdee3d4dda53aae5615de681`

Required app-specific workflow:

- **420Exchange Web Verification** — run `36773059266` / run number 450 — **SUCCESS**

Successful retained steps:

- Static Exchange checks
- Exchange web unit tests
- Build and verify PRE-02 deployable browser artifact (qualification only)
- Chromium browser-test runner installation
- PRE-02 built-preview Chromium acceptance using simulated EIP-1193 providers
- PRE-02 browser acceptance artifact preservation
- Frontend secret scan

An earlier run, `36772916795`, failed because the first test-harness revision contained a syntax artifact and legacy fake quote controllers did not implement the new central execution-context API. Those harness defects were corrected; they are not treated as qualification evidence.

## Security and authority invariants retained

- Display/fixture state never becomes execution authority.
- A connected Wallet does not make V14 controls executable.
- Context invalidation during preflight prevents stale submission.
- Runtime/deployment replacement revokes the prior Wallet authority.
- A transaction hash is not introduced as settlement/finality evidence.
- PRE-02 introduces no production/testnet signing enablement and no live-network claim.

## Level 2 milestone status

**Deferred — not required for PRE-02.** PRE-02 is an identity/invalidation closure step and does not introduce a new cross-service backend or shared protocol dependency. The broader Exchange integration suite will be run at a meaningful convergence milestone after the quote/API/orchestration work accumulates.

## Level 3 app-phase status

**Deferred to PRE-12.** No repository-wide Solidity/Genesis inventory, 420 Integrated, Docs/global reconciliation, Geth, global fault/soak or unrelated app audit is required to qualify PRE-02 under the active phase model. Those comprehensive checks are reserved for the exact accumulated Exchange merge candidate at PRE-12.

## Limitations

- Real Wallet-extension/mobile/device qualification remains a live-testnet/release gate.
- Real deployed Exchange runtime/contract/code-hash evidence is unavailable until testnet deployment.
- PRE-02 does not authenticate executable quote provenance; PRE-04/PRE-05 own that work.
- PRE-02 does not enable swap/order/cancel/bridge execution.

## Next canonical roadmap step

**PRE-03 — production-quality read-only swap entry and review UX.**
