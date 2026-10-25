# Approved NHL formats — implementation and local qualification

The approved V1 rules are implemented in the separate `formats/` domain engines, source/publisher adapters, confidential client/custodian adapters and canonical funded Solidity modules. Existing daily sources remain unchanged. This document describes implementation scope; only an executed clean-SHA `qualification.json` from `qualify-approved-formats.py` establishes a passing qualification.

## Contract and client paths

| Component | Responsibility |
| --- | --- |
| `FantasyFormatBook420` | Canonical oracle-authenticated salary/position/team snapshots and full official schedule; frozen pick board; real Merkle statistics verification; NHL points and exact captain multiplier; participation, pushes, voids and short-schedule correlation whitelist. |
| `FantasyFormatEscrow420` / `FantasyHouseEscrow420` | Separate peer/house custody; canonical verified identity and scoped actions; receipt-bound encrypted selection and post-lock publication; fixed 3% development allocation; peer tie-aware ranking and refunds; independently prefunded gross 3x/5x house exposure plus fee reserve; affected-result disputes and canonical refunds. |
| `FantasySeasonData420` | Frozen versioned calendar/inventory and original game/week identity; per-game NHL and category statements; official starter/participation fields; original correction/challenge/resolution clocks; canonical report identities and cancellation facts. Inventory publication and frozen ranking can be batched before funding. |
| `FantasySeasonRoster420` / `FantasySeasonMath420` | Exclusive twelve-player rosters, snake order from canonical randomness, exact league-wide Hall matching, private preference proofs, bounded permissionless timeout scans, deterministic carry/fallback, immutable locked history. |
| `FantasyDraftEntropy420` | Genuine two-provider precommitted preimages verified for the exact canonical randomness request and draft purpose. Withholding cannot select a substituted result; missed draft deadlines refund. Distinct local addresses are not evidence of independent provider ownership. |
| `FantasySeasonActions420` / `FantasySeasonTransactions420` | Verified controller authority, private receipts/nonces, ranked sealed waivers and rotating priority, trades before waivers, equal-player bilateral trades, 24-hour review, conflict-free scoped review, documented challenge decisions and fixed transaction cutoffs. Successful transaction intents count for early-start recovery. |
| `FantasySeasonScores420` / `FantasySeasonEscrow420` | NHL bonuses calculated per game, raw category numerators/denominators, weekly/season goalie minima, all four ranking modes, original-week exclusions and voids, weekly dispute finality, final exact rankings/prizes, fee-inclusive cancellation refunds and bond recovery. |
| `formats/publisher.py`, `approved.py`, `selection.py`, `timing.py`, `source.py` | Salary history/median/midrank calculations, independent domain replay, full-schedule eligibility, DST windows and complete source-field validation. Unknown facts block acceptance. Merkle leaves are independently exported and compared with contract-derived statements. |
| `formats/client.py`, `season_client.py` | Pinned runtime identities, wallet-authorized confidential custody, X25519/HKDF/AES-GCM transport, encrypted SQLite retention, genuine authorized ECDSA receipts, release after lock/cutoff and proof-based workers. APIs return actual wallet transaction functions. |

No new browser interface or external wallet-extension qualification is claimed by these SDK/custodian tests. The previously qualified daily browser application and its source identities remain inherited evidence. Production service availability, key custody and licensed prospective source acceptance remain external gates.

## Focused three-level qualification

Level 1 executes 48 approved-policy/source/transport tests, the inherited 56 draft-framework tests, 77 inherited client tests, and nine native tests including two independent matching fuzz tests with 2,500 runs each. Reconciliation also executes the 80 affected daily engine/publication/mixed-game tests, including 2,500 fee-conservation fuzz cases, against the current main authority and size fixes. The native tests cover dual eligibility, shared league supply, twelve-manager capacity/gas boundaries, genuine Merkle proofs and canonical shuffle.

The focused Slither 0.11.6 analysis retains all raw findings. Exact source hashes and individual High/Medium fingerprints bind the checked-in local dispositions; a changed or unreviewed finding fails qualification. Local review does not constitute independent security acceptance.

Level 2 executes actual isolated Anvil transactions against canonical `Wrapped420`, identity/capabilities, `OracleRouter420`, randomness, dispute controller, payout policy, ranking book and development-vault dependencies. It uses normal runtime/init-code and transaction-gas limits. Synthetic NHL facts are explicit fixtures; all signatures, hashes, commitments and proof verification are genuine. No always-accept verifier, arbitrary payout-vector acceptance or crypto mock is used.

The mandatory funded inventory is 21 salary/captain/peer/house scenarios and 13 season scenarios. It includes two/three-leg and short-schedule cards, full and partial voids, losing/winning house cards, whole-token stakes, free launcher prizes, upheld/denied/delegated/unresolved claims, unchanged unaffected house outcomes, all four season modes, private waivers and trades, early-start lineup/waiver recovery, all-void weeks, official season cancellation, underfunded leagues, withheld draft entropy, and the full 1,500-player NHL inventory/private preference payload. The inventory load case deliberately refunds an unstarted draft; it is not a claim of a 1,500-pick draft.

The runner requires tracked clean scope at one exact SHA, actual complete unit/native inventories, every mandatory funded outcome, more than 100 expected EVM rejections in each funded suite, and conservation assertions. It verifies every compiler source identity (Foundry's LF-normalized input), exact checkout SHA256, compiler version, creation/runtime size, successful receipts and maximum gas. Public calldata contains genuine proof witnesses and constructor/authority/settlement transactions. Public runtime hashes and bytecode are retained. Custodian keys and private databases are stored outside uploaded evidence.

Run from the repository root:

```sh
python -m pip install -r clients/420bet-fantasy/formats/requirements.txt slither-analyzer==0.11.6
solc-select install 0.8.30
solc-select use 0.8.30
python scripts/fantasy/qualify-approved-formats.py --forge forge --anvil anvil --solc 0.8.30 --output artifacts/fantasy-approved
```

`.github/workflows/420bet-fantasy-approved-level2.yml` runs that executable at `github.sha`. A documentation marker, compile-only run or diagnostic result cannot issue its acceptance certificate. Raw failed logs remain available; the certificate is written only after all checks succeed. No CI run is claimed unless actually dispatched and completed.

Level 3 remains the repository/app-phase boundary. No unrelated global qualification or 420Arcade documentation repair is part of this scope. Official network/deployments, prospective Sportradar reports, independent entropy/source control, operational custody and production authority remain TN-FAN-01–05. Local acceptance never sets those flags true or enables production wagering.
