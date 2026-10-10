# COM-2 — qualification evidence

Status: COMPLETE at targeted Level 1 and retained Level 2 integration; exact-SHA GitHub qualification PASS. Full app-phase Level 3 and live deployment remain separately deferred.

- GitHub implementation SHA: `0b1a3f5d12fdf6d5c76e6ba860058887886daf9f`.
- Local implementation SHA: `153e371ce97d69c44e79eca432c632f1541ab4f2`; identical tree `960f89c7956134a20c4277887dde9cf7cae1c00d`. Connected API publication changed only commit metadata; remote CI independently qualified the GitHub SHA.
- Reconciliation main/base: `0ec695481fc84e6066aeae50baf6e0fd3c7f8731` (PR #588 merge).
- Audit branch: `audit/420commerce-com-2-upstream-adaptations`.
- PR: #594, draft and unmerged.
- Current HEAD: the evidence-only commit containing this record inherits the implementation SHA; no source, tests, configuration or requirements changed in that commit.

## Implementation and exit criteria

The source/requirement disposition and integration contract are in `COM-2-UPSTREAM-ADAPTATIONS.md`. Changes: new Market-owned Pay reporter; additive read-only getters in Order/Payment/Invoice registries; 29 reporter tests; six-test-unit retained qualification script; proposed undeployed config; exact-head fast workflow; historical COM-1 status reconciliation. No independent Commerce order/payment protocol, funds custody, active deployment, frozen address or Genesis membership changes.

## Verified local qualification (2026-10-09 UTC)

The final run executed on unchanged committed implementation `153e371ce97d69c44e79eca432c632f1541ab4f2`, using Foundry 0.8.24 compiler configuration and repository `pr` profile. Command: `FOUNDRY_PROFILE=pr python scripts/commerce/qualify-contracts.py` with installed Forge on PATH.

| Suite | Passing tests |
| --- | ---: |
| MarketPaySettlementAdapter420 | 29 |
| Market420 | 8 |
| PayAudit3Lifecycle420 | 4 |
| PayAudit4SettlementAndAccounting420 | 6 |
| PaymentAtomicSettlement420 | 4 |
| PayFocusedHardening420 | 6 |
| Total | 57 |

Zero failures; zero skipped tests. Partial-refund reservation conservation fuzz: 2,500 runs. Complete transitive import closure: 46 Solidity files. Compiler successful. Native/swap canonical Pay regression tests retained. Reporter negatives cover identity, asset, amount, invoice/order binding, receipt/finality, invoice modes/currency, duplicate/second payment, cancellation/completion, chain mismatch, policy/merchant revocation, rollback and partial/tip refunds.

Production runtime/initcode size checks PASS: reporter 4,738 / 5,167 bytes; Order 5,238 / 5,580; Invoice 9,916 / 10,226; Payment 11,851 / 12,203; Merchant 6,639 / 6,934. All below applicable limits. Changed adapter/test formatting, diff whitespace, Python compilation, proposed config JSON and undeployed/no-new-service-ID policy checks PASS.

Static lint emitted one unused-return advisory for intentionally discarded merchant profile/metadata/status/payout fields; controller and active are consumed. No failing lint result. This does not claim an independent full security audit or global static-analysis gate.

## Verified exact-SHA GitHub qualification

Workflow `.github/workflows/commerce-contracts.yml`, push run [37890773444](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37890773444), attempt 1: overall SUCCESS. Job `qualify` 113690970323: SUCCESS. All steps passed, including exact-SHA checkout verification, all six retained suites, production runtime/initcode checks and changed adapter/test formatting. Logs establish SHA `0b1a3f5d12fdf6d5c76e6ba860058887886daf9f`, 57 tests passed/0 failed/0 skipped and 2,500 partial-refund conservation fuzz runs. This independently qualifies the published implementation, not merely an equivalent local result.

Explicit user authorization cleared publication review. Shell GitHub credentials were unavailable; authenticated connected GitHub APIs published the identical implementation tree. No authorization blocker remains.

The PR event also automatically started run 37890775336 on the same SHA; it is a duplicate targeted run, not a separate required qualification inventory. No manual duplicate or broad qualification was dispatched. Expected skipped audit/global jobs do not count as passing evidence. Ancillary governance-deployment-audit push run 37890771943 reported failure with zero jobs; its workflow is unchanged and outside the Commerce diff. No protocol test failure was established from that no-job record, and this does not claim repository-wide green or resolve that workflow-level issue.

Evidence-only publication references the qualified implementation SHA. Its commit uses `[skip ci]` to avoid recursively rerunning already verified qualification; no executable source, tests, workflows, dependencies, configuration or substantive requirements change in that evidence commit.

Level 2 integration milestone is satisfied by the six retained Market/Pay units on the verified remote candidate. Level 3 comprehensive security/global qualification remains deferred to the full app-phase closeout, not duplicated here. COM-8 live chain/deployment/funds/reorg evidence and COM-9 mainnet authorization remain separately gated. Next canonical phase: COM-3 — Service + API.
