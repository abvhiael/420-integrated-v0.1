# HZ-GCA-13 — Rewards and prize settlement

Status: IMPLEMENTED — Level 1 exact-SHA CI pending.

Canonical roadmap: `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`, HZ-GCA-13.

`hz/generate/src/award-prizes.js` provides repository-local fixed schedule commitments, Treasury/Grants/Pay source validation, explicit actor authorization, compliant recipient selection, finalized-result binding, zero-prize awards, fair integer minor-unit distribution, deterministic transfer idempotency keys, retryable payment failures, and privacy-minimal public accounting.

A zero-prize award requires no payment provider call. Funded prizes preserve integer accounting conservation across settled and failed transfers; external funds remain held by the authoritative Treasury/Grants/Pay provider. Financial payment success cannot change award result legitimacy. The adapter must provide provider-verifiable confirmations for each payout.

The in-memory model is a bounded test fixture, **not** a production settlement engine: production requires durable transactional reservations and externally enforced idempotency, confirmation reconciliation after ambiguous network failure, asset/network/chain verification, recipient binding to canonical entitlements, source funding budgets, AML/sanctions applicability, batch concurrency protection, dispute/chargeback handling, and independent Pay/Treasury qualification before moving real assets. It must not be publicly wired to submit financial transactions in this form.

Level 1: `npm run qualify` in `hz/generate`, through exact-SHA `.github/workflows/420hz-gca-13.yml`. Full repository Level 3 deferred to app-phase merge closeout.

Next canonical: **HZ-GCA-14 — Notifications, Search, Analytics and Explorer integration**.
