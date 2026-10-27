# BET-5D.4 — Testnet-dependent acceptance and settlement qualification

**Dependency:** active 420 Integrated testnet, registered validator/asset contracts, and independent operational evidence reporters.
**Status:** deferred. None of these tasks is represented as passed by Foundry unit tests.

| ID | Dependency | Testnet evidence and acceptance gate |
| --- | --- | --- |
| BET-5D4-TN-01 | Active chain and custody asset | Deploy approved W420/$420-backed custody, cross-check vault balances with token and accounting ledgers across restarts, failures and finality |
| BET-5D4-TN-02 | Independent source providers | Bind separately operated reporter keys, establish licenses and origin attestations for fixture data and make collusion/withholding evidence reviewable |
| BET-5D4-TN-03 | Real fixture reporting | Validate official end-of-event finality, postponements, cancellations, corrections, conflicting provider data and late challenges against actual provider feeds |
| BET-5D4-TN-04 | Adjudication operation | Exercise notices, challenge windows, adjudicator independence, frozen claims, void decisions, unauthorized callbacks and no-double-close evidence |
| BET-5D4-TN-05 | Chain faults | Test key rotation/revocation, chain reorganizations, transaction replacement, nonce replay, stale quotes, RPC outage and settlement retries |
| BET-5D4-TN-06 | Economic stress | Prove multi-market and correlated-outcome risk bounds; reconcile funded stakes, open profit liabilities, operator reserves and treasury claims |
| BET-5D4-TN-07 | Launch gating | Audit authorized collateral tokens, identity and geographic restrictions, regulatory approvals, operator onboarding and user refund processes |

**Pre-testnet scope:** deterministic Solidity unit, adversarial and fuzz tests; exact-SHA CI; per-market funds invariants; audit findings. The prototype certifier requires agreement from two configured reporting addresses but it cannot demonstrate operational independence or independently prove external sporting facts. An appointed arbiter may uphold the report or void it. A dispute carries evidence but does not supply cryptographic data-provider proof.

**Do not grant production resolver capability or operate real-money wagering until all release dependencies are independently qualified.**
