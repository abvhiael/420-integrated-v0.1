# GOV-PRE-03 — Founding financial authority, exact Treasury release and capability qualification

## Status and evidence

**CODE / LOCAL SETTLEMENT QUALIFIED — LIVE FOUNDING TREASURY NOT DEPLOYED, FUNDED OR AUTHORIZED.**

- Authoritative repository: `abvhiael/420-integrated-v0.1`
- Qualified Solidity and policy implementation SHA: `6b38a248a61cc542754d0772af3dc493658f53d4`
- Focused exact-head workflow: [Founding Treasury bounded authorization #44974695911](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44974695911), **SUCCESS**; job ID `137061855188`
- Solidity compiler: **0.8.24**, both test import closures compiled cleanly using pinned repository sources
- `FoundingTreasuryAuthority420.t.sol`: **15 passed, zero failed/skipped**
- `FoundingTreasurySettlement420.t.sol`: **3 passed, zero failed/skipped**
- Total scoped Foundry tests: **18/18 passing**.
- `scripts/verify-founding-financial-policy.py`: **PASS_CODE_CANDIDATE_ONLY**; Genesis 42,000,000 $420, Operations 4.2M, Contingency 840K, no new mint or funded-Vault claim
- Exact-head checks explicitly verified the Git SHA before running tests.

## Verified authorization behavior

- **Routine Operations**: only the *claimed Administrator* can propose/schedule/release routine payments; up to 105K $420 per payment and 105K per same-recipient conservative rolling 30-day window.
- **Exceptional Operations**: any two *distinct, claimed founders*, up to 420K per approved payment, subject to 48h public notice. Founder-related payments require two even when below routine amount.
- **Emergency Contingency**: infrastructure, application recovery or security only; any two distinct founders and 48h notice, or unanimity of all three for immediate action; maximum 210K per case/incident aggregated across every recipient sharing the canonical incident/evidence hash.
- **Aggregate caps**: Operations 840K / conservative rolling 30-day window, lifetime 4.2M; Contingency 420K / rolling window, lifetime 840K. Both schedule-time and actual-release-time guards operate independently.
- **Public notice**: an on-chain `FoundingPaymentNotice` at proposal time publishes indexed payment ID, evidence hash, unique immutable purpose hash, proposed/not-before/expiry dates and elevation flag. The disbursement stores that same commitment after the notice interval. The case hash must not be reassigned during scheduling.
- **Anti-splitting**: two initially routine same-recipient proposals cannot escape escalation merely by concurrent creation; identical submitted details produce different payment-bound disbursement IDs; a single incident cannot use several payee addresses to exceed 210K when its shared evidence identifier is preserved. Cryptographically linking *different* incident evidence identifiers or different natural persons requires independent identity/case verification; neither can be inferred from hashes alone.
- **Access control**: a Civic Treasury writer is blocked from directly injecting disbursements into founding budgets. A grant-bearing executor cannot create a founding `markExecuted` record outside the controller's currently active, exact release.

## Genuine local end-to-end settlement

`FoundingTreasurySettlement420.t.sol` deploys the **real** `CapabilityRegistry420`, `ProtocolRegistry`, `TreasuryAuthorization420`, `TreasuryBudgetRegistry420`, `TreasuryDisbursementRegistry420`, `TreasuryPolicyRegistry420`, `VaultAuthorization420`, `VaultPolicyRegistry420`, `VaultRegistry420`, `VaultAccounting420`, `AssetVault420`, `TreasuryRouter420`, `VaultRouter420` and `TreasuryReleaseExecutor420`. Test-only founders, Civic readiness and local test balances are fixtures, NOT real Genesis wallets or chain funding.

Positive scenario:
1. Create two real native Treasury Vaults; initialize fixed founding budgets with genuine one-time Registry bindings.
2. Fund Operations Vault with 20 native test units; propose, authorize and schedule a 5-unit native payment to the fixed beneficiary.
3. Check that no grants or only the Treasury grant fail, and that the routine payment cannot be released by Andrew or with a wrong review commitment; none can move balances or consume budget execution state.
4. With both exact Treasury disbursement/amount and Vault vault-asset-recipient-action-amount grants, `TreasuryReleaseExecutor420.preview` produces reviewed evidence and native release executes.
5. Assert recipient **+5**, Vault **−5**, Treasury budget executed **+5**, canonical disbursement `EXECUTED`, exact nonzero release commitment, Vault native released accounting **+5**, vault operation ID consumed, founding rolling released **+5** and in-progress marker cleared.
6. Assert second release and direct forged `markExecuted` fail, recipient and recorded value stay unchanged. Also assert expired scheduled disbursement cannot release funds.

Security design: the Founding authority is a **noncustodial controller**, not a Vault withdrawer. A founding settlement accepts only the reviewed codehash-pinned one-shot executor, whose `operator()` is immutable and equals this authority. It does not grant spending capabilities: both independent, actual Treasury/Vault Registry grants and current live service/codehash bindings are required. A failed native withdrawal, callback, grant, accounting proof or Registry reconciliation reverts the entire transaction.

## Preserved constraints and external release blockers

- The 42M Genesis ledger, its 8.6M ProtocolReserve source and non-additive 4.2M/840K founding earmarks were not reallocated or supplemented. The two founding Vaults are **not** actually funded on testnet or mainnet.
- Founder wallet enrollment GOV-PRE-02 was expressly **deferred to testnet**: three independently controlled production addresses, signatures and finalized on-chain claims remain absent. No administrator, Andrew or Janet was impersonated with a fabricated production wallet.
- The actual codehash-pinned `FoundingTreasuryAuthority420.bindReleaseExecutor` deployment, canonical Treasury/Vault Registry bindings, recipient-bound independent capability grants and external transaction/Vault accounting receipts require real testnet deployment and exact-runtime verification.
- The historical `FROZEN_V3` Genesis commitment and frozen 0x04xx system address assignments remain intact; a new approved signed V4, release materialization, retirement settlement and other Genesis gates are NOT waived by successful local tests.
- Do not assert CODE QUALIFIED implies TESTNET READY, GENESIS READY, SECURITY REVIEW COMPLETE, or PRODUCTION READY.

**Scope completion:** GOV-PRE-03 approved-policy and exact local Treasury enforcement candidate implemented and locally qualified. Live post-Genesis identities, externally funded Vaults and receipts are explicitly deferred. Next independent canonical workstream: **GOV-PRE-04 — Fully sponsored validators and actual 10% community reward settlement**; not begun here.
