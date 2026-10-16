# BET-AUDIT-4.4 — economic calibration and independent approval ledger

**Status: PENDING INDEPENDENT APPROVAL. NOT A PRODUCTION RELEASE.**

This document is an approval request and audit chain of custody, **not** a signature, endorsement, or completed qualification certificate.

## Candidate evidence

- Original uncalibrated fixture audit: [CI run 38938994888](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38938994888). Deterministic seed 4204401, 25,000 wagers, reported estimated RTP **3,086.7666%** at 100-unit stake, fixture SHA-256 `6a67983232d177763ffb76ea25d509ec10e895fd3dee389b023bf89ddfbcfbfb`.
- Calibrated **research candidate only**: `scripts/calibrate-420bet-reference-slot-rtp.py`, dividing base fixture prize values by 32 and replaying a fresh, seeded 25,000-wager Monte Carlo. CI workflow `.github/workflows/420bet-reference-slot-calibration.yml`.
- The calibration script currently uses floating-point candidate awards, whereas Solidity requires integer-denominated payouts. The script is therefore a screening estimate, **not** a bit-exact deployment artifact or an acceptable final RTP certificate.
- Both models use independent uniform stop draws rather than replaying the actual on-chain keccak draw mapping. A rigorous RTP certificate must reproduce the deployed candidate precisely, including integer rounding, cap, trigger, retrigger and base/feature paths.

## Risk accounting proved by current contract boundaries

At the test fixture stake of **100** and an approved gross cap of **5,000**, the per-wager maximum net bankroll liability is **4,900** units. This is a *deterministic cap guarantee*, independently of RTP. The maximum gross award itself must remain <=5,000 and the 500,000 bps maximum-gross multiplier in the test authority must be enforced before acceptance. Those values are *test fixtures*, not authorization for real bankroll funding.

## Required independent decisions / approval record

1. Named authorized economic policy approver **other than the implementation author**, explicit signed decision and date.
2. Authorized production RTP target, acceptable tolerance, currency/stake unit and payout rounding rules.
3. An economically viable, immutable reel and paytable candidate with exact ABI-encoded digest, not merely a Python fixture hash.
4. Independent recalculation of its cap-aware RTP, feature probability model and worst-case gross and reserved liabilities; report reproducible inputs, code revision, reviewer and methodology.
5. Approval of bankroll reserve limits, correlated exposure ceiling and funding/operational constraints by separate risk authority.
6. Evidence that the registry's reel/paytable/RTP/liability hashes equal those of the approved artifacts, and that only authorized activation can bind them to a version.
7. Live deployment, on-chain registration and acceptance proofs deferred only to the testnet/production ledger.

| Authority | Decision | Reviewer | Signed evidence | Date |
|---|---|---|---|---|
| Economic/paytable policy | **PENDING** | — | — | — |
| Independent RTP reviewer | **PENDING** | — | — | — |
| Bankroll/liability risk reviewer | **PENDING** | — | — | — |

A passing CI job proves a calculation executed; it **cannot replace these independent approvals**. Do not activate or label BET-AUDIT-4.4 fully qualified until the required exact mathematical proof and authentic signatures exist.
