# 420Hz testnet work roadmap — HZ-GCA-14 deferred service integration

Status: **PLANNED / TESTNET-GATED**. This records the unresolved live-service work from **HZ-GCA-14 — Notifications, Search, Analytics and Explorer integration** without treating repository-local fixtures as deployed integration.

Canonical parent: `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`.
Testnet qualification parent: **HZ-GCA-18 — Production-equivalent public testnet qualification**.
Evidence: `docs/audit/HZ-GCA-14-QUALIFICATION.md`.
PR: #565. Qualified local projection implementation SHA: `f5ece3ceb5791d451cab5faf70bbb2b2f8ea2366`; targeted run [37869728517](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37869728517), job `113624790538`, **PASS — 94 passed, 0 failed, 0 skipped/cancelled**.

## Carry forward to testnet (no new top-level HZ-GCA step)

- **Source connectors:** bind the same canonical Generate, Creative publication, Community, nomination, voting, finalized AwardResult and prize-settlement identifiers through real services; preserve owning authority and exact provenance, checkpoint and version references.
- **Notifications:** connect 420Notifications delivery for generation completed/failed, review readiness, release published, follow/community activity, nominations submitted/accepted, voting opened/closing, awards won and prize status. Authenticate account-scoped reads and subscriptions, respect privacy/opt-out and never expose ballot nullifiers, private drafts or proof payloads.
- **Indexer/Search:** bind actual 420Indexer ingestion/checkpoints and 420Search indexed queries for published Recording, creator, AI disclosure, award metadata and result refs; validate visibility filters and correct reindex after publication/withdrawal/deletion.
- **Analytics:** bind actual 420Analytics events and aggregate queries with separate generation, community, and awards buckets; check dedupe, attribution boundaries and aggregation privacy. No derived metric may become ownership, eligibility, vote, or payment authority.
- **Explorer:** bind canonical transactions/commitments for published release, finalized award/result and prize-settlement status; verify references resolve to the same source objects and clearly distinguish canonical receipts from derived projections.
- **Replay/recovery:** durable idempotency, deterministic index rebuild from identical source checkpoint, restart/backfill, duplicate/out-of-order events, reorg/nonfinal input, tombstone/withdrawal, stale source and partial destination outage. No resurrection or duplicate notification/payment authority.
- **Environment/observability:** capture exact chain/genesis identity, application and service deployment SHA, endpoint versions, service authentication, secrets isolation, rate limits, retries, error metrics and incident logs. Reject wrong-network and stale deployments.
- **End-to-end proof:** demonstrate one published release -> public Search/Indexer/Explorer match -> privacy-safe Analytics -> appropriate Notification, and one award nomination -> vote-window notification -> finalized result/badge -> optional prize-status projection. Check same-object IDs and commitments across every service.

## Exit criteria and evidence

Run affected client/service/Indexer/Search/Analytics/Notifications/Explorer tests and live cross-service integration suites against **one identified deployment lineage and implementation SHA**. Preserve API responses, non-secret receipt IDs, checkpoint/result commitments, observed run/job conclusions, negative authorization/privacy fixtures, replay/reorg restoration and service failure logs. Do not mark live integration **PASS** from local unit tests alone.

The HZ-GCA-14 repository-local Level 1 is **PASS**. The complete cross-service integration obligation remains **open** and is carried to HZ-GCA-18/testnet; no production/testnet qualification or merge authorization is implied.

Historical note: HZ-GCA-15 and HZ-GCA-17 subsequently received repository qualification in merged PR #565. Outstanding live-service security and integration evidence is now consolidated under HZ-GCA-18 below; this is not a renumbering of the canonical phase.

---

# HZ-GCA-18 — Consolidated unfinished-work intake (2026-10-09)

**Status: OPEN — TESTNET WORK ROADMAP.** This section supersedes the obsolete “next HZ-GCA-15” instruction above. It consolidates all known unfinished Generate / Community / Charts / Awards work after merging PR #565; it does not rewrite the historical HZ-GCA-14 evidence. Future completion records must reference these items by identifier.

**Repository baseline:** PR [#565](https://github.com/abvhiael/420-integrated-v0.1/pull/565) merged to `main` at `7668fb5f43ae9f6e4d32c27861520c9bceda1b6e`. Qualified implementation candidate `afb34ae4417a3f527e0c6e69dbdde474ebd41f86` passed the dedicated [HZ-GCA-17 Level 3 run 37960659496](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37960659496); all 13 observed 420Hz/Docs PR checks passed, including web run 37960659663, M2/M3/M4 run 37960659385 and HZ-GCA-15 security run 37960659536. **This is repository qualification only.** No live 420Hz/AI/Compute/Creative/Identity/Indexer service deployment or production-equivalent testnet pass is implied. Preserve the final merged SHA separately from implementation and test SHA.

## Testnet execution steps and gates

| Step | Scope / source of unfinished work | Testnet exit evidence |
| --- | --- | --- |
| **HZ-TN-01 — Environment and release lineage** | HZ-GCA-18 core: target chain, genesis, RPC, configured contract/service identities, pinned 420Hz/AI/Compute/Wallet/Creative/Identity/Pay versions; deployed website and API endpoints. | Recorded genesis/chain ID, current-main code SHA, deployed artifact digests, endpoint URLs, health and wrong-network/stale-version failure checks. |
| **HZ-TN-02 — Trusted production adapter wiring** | HZ-GCA-15 remaining: instantiate `production-security.js` and `production-surfaces.js` in every actual route, worker and projection path. No caller-controlled verifier booleans. Bind Wallet signed session, audience/chain/scope/expiry; Creative rights and voice/persona consent revocation; Identity/jury eligibility; 420AI/Compute provider result signatures/commitments. | Positive and forged/expired/revoked/wrong-chain/wrong-audience tests at each real boundary, traces proving deployed composition is used and non-production bypasses are disabled. |
| **HZ-TN-03 — Generate/Compute/Storage execution** | HZ-GCA-2–7 and 15: real quote → submit → poll → result, 420AI/Compute job/provider binding, provenance, AI disclosure, reference-audio authorization, private projects/stems. Validate encrypted or private storage controls, content SHA-256 and authenticated storage receipts; malware/MIME/media decode policy, safe remote URL/DNS/redirect fetching and browser CSP. | Real successful generation and failed/cancelled/timeout/retry/refund cases, provider spoof/output-hash mismatch rejection, malformed-media and prompt-injection boundary tests, no secret/prompt exposure in logs or outputs. |
| **HZ-TN-04 — Creative registration and publication** | HZ-GCA-4–7 and 15: Generate → review → register Work/Recording → finalize rights/splits → publish release. Source-authentic creator/derivative consent, current revocation state, disclosure and ownership. | Same IDs/commitments from Generate through Creative, media and Indexer; unauthorized sample/voice/derivative and revoked rights fail closed; retry/replay and withdrawal tested. |
| **HZ-TN-05 — Community/moderation/privacy** | HZ-GCA-8, 14, 15: authoritative Wallet community session on every write; shared storage and privacy-aware follows/favorites/playlists/shares/reports/blocks/mutes, notices and appeals as supported. `allowCommunityEvent` must consult actual policy state in all social projections. | Cross-account block/mute bypass, private/unlisted subscription, report workflow, revoked sessions, moderation takedown and restore/rebuild tests; no unauthorized events in public feeds, Search, Analytics or Notifications. |
| **HZ-TN-06 — Charts and anti-gaming** | HZ-GCA-9, 15: canonical qualified playback facts, verified finalized checkpoints, source-unique listeners, self-play, bot/replay/collusive chart inflation, source withdrawal/reorg and chart rebuild. | Authenticated playback-to-chart evidence; malicious/duplicate/reorged or unqualified play never promotes chart position; deterministic rebuild and disclosure privacy checks. |
| **HZ-TN-07 — Awards/voting/anti-Sybil** | HZ-GCA-10–13, 15: season policy/nomination → accepted/frozen ballot → identity-unique/jury/wallet voter eligibility → vote → deterministic finalized result/badge/history; protect nullifiers, prevent duplicate-wallet/collusive nomination/vote stuffing and handle revocation. | Actual Identity/Jury authority and proof validation, concurrent replay/vote stress, cutoff/tie/quorum/reorg negative tests; same results on web, Indexer and Explorer; private ballot fields never leaked. |
| **HZ-TN-08 — Optional awards prizes and Pay/Treasury** | HZ-GCA-13, 18: zero-prize and funded-prize paths, canonical result and recipient/amount binding, permissioned Treasury/Grants/Pay settlement and refund/failure accounting. | Real testnet receipt, replay-safe settlement, accounting conservation, failure/recovery and public non-sensitive transaction status; no token reward represented as guaranteed when unavailable. |
| **HZ-TN-09 — Cross-service same-object integrations** | **Entire deferred HZ-GCA-14 obligation**, as detailed earlier: real 420Notifications, 420Indexer, 420Search, 420Analytics and 420Explorer connectors for Generate, release, Community, nominations, voting, final awards and prize status. | One published release and one award result traced with identical canonical IDs/commitments through every applicable service, filtered public Search, authenticated private Notifications, differentiated Analytics and non-authoritative derived projections. |
| **HZ-TN-10 — Distributed resilience/security/privacy** | HZ-GCA-14–15 and 18: shared atomic replay/nonces and quotas across replicas/restarts; concurrency and per-user abuse, Sybil/collusion monitoring, secrets custody/rotation; eventual consistency, outage/backfill/duplicates/reorg/withdrawal; incident observability. | Negative/concurrency/load tests on deployed instances, deterministic reindex/rollback, recovery after service outage, access/log/telemetry secrecy and non-secret correlated receipts. |
| **HZ-TN-11 — Real user-facing acceptance** | HZ-GCA-6, 12, 16, 18: mobile/desktop Generate Studio, Community, Charts, Awards, Creator Studio, disclosure, and archive; live actions gated by actual readiness, accessible interaction. | Browser E2E smoke and accessibility tests against the actual deployment, real connected/unconnected Wallet states where appropriate, explicit unavailable-state behavior, and screenshots/video evidence without leaking secrets. |
| **HZ-TN-12 — HZ-GCA-18 qualification and closeout** | One complete production-equivalent deployment lineage and all items above. Preserve three-level policy; do not rerun repo-wide Foundry/Genesis inventories unless an affected protocol boundary requires it. | Final integrated suite, exact release/deployment SHAs, passing job IDs, testnet transaction/service receipts, security/privacy sign-off, open limitations and **TESTNET READY** decision only if mandatory evidence is complete. |

## Security threat carry-forward checklist (HZ-GCA-15)

All these require **real adapter or service-side evidence**, not simply passing deterministic mocks:

- [ ] Provider/tool prompt-injection resistance, trusted provider status/commitment binding and rejection of forged manifests.
- [ ] Malicious HTML/metadata/media decoding, executable or oversized uploads, MIME inspection, authenticated storage hashes, DNS rebinding and redirect-safe outbound media fetch.
- [ ] Reference-audio and derivative Work permission, explicit voice/persona consent with expiration, revocation and reuse prevention.
- [ ] Wallet/Identity audience, chain and session replay; durable, atomic nonce and quota checks across restarts/replicas.
- [ ] Anti-bot/abuse/cross-wallet Sybil controls for generation spam, collusive nominations, duplicate votes and manipulated chart events.
- [ ] Report/block/mute and takedown enforcement across all public/private projections and notification subscriptions, including moderation and appeal lifecycle.
- [ ] Private prompt/project/stem/ballot/nullifier protection; secrets and provider tokens absent from responses, logs, traces, Analytics, Search and Notifications.
- [ ] Finalized source checkpoint verification, stale/reorg rollback, withdrawn/deleted content removal and stable rebuild after outage.
- [ ] Real browser CSP/HTML escaping, published URL/media safety and accessible error handling for unavailable infrastructure.

## Acceptance and ownership rules

Each HZ-TN step remains **OPEN** until its specific live acceptance proof exists. Assign the responsible deployed app/service and preserve non-secret evidence, actual failing and passing run IDs, testnet chain/genesis identity, source SHA, endpoint version, signed/source receipt and canonical object identifiers. A mock callback, green repository CI, interface definition or Cloudflare homepage cannot close a testnet-gated item.

**HZ-GCA-19 is not included in testnet qualification**: it is the later production/Genesis disposition and remains blocked until HZ-TN-12 qualifies. No new top-level HZ-GCA numbers are introduced. Any remaining executable code discovered during live integration should be fixed and qualified as part of its HZ-TN item, rather than being silently treated as previously completed.
