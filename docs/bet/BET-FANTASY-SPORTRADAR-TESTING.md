# Sportradar NHL testing plan

## Adopted decision

Use Sportradar NHL API v7 for development/testing. Alternative vendors are deferred until the userbase begins to grow. No subscription purchase, production activation or paid-provider procurement is part of this decision.

The provider selection is recorded; account creation, trial activation and credential provisioning are still outstanding. No authenticated Sportradar calls have been executed and no live-data acceptance is claimed.

## Account and credential setup

1. Create an account at https://marketplace.sportradar.com/ and add the NHL API Base trial to a dedicated 420Bet testing application.
2. Confirm the actual entitlement, trial expiry and quota in the account. Public default limits checked 2026-10-25: 30 days, 1,000 requests per rolling 30 days and one request per second. Trial generally supplies production-equivalent real-world data, subject to product exceptions.
3. Provision the application's key through local secret storage or the future worker's secret manager. The capture adapter reads SPORTRADAR_API_KEY, or SPORTRADAR_API_KEY_FILE pointing to a private text file outside the checkout. Do not commit a key, put it in URL/query logs, embed it in a client bundle or send it in chat.
4. Keep testing credentials separate from any future production application. Record entitlement and expiry metadata without the key.

## Integration sequence

- Inventory the pinned v7 schemas and map every engine scoring field explicitly. Distinguish Game Summary (detailed player statistics) from Game Boxscore (leaders/top-level box score).
- Acquire a small daily schedule and selected team/player profiles; freeze original schedule and position mappings before creating a test slate.
- Capture selected game summaries and play-by-play; use time-on-ice/shift details where goalie eligibility requires them. Verify actual endpoint availability before assuming trial coverage.
- Normalize complete player/game facts, preserving original payload digest, fetch time, provider IDs, schema version, game status and correction revision. Missing fields are unresolved, never zero.
- Use Daily Change Log to identify modified games and refetch affected evidence within the approved correction policy. A final game status alone does not establish immutable statistics.
- Produce deterministic statistic roots and domain-bound reports through the existing capability-authorized canonical oracle. Keep raw transport authentication distinct from proof that a real-world fact is correct.
- Independently reproduce scoring, rankings and payout candidates from captured evidence, then exercise corrections, disputed candidates, missing data and timeout refunds.

## Trial request budget

Cache and reuse captures for deterministic offline tests. Share one ingestion fetch across all pools using a slate. Serialize live requests, enforce the account quota, and handle 401/403, 429, expiry and outages without substituting fabricated results. Prefer a small representative slate and selected snapshots over polling the entire league. Reserve calls for correction/refetch cases. Do not burn the 30-day trial before an integration build is ready to use it.

## Acceptance boundaries

Validate short-handed goals/assists, shootout exclusions, milestone totals, blocked shots, goalie saves/goals against, win/overtime-loss attribution, DNPs, relief goalies and sole-goalie shutouts. Cover postponed/suspended games and early starts, together with corrections and stable ID/position mappings.

One provider is an explicit test dependency. Multiple oracle signers reading the same upstream do not supply independent source diversity. Official NHL evidence remains highest precedence under the approved policy; do not silently replace it with a new provider priority or mutate an existing pool's source-policy identity. No SportsDataIO fallback is provisioned during this phase. If required evidence cannot be obtained, remain unresolved or use the precommitted cancellation/refund path.

Testing permission is not a claim of paid-contest production rights. Licensed production use, evidence retention/dispute access, public-chain disclosure/commitment rights, production availability, confidential custodian operations and official testnet acceptance remain later gates. No real-money public launch is authorized by this testing decision.

## Sources

- NHL API v7 overview, endpoints and authentication: https://developer.sportradar.com/ice-hockey/reference/nhl-overview
- Account, trial/production access and default limits: https://developer.sportradar.com/getting-started/docs/your-account
- NHL product and trial: https://marketplace.sportradar.com/products/64ef56469b750f4d54d28503

## Implemented capture workflow

`clients/420bet-fantasy/sportradar.py` implements trial-only, fixed-origin v7 HTTPS capture for daily schedules/change logs, game summaries/play-by-play/time-on-ice and team/player profiles. Authentication uses the x-api-key header; redirects and ambient proxy configuration are disabled. Every attempted request, including failed attempts, consumes the shared capture-store ledger. The default local budget is 1,000 per rolling 30 days, one request per 1.05 seconds; HTTP 429 persists a cooldown and never automatically retries. Use one store for the application and count calls made by other clients separately. Creating a new store does not reset the provider quota.

Configure the key in the launching process, or set SPORTRADAR_API_KEY_FILE to a private local file; do not use a command-line key argument. A user-level environment variable changed after Codex starts may require restarting the worker/session before it is inherited. Keep capture stores outside the Git checkout.

From the repository root:

```text
python clients/420bet-fantasy/sportradar.py fetch schedule 2026-10-25 --store ../sportradar-private
python clients/420bet-fantasy/sportradar.py inspect-schedule <returned-capture-manifest>
python clients/420bet-fantasy/sportradar.py fetch summary <provider-game-uuid> --store ../sportradar-private
python clients/420bet-fantasy/sportradar.py inspect-summary <returned-capture-manifest>
```

Select the actual test date; the example date is not a frozen slate. Captures preserve exact response bytes and checksum, observation timestamps, endpoint, and allowlisted freshness/correction headers. Each fetch creates a new observation even if its body repeats. Local checksums detect body alteration; they do not make editable local metadata provider-signed or prove availability before a historical cutoff. External attestation and authorized oracle publication remain required.

The summary inspector inventories documented skater fields and explicitly lists unresolved shootout/completeness/mapping/goalie facts. It never emits settlement-ready statistics or oracle acceptance. Complete source-to-engine normalization requires authenticated representative captures and validated goalie/shootout semantics; this is a pending integration gate, not implemented acceptance. No live Sportradar request has been made without a real credential.

Offline tests use clearly synthetic HTTP responses to exercise transport failure paths. They are not cryptographic mocks and are never labeled real provider observations. The existing encrypted-lineup, signature, Merkle and payout client tests continue to execute real cryptographic primitives. Contract sources and their inherited Level 2 evidence are unchanged.

## First authenticated trial check — 2026-10-25 UTC

Authenticated trial access succeeded for the 2026-10-24 daily schedule and one completed game's summary, play-by-play and time-on-ice (four successful HTTPS captures). Raw provider evidence is kept privately outside the Git checkout; only checksums and execution metadata are exported. The first blocked-network attempt is retained in the local attempt budget.

Actual v7 game responses place the game object at the JSON root, and ordinary player totals under statistics.total. The inspector and synthetic regression shape were corrected against these real observations. The sample is Ducks–Flyers, provider game 32cd71ea-939d-4290-80d9-06a37b178cb4, status closed. This establishes API access and capture/inspection, not complete source-to-engine normalization or oracle acceptance. No credential or raw licensed payload is committed.

## Scoring/oracle implementation follow-up

The earlier coverage-only inspector is now supplemented by the strict normalizer and canonical oracle transaction builder. See [scoring and oracle integration](BET-FANTASY-SPORTRADAR-SCORING-ORACLE.md) for current field validation, operators, actual native qualification and remaining live-settlement gates. Raw capture success alone is still not settlement acceptance.
