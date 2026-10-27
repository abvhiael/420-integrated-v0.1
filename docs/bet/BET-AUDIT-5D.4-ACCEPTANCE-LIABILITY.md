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
