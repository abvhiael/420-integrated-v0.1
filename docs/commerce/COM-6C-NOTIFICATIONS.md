# COM-6C — Notifications (Commerce merchant operations)

**Canonical parent roadmap:** `docs/commerce/COM-1-ARCHITECTURE-AND-ROADMAP.md`, COM-6 Merchant operations; COM-6C is a work-package label, not a renumbered canonical top-level step. **PR:** #594; branch `audit/420commerce-com-2-upstream-adaptations`.

## Authority and deployment decision

The existing `420Notifications` contract-free Genesis service owns opt-in subscriptions, indexer replay, provider-neutral delivery, feed and message provenance. Its repository implementation is complete under `docs/420NOTIFICATIONS-ROADMAP.md`; NOTIFICATIONS-AUDIT-2 through -6 require real testnet/provider/public URL acceptance. This Commerce change **does not** replace that shared service, invent a new notification protocol contract, issue Wallet signatures, or claim that external web/push providers are online.

Commerce offers a **private merchant in-app preview/feed** sourced strictly from its already-verified, finalized, canonical 420Market Indexer event inbox. The feed is a rebuildable local projection, not cross-service dispatch or protocol authority. External 420Notifications delivery remains `NOT_CONFIGURED` until the real service, private subscription identity, provider adapters and Registry/manifest binding have been independently qualified. Do not mistake a local in-app feed for live push delivery.

## Implementation

- Schema v6 `commerce/sql/006-merchant-notifications.sql`: private, explicit, reversible per-store opt-in tied to the canonical merchant controller; deduplicated feed keyed by `store_id` and source `event_id`; read/unread state and stable ordering.
- Signed merchant-owner-only routes: preferences GET/POST (`{enabled:boolean}`), feed GET with bounded page size/opaque cursor, event read POST (`{read:boolean}`); exact store and fresh controller authorization. No anonymous/delegate access, no promotional consent or endpoint storage. Rotated controller preferences never authorize an old user; unsubscribing removes the presentation feed.
- Canonical event filter: `OrderCreated`, `PaymentRecorded`, `FulfillmentRecorded`, `OrderCompleted`, `OrderCancelled`, `OrderDisputed`, `RefundRecorded`. Only finalized canonical Market event records with exact order ID matching merchant checkout scope are displayed. Retracted/nonfinal records never generate live notices and stale rows are removed before read. Opaque IDs avoid exposing provider/destination secrets or the Indexer's internal cursor.
- Feed output: order reference, event kind, chain, block/hash, transaction/log provenance, read state, `authoritative:false`; it cannot initiate payments, refunds, arbitration or order changes. External provider delivery is always explicitly unavailable in this phase.
- SDK and merchant dashboard: signed opt-in/out, private finalized event history, read/unread, pagination and clear noncanonical labels. Wallet disconnect clears the rendered merchant feed.
- Dedicated service tests `commerce/test/com6c-notifications.test.mjs` and signed HTTP regression in `commerce/test/http-sdk.test.mjs`; retained builder/browser and other Commerce tests apply.

## Completion and external boundaries

COM-6C repository-side Level 1 must be tied to **exact SHA**, with fully passing Commerce service/SDK/Indexer and merchant-browser workflows; no missing, skipped or cancelled required check counts as PASS. No broad Level 3 rerun is required at this ordinary COM-6 substep.

**Live integration prerequisites remain NOTIFICATIONS-AUDIT-2..6**: production-equivalent 420Indexer and notifications420 deployment, private destination identity/consent, approved provider credentials, real delivery and retry/fanout/abuse testing, reorg/restart recovery, binding manifests and public TLS URLs. These cannot be represented as fulfilled by mock or local data. Native 420Notifications subscriptions and fanout remain unconnected, so this COM-6C substep has a **staged integration limitation** until testnet operation is available.

**Next planned package:** COM-6D — Identity/Names (the next canonical *top-level* roadmap after COM-6 remains COM-7 Security/ops). Full COM-6 and phase Level 3 are not closed by COM-6C alone.

## COM-6C Level 1 exact-SHA qualification — October 9, 2026

**Executable implementation SHA:** `7964629de759b02e786dd78227342e4db138d528`.
**Audit PR:** [#594](https://github.com/abvhiael/420-integrated-v0.1/pull/594), `audit/420commerce-com-2-upstream-adaptations` (draft and unmerged).
**PR base SHA:** `41d173dbcfbeb8299f54f22e7c049f1fec20336d`.
**Current main SHA at evidence capture:** `f8bbb62e1cdfe68cff25261fd4a036db1840a15c`.

Five applicable exact-SHA CI workflows completed **SUCCESS**, with no failures, skips or pending required checks:

| Affected check | Run | Conclusion |
| --- | --- | --- |
| Commerce service, signed HTTP, SDK, Indexer, SQLite, negative/adversarial | [37991343838](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37991343838) | PASS |
| Commerce merchant builder, browser, Wallet, accessibility | [37991343692](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37991343692) | PASS |
| Retained Commerce upstream contract integration | [37991343760](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37991343760) | PASS |
| Governed Pay refund safety (regression) | [37991343748](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37991343748) | PASS |
| Solidity Contracts (affected check) | [37991343758](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37991343758) | PASS |

Implementation includes merchant-controlled reversible opt-in; scoped finalized 420Market event reads; private noncanonical feed; opaque indexed notification IDs and bounded cursor paging; tenant/controller authorization; read/unread; reorg suppression, dedup and clearing upon unsubscribe; signed SDK and responsive browser UI. COM-6C regression tests cover opt-in/out, scope separation, malformed consent, dedup, finality, retraction, indexed pagination, read-state and signed HTTP access.

**Disposition: COM-6C repository-side Level 1 COMPLETE / PASS.** This does not qualify the not-yet-deployed production-equivalent 420Notifications service, live subscription/provider delivery, public endpoints, notifications replay/reorg/restart acceptance, or service-discovery binding; retain them on the shared Notifications testnet roadmap. No actual push/web message was delivered by this Commerce implementation. The app-specific Level 2 milestone and one final repository-wide Level 3 reconciliation remain reserved for COM-6 phase closeout. No Level 3 rerun was performed here.

**Next planned COM-6 package:** COM-6D — Identity/Names. **Next canonical top-level roadmap step after COM-6:** COM-7 — Security/ops.
