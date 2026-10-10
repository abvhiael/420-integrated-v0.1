# HZ-GCA-9 — Charts, discovery and anti-gaming: qualification evidence

Status: **COMPLETE — repository-local Level 1**.

Canonical step: HZ-GCA-9, `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`.
Policy: `hz/config/gca-charts-v1.json` (HZ-GCA-1.11 frozen chart rules).
Implementation: `hz/generate/src/charts.js`, export in `hz/generate/src/index.js`, app qualification in `hz/generate/package.json`.
Tests: `hz/generate/test/charts.test.js`.
Targeted CI: `.github/workflows/420hz-gca-9.yml`.
Architecture/status: `docs/architecture/420hz/HZ-GCA-9-CHARTS.md`.

## Exact-SHA evidence
Qualified implementation SHA: `787dd66435e875fdd1db95957c4908ef35caccfa`.
PR: #565, branch `feature/420hz-generate-community-awards-roadmap`.
Observed PR base: `ffc6a4028676907c266714b5c1ae8ba3af9a7137`.
Run: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37863495403
Job: `113604581051`, **SUCCESS**.
Exact checkout SHA: PASS.
Retained generation/charts tests: **78 PASS, 0 FAIL, 0 SKIPPED**.
Frozen chart policy verifier `scripts/verify-420hz-gca-1-11.py`: PASS.
Later documentation-only amendment aligns next-step name to the canonical roadmap; does not alter executable implementation.

## Exit analysis
- deterministic rebuildable projection with version/checkpoint/window and SHA-256 commitment: implemented/tested;
- raw/qualified playback, Awards/community separation and zero-weight community v1 policy: implemented/tested;
- fixed windows and deterministic tie ordering: implemented/tested;
- privacy/Creative source-readiness filters, opt-in trusted qualification adapter, replay/abuse caps: implemented/tested;
- public discovery by genre, mood, AI disclosure and category; new releases and trending/top recordings/artists: implemented;
- snapshot history and immutable supersession: implemented/tested;
- chart projection is not canonical payment, ownership, identity, vote or governance state: preserved.

## Security tests
Forged qualification, malformed/replayed conflicting events, duplicate bounded listener traffic, raw plays/award vote confusion, private source contamination, stale source exclusion, fixture contamination, unlisted broad discovery exclusion, immutable history replay, stable ranks and source visibility tested.

## Limitations and deferrals
Repository-local deterministic projection only. Live playback qualification/source thresholds, trusted privacy token service, durable immutable event journal/indexer, high-throughput Sybil/rate controls, Search/API/public frontend production binding, actual testnet and production source checkpoint finality have not been deployed or qualified. No fabricated live qualified plays or chart credits. COMMUNITY_FAVORITES has zero V1 score weight; an independent qualified public favorite input and later policy would be needed for meaningful favorite-based rankings. No Level 2 milestone is specified at HZ-GCA-9. Full Solidity/Genesis/Integrated/Docs global Level 3 remains deferred to phase closeout.

Next canonical step: **HZ-GCA-10 — Awards domain model**.
