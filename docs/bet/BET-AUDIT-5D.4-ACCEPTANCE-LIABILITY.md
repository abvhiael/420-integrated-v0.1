# 420Bet 5D.4 — Funded admission and liability

## Status: funded admission implementation candidate; scoped CI pending; production qualification incomplete

The preview module SportsBetAcceptance420 retains immutable price bounds, quote-digest checks and market risk configuration. SportsFundedTickets420 is the new actual funded ticket authority. Direct player transactions transfer the *exact* token stake into a guarded vault, with strict before/after balance verification; a hash supplied by the caller is **not** treated as a funding receipt. Operator account collateral is separately transferred to the vault and profit exposure is reserved on the same atomic admission transaction. Per-player, per-selection and per-market exposure caps are evaluated before accepting each bet. Replays reuse the player's nonce and fail. Tickets record locked gross returns, profit, quote digest, epoch and market terms.

Payouts use pull credits and a nonreentrant withdrawal, with a unique terminal state. Winnings consume the reserved operator profit; losing stakes become operator collateral; refunds after the registered policy delay return the exact stake and release profit reservations. Operators cannot withdraw reserved collateral. Revoked/stale quotes or unavailable markets reject new admissions; existing ticket payout rights do not depend on continued market opening.

## Mandatory remaining release barriers

- The **outcome authority**: RESOLVE permission is a capability gate, not independent proof of the sporting outcome. Production deployment must attach dispute, oracle finality, challenge and appeal controls, and prove independent source rights before authorizing any resolver. Timeout refunds are the fail-safe; do not grant RESOLVE in production before its later-phase controls qualify.
- Regulatory, identity, jurisdiction, anti-abuse, wallet screening, asset allowlist and operator solvency beyond one isolated market must be evaluated. No live sportsbook or legal authorization is asserted.
- Independent adversarial qualification: test false-return, fee-on-transfer, reentrant and malicious tokens; altered market/quote statuses; correlated market exposures; insolvency; front-run intent and denial of service; refunds and withdrawals; exact-SHA compile, deployment-size and static security analysis. These are required to certify 5D.4.
- A suitable final audited ERC20 custody asset and operator economic risk policy must be explicitly approved before release.

The new vault is not a deployment authorization. The old acceptance.accept deliberately remains disabled to avoid mistakenly treating the preview adapter as a custody vault. Use SportsFundedTickets420.fund only in controlled integration tests until the above release gates are met.


## 5D.4 outcome certification and disputes (pre-testnet)

`SportsOutcomeCertification420` requires two distinct designated source-reporting accounts to submit identical market-selection/evidence commitments. Mismatch is fail-closed. The configured challenge period is at least one hour; anyone can challenge a proposed result before its deadline. A challenged result cannot auto-finalize. The separate adjudicator may only uphold the originally attested selection or void it. The funded vault accepts only FINAL results, with a matching ticket selection, for payout; VOID supports stake refunds. No unilateral operator-generated result is accepted in the new vault.

**Security limitation:** Separate Ethereum addresses do not prove independent beneficial ownership, different data origin or independent verification. Reporters are currently trusted role keys rather than independently proven sports-data publishers. The adjudicator is trusted to review external evidence, and challenge evidence is emitted but not cryptographically verified. There are no appeal tiers, committed evidence blobs or enforceable challenge bonds. Timeout refunds provide a fallback. More extensive property/fuzz tests, malicious-token tests, multi-market collateral insolvency analysis, token allowlist, atomic credential checks and formal review remain outstanding. Do not interpret a green unit test as adversarial Level 3 qualification.

## Deferred to testnet roadmap (BET-5D.4-TN)

1. Provision separate, operationally independent reporting organizations and attest evidence provenance, licensing and source finality over real scheduled fixtures.
2. Run funded W420/$420 end-to-end admission, chain reorganization and provider downtime tests, ERC20 funding reconciliation and bridge/wallet confirmation tests on active testnet.
3. Exercise real challenge and arbitration operating procedures, withholding and collusion simulations, finality deadlines, false data and cross-chain replay.
4. Validate risk utilization across correlated markets and treasury/operator solvency with live testnet balances and concurrent wagering.
5. Confirm compliance, regional eligibility, identity, dispute notices and refunds before any production deployment.

These tasks are intentionally *not* represented as passed or fulfilled on a non-running testnet.
