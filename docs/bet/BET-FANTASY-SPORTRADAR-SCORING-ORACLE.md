# Sportradar scoring validation and canonical oracle connection

## Scope and implementation

`clients/420bet-fantasy/sportradar_scoring.py` normalizes complete NHL v7 summary, play-by-play and ice-time captures. It builds the existing scorer's exact double-hashed statistic leaves, sorted Merkle proofs and revision report; it prepares the actual OracleRouter420.submitObservation, FantasySlateBook420.resolve and verifyStats ABI calldata. It neither signs nor broadcasts transactions and never fabricates provider acceptance. Operators submit separately under the canonical provider registry and feed authority. The existing source precedence and data-policy identity are unchanged.

The native integration uses actual OracleProviderRegistry420, OracleFeedRegistry420, OracleRouter420, FantasySlateBook420 and FantasyNHLScoring420. It verifies every statistic proof and score, plus a position-based seven-player lineup. Two authorized operator observations satisfy QUORUM_EQUAL; one operator, unauthorized submissions, disagreement, replay, stale data, changed evidence/revision/context, future timestamps and changed statistic proofs fail. Both operators read one Sportradar upstream. This is not independent multi-provider evidence.

## Field rules

| Engine fact | Required source validation |
| --- | --- |
| Goals, assists, shots, blocks | Explicit statistics.total fields equal official play-by-play athlete totals. blocked_shots is used; blocked_att is never substituted. |
| Short-handed points | Explicit shorthanded goals plus assists; reconcile strengths on goal and assist events. |
| Shootout bonus | Explicit statistics.shootout.goals equals shootout-period scoring events. Shootout events never enter ordinary goals/shots/saves/GA or milestones. |
| Goalie saves/GA | Explicit goaltending.total fields; saves plus GA equals goalie shots faced; official goalie event totals agree. Empty-net goals are never charged to a goalie by team-score inference. |
| Win / overtime loss | Explicit goalie credit, consistent with final team result and overtime duration; exactly one winning/losing decision per team. |
| Entire game / sole goalie / shutout | Complete team rosters and summary/ice-time participation establish sole goalie. Full ice time or an explicit official sole-goalie shutout establishes full-game service. This permits a credited keeper's delayed-penalty/extra-attacker interval; literal 60:00 is not always required. Relief/shared appearances do not qualify for an individual shutout. Contradictory or potentially omitted awards fail closed. |
| Played / DNP | Positive played flag plus matching positive summary/ice-time duration. NHL v7 can omit played on unused backups/scratches: zero points then require closed/full coverage, both complete rosters, no ice time/events and explicit zero scoring/goalie fields. Missing goalie fields are unresolved, not zeros. |
| Complete | All three matching closed/full-covered captures, matching game/team IDs and timestamps, complete frozen identity/position mapping and all field reconciliations. A provider final status alone is insufficient. |

Duplicate/deleted/unofficial scoring events, unknown athletes/positions, malformed or non-integer statistics, incomplete rosters, score/goalie conservation failures, changed original timing and captures unavailable at report.asOf all reject. Evidence commits the mapping and exact capture body checksums. Whole game scores reconcile, including the single team-point shootout tiebreaker.

## Timing, revisions and identity

Use a stable NHL-reference-to-uint32 athlete map, deterministic namespaced canonical game IDs, and positions frozen before entry. `bootstrap_mapping` is labeled historical replay only: it must never be presented as proof of a pre-entry snapshot. The on-chain slate manifest independently binds the actual schedule/roster/data policy. The on-chain resolve call checks frozen game order; reports cannot amend an existing slate.

Normalize all games in a report with a common asOf at or after every actual capture. Keep original fixed cutoff and original resolution-plus-24-hour correction bounds. Report preparation refuses expired windows; later provider refetches cannot be backdated. Revisions, chain ID, slate-book address, slate, immutable manifest, statistic root and evidence are all in the actual contract digest. Operators must read those values from the intended deployed chain and verify their authorized provider/feed epochs before submission. Canonical router reads enforce operator/source authority, quorum and freshness.

Local HTTPS captures/checksums are not provider-signed attestations or independently secured historical timestamps. The reporter remains responsible for authentic acquisition, source precedence and evidence availability. Official NHL evidence still takes precedence when available; this Sportradar-only testing adapter does not automatically procure other sources or authorize a new fallback policy. Conflicts/missing required facts follow the precommitted unresolved/cancellation path.

## Operator usage

From the repository root, run the normalizer with private capture-manifest paths, a reviewed mapping, the original cutoff and a non-backdated common asOf:

```text
python clients/420bet-fantasy/sportradar_scoring.py --summary <manifest> --pbp <manifest> --ice <manifest> --mapping <frozen-mapping.json> --as-of <UTC-seconds> --cutoff <original-UTC-seconds> --output <private-normalized.json> --context <chain-context.json>
```

Context JSON contains `chainID`, `slateBook`, `slate`, `manifest`, `feed` and `revision`. The output includes normalized facts, leaves/proofs, report digests and resolve/verifyStats calldata. `observation_calldata` additionally binds an authorized provider, fresh observation ID, report phase and observedAt; it produces unsigned canonical router calldata. Do not use historical replay context to launch a live pool.

## Executed qualification model

`scripts/fantasy/qualify-sportradar-oracle.py` runs actual Python/cryptographic/timezone tests and the production native oracle/scorer graph. It independently recomputes emitted contract digests and calldata, records actual deployed code hashes and binds compiled/source identities to a clean exact SHA. A temporary isolated Foundry configuration grants read access only to the explicit vector directory; FFI remains disabled. Native integration does not settle escrow or claim testnet deployment.

Public CI uses clearly synthetic schema values, with real contracts, authority checks, Merkle verification and cryptographic calculations. Private `--capture-store` qualification separately reads real authenticated captures without making new API calls or redistributing licensed payloads. The resulting historical replay is not prospective pre-entry/live-settlement evidence. A real relief-game snapshot missing an unused reserve's goalie fields is an expected fail-closed case. A real shootout snapshot acquired after its original window can validate statistics but is ineligible for a fresh oracle report.

Production activation, official testnet oracle deployment/keys, confidential lineup custody operations, independent source diversity/security review and prospective funded live settlement qualification remain open. No paid launch or merge is performed by this step.

## Provider references

- https://developer.sportradar.com/ice-hockey/reference/nhl-game-summary
- https://developer.sportradar.com/ice-hockey/reference/nhl-game-time-on-ice
- https://developer.sportradar.com/getting-started/docs/authentication

## Ownership of the remaining live milestone

Official testnet deployment and prospective funded live settlement qualification are tracked in [420Bet testnet work roadmap, TN-FAN-01–05](../420BET-TESTNET-WORK-ROADMAP.md#daily-nhl-fantasy--official-testnet-deployment-and-live-settlement-qualification). This moves those external/prospective acceptance gates only. Locally executable custodian service, application integration and defect repairs remain development work.
