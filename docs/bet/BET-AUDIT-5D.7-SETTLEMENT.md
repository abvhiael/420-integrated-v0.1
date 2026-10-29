# 420Bet 5D.7 — Settlement, payouts, voids and refunds

## Canonical settlement rules (version 1)

This phase implements independently certified special outcomes alongside ordinary winner/loss settlement, audited receipts and permissionless timeout/VOID refunds. **No outcome can settle an Oracle-bound market without the canonical Oracle gate verifying its feed commitment, confidence, quorum and freshness.**

- **Ordinary winner/loser:** final certified valid market selection determines gross winner payout or zero loser payout, respectively. Unknown selections cannot be treated as losses.
- **PUSH:** valid only for SPREAD or TOTAL templates; once independent reporters attest a push and it becomes unchallenged FINAL, the ticket receives exactly its original stake. A push is not a winner and transfers no operator profit.
- **NO_ACTION:** if the independent reporters certify no action, a FINAL no-action result returns exactly the stake for each ticket; event interruption can also use the separately enforced refund policy and deadlines. No-action cannot be introduced by an operator or a unilateral signer.
- **DEAD_HEAT:** for MONEYLINE_TWO or MONEYLINE_THREE templates, two distinct, canonical market selections can be certified as tied in a two-way dead heat; they must appear in strictly increasing byte order in *both* independent reports. Every ticket backing one of the two tied selections is credited floor(locked gross return / 2), even if that is less than its original stake. Other selections receive zero. The unused remainder remains operator collateral. This is the frozen **two-way** dead-heat version-1 rule; multiway ties and alternative fraction economics are not silently supported and require a new approved policy version.

The two independent result reporters must certify matching special kind, selection identities and source evidence. Any conflicting claim reverts; a third party may challenge within the existing period and a separately designated adjudicator may uphold or VOID, but cannot replace the certified selection or special terms. Finality remains one-time. A timeout refund remains separately available under the immutable market-template deadline.

### Ledger and receipt semantics

Each ticket has one terminal outcome. Newly appended enum values PUSH, NO_ACTION and DEAD_HEAT preserve the numeric identities of NONE/FUNDED/WON/LOST/REFUNDED. Final receipts retain the terminal result, credited payout, evidence hash, executor and timestamp. On closure, pending stake and profit exposure are released. The operator collateral delta on dead heat is `stake - creditedPayout`, negative when profit is owed and positive when locked gross/2 is less than stake. Exact ERC-20 aggregate liability, asset collateral, pending stake and customer credits must reconcile before and after claim.

### Security requirements

- Never accept a special outcome through the ordinary winner/loser settlement entry point.
- Never permit a direct legacy resolver to bypass a market-bound Oracle gate.
- Reject forged/missing/stale/cross-market/low-quorum/low-confidence special Oracle commitments.
- Reject duplicate or unknown tied selections, unauthorized report publishers, conflicting reports, premature certification, double closing and post-final changes.
- Never allow a special outcome to authorize payout above the original locked gross; no additional collateral requirements are created beyond conservative funded admission.
- On cancellation, void, missing reports or nonfinal disputes, preserve stake through the existing safe refund path. Preserve no-entry/failed settlement rollback invariants.

### Qualification

Retained test files:
- `contracts/test/sports-5d7/SportsSettlementLifecycle420.t.sol`
- `contracts/test/sports-5d7/SportsSpecialSettlement420.t.sol`
- `contracts/test/sports-5d7/SportsSpecialOracle420.t.sol`

The scoped workflow runs all 5D.7 tests, including inherited prior-stage regression and fuzz properties; impacted 5D.6 regression workflows cover the shared vault and oracle gate. All qualification claims must be tied to the final exact implementation SHA, not previous green runs.

### External acceptance

Actual sports-feed licenses, independently owned reporter keys, production operator restrictions, deployed W420 custody and finality/reorganization/outage proof remain in the existing canonical 5D.4/5D.6 testnet work ledgers. These cannot be discharged by simulated local reporter or mock-Oracle tests.
