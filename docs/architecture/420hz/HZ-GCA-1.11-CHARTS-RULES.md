# HZ-GCA-1.11 — Charts rules

Status: **IMPLEMENTED — Level 1 Charts policy definition**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Machine-readable policy:

`hz/config/gca-charts-v1.json`

This step freezes 420Hz Charts as versioned, deterministic, rebuildable presentation derived from eligible public source state. Charts do not become authority over playback, rights, Identity, Community, Awards, payments, Search or governance.

## Authority model

A ChartSnapshot is a **DERIVED_PROJECTION**.

Its inputs may come from eligible public:

- Creative Recording / Creator references;
- qualified playback/listener events once a qualified runtime source exists;
- 420Hz Community relations explicitly admitted by policy;
- public metadata/disclosure/category fields.

Charts never become canonical authority for:

- Creative ownership or rights;
- source media visibility or playback access;
- 420Identity trust;
- Awards eligibility, votes or results;
- payment/reward entitlement;
- Governance.

## Chart families

Initial logical chart families are:

- **TOP_RECORDINGS**
- **TRENDING_RECORDINGS**
- **NEW_RECORDINGS**
- **TOP_ARTISTS**
- **COMMUNITY_FAVORITES**

A chart family is presentation policy, not a new canonical media category.

## Signal vocabulary

Charts freeze distinct meanings for:

- **RAW_PLAY** — raw playback start/attempt or equivalent event; never automatically chart credit;
- **QUALIFIED_PLAY** — playback satisfying the exact versioned qualification, dedupe, source-readiness and anti-abuse policy;
- **DISTINCT_LISTENER** — privacy-preserving audience contribution within the policy window;
- **PUBLIC_FAVORITE** — eligible PUBLIC RecordingFavorite signal;
- **PUBLIC_PLAYLIST_ADD** — eligible add to PUBLIC playlist;
- **PUBLIC_FOLLOW** — eligible PUBLIC ArtistFollow contribution for artist/community policy where allowed;
- **PUBLIC_SHARE** — share/reference analytics only by default;
- **AWARD_VOTE** — separate Awards product-domain object and never chart credit;
- **SEARCH_CLICK** — Search presentation telemetry and not chart credit;
- **GENERATE_COUNT** — private/product workflow activity and not chart credit.

A raw play is not a qualified play.

A favorite is not a play.

A follow is not an Award vote.

An Award vote is never a chart event.

## V1 methodology

Chart policy version **1** uses:

`score = qualifiedPlayPoints + distinctListenerBonus + publicFavoritePoints + publicPlaylistAddPoints + publicFollowArtistPoints`

V1 weights:

- qualified play: **1**
- distinct listener bonus: **1**
- public favorite: **0**
- public playlist add: **0**
- public follow: **0**

This freezes the initial positive score to qualified-play evidence while retaining explicit vocabulary for future versioned methodology.

No community event silently receives chart weight.

Changing a weight, qualification rule, dedupe rule, decay rule, tie-break rule or window semantics requires a **new chartPolicyVersion**.

## Runtime-threshold boundary

HZ-GCA-1.11 does not invent a playback-duration or completion threshold because the repository does not yet establish the qualified 420Hz playback-event runtime that would enforce one.

A raw play may become QUALIFIED_PLAY only after a later qualified source satisfies the exact versioned runtime threshold/policy.

Until then, no UI/service may fabricate qualified-play evidence from a raw click, page view, Search click or start event.

## Eligibility

A chart target must remain eligible under canonical source state.

Public Charts exclude:

- PRIVATE content;
- UNLISTED content;
- deleted/withdrawn content;
- unavailable/right-blocked content;
- stale/unverified source objects where freshness is required.

Public AI disclosure, genre, mood, category and release-time fields may be filters/facets if the source data is public and policy-defined.

AI disclosure class is neither a boost nor a penalty by default.

## Time windows

Versioned windows include:

- **DAILY** — 24h UTC fixed window;
- **WEEKLY** — 7d UTC fixed window;
- **MONTHLY** — 30d with exact rolling/fixed semantics declared by the policy version;
- **ALL_TIME** — all eligible history bounded by a declared source checkpoint.

## Qualified-play rules

QUALIFIED_PLAY requires:

- a qualified playback source;
- applicable source visibility/readiness at event time;
- replay/dedupe key;
- exact policy/window membership;
- anti-abuse acceptance;
- sufficient source/checkpoint evidence for deterministic rebuild.

Retries, duplicate delivery and rebuild cannot multiply a play.

Provider/admin/operator state cannot directly manufacture qualified play credit.

Self-play/creator traffic may be capped or excluded only by a later explicit policy. It is not silently privileged.

## Distinct listeners

Distinct-listener contribution must be privacy preserving.

It must not require publishing Wallet or Identity linkage.

One bounded listener contributes at most once per target per declared distinct-listener window.

Distinct-listener state is analytics, not Identity credential or trust authority.

## Anti-gaming

Charts enforce:

- event/replay-key dedupe;
- bounded repeated contribution;
- malformed/future/window mismatch rejection;
- production exclusion of test/synthetic fixtures;
- PRIVATE/UNLISTED exclusion;
- deterministic policy rather than manual score edits;
- no sponsored boost inside organic chart rank;
- no replay inflation from Community state;
- no AwardVote reuse;
- no mutation of Creative rights/payment/Awards history through chart enforcement.

If manipulation inputs must be corrected, the system publishes corrected input policy/evidence and rebuilds. An operator does not hand-edit final rank.

## ChartSnapshot

A ChartSnapshot binds:

- chartSnapshotId;
- chartPolicyVersion;
- windowStart;
- windowEnd;
- sourceCheckpoint;
- resultCommitment;
- ordered target results.

For an identical policy version and eligible input set/checkpoint, the result must be deterministic.

Default v1 tie break:

1. score descending;
2. stable canonical target identifier ascending.

A correction/rebuild produces a new snapshot/result commitment and supersession relationship instead of modifying historical snapshot bytes in place.

## Freshness / rebuild

420Indexer, 420Search and analytics-style services remain non-authoritative.

Charts must expose stale/degraded source state rather than presenting it as current.

Rebuild from the same policy/checkpoint must reproduce the same result.

Deleted/tombstoned/ineligible source state must not reappear through stale caches.

Search may index a published ChartSnapshot as a public derived result, but Search cannot rewrite chart rank.

## Privacy

Public chart inputs cannot include PRIVATE favorites or PRIVATE playlists.

UNLISTED playlists/content are excluded from public chart scoring.

Chart output must not expose raw listener identity, wallet secrets, private project data or protected playback payloads.

Privacy-safe aggregation cannot reveal a hidden private relation.

## Community separation

HZ-GCA-1.10 remains the authority for 420Hz Community source relations.

A follow/favorite/playlist/share/repost does not become chart credit unless the exact chart policy admits that signal with an explicit non-zero weight.

In v1, community signals have zero score weight.

Community replay cannot inflate Charts.

## Awards separation

An AwardVote is never a Chart signal.

Chart position does not:

- create Award eligibility;
- nominate an entry;
- place a candidate on a ballot;
- cast a vote;
- determine a winner.

Later Awards policy may reference a ChartSnapshot only through an explicit versioned eligibility rule that does not create circular mutation of the chart.

## Search / sponsored separation

420Search ranking is separate from Charts.

Sponsored Search placement must be visibly separate and cannot alter organic ChartSnapshot rank.

Search clicks are not chart credit.

## UI truthfulness

The UI must distinguish:

- raw plays;
- qualified plays;
- distinct listeners;
- favorites;
- Award votes.

It must show:

- chart family;
- time window;
- chart policy version;
- freshness/staleness context.

Chart rank is a derived presentation result, not proof of ownership, quality, trust or entitlement.

## Failure cases

Charts fail closed for:

- PRIVATE/UNLISTED inputs in public scoring;
- AwardVote used as chart credit;
- duplicate/replayed event receiving extra credit;
- missing snapshot policy/window/checkpoint/result commitment;
- non-deterministic tie-breaking;
- stale/degraded source presented as current without disclosure;
- direct operator/manual rank mutation;
- sponsored placement altering organic rank;
- chart score being used as rights/payment/Awards/Identity/Governance authority.

## Invariants

The machine-readable policy freezes **HZGCA-CHART-001 through HZGCA-CHART-018**.

Core guarantees:

- Charts remain derived and rebuildable;
- RAW_PLAY and QUALIFIED_PLAY remain distinct;
- one replay key contributes at most once;
- PRIVATE/UNLISTED activity is excluded;
- AwardVote is never chart credit;
- v1 positive weights are frozen;
- methodology changes are versioned;
- snapshot output is deterministic;
- source checkpoints and result commitments are retained;
- historical snapshots are not rewritten in place;
- sponsored placement cannot alter rank;
- Charts create no protocol authority.

## HZ-GCA-1.11 exit criteria

HZ-GCA-1.11 is complete when:

- chart authority remains explicitly derived/rebuildable;
- raw plays, qualified plays, distinct listeners, Community signals and Award votes are separated;
- chart families, time windows and v1 methodology are explicit;
- qualification/dedupe/anti-gaming/privacy rules are explicit without inventing a runtime play threshold;
- deterministic snapshot/tie-break/checkpoint/rebuild rules are explicit;
- Community/Awards/Creative/Search/Indexer/Identity/payment boundaries are explicit;
- targeted exact-head verifier passes;
- no playback service, ABI, deployment, provider or testnet state is invented;
- parent HZ-GCA-1 remains open.

Next canonical work package:

**HZ-GCA-1.12 — Define Awards architecture**
