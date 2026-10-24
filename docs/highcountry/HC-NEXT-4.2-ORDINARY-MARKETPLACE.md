# HC-NEXT-4.2 — Ordinary game marketplace

Status: implementation candidate in PR #798; **exact-SHA qualification required**.

## Approved policy

Authenticated registered-player, integer BUDS, fixed-price, full-fill only, **zero fee**. This is the ordinary internal game-goods book, not the canonical wallet-linked asset marketplace. No guest-local stock may be admitted as spendable inventory; issuer-authorized independently verified receipt admission is required. Native $420, cash-out, fractional sales, price changes after listing, and operator-controlled payouts are excluded.

## Concrete flows

- `POST /market/import`: issuer-authenticated evidence import. Receipt replay, unsafe quantity and provenance conflicts reject.
- `POST /market/list`: seller principal taken from authenticated session; exact inventory quantity moves available to reserved in one serializable transaction; price/expiry/asset/owner are frozen and listing ID unique.
- `POST /market/buy`: authenticated buyer, explicit ordinary market mode, active unexpired listing, no self trade, adequate unreserved BUDS. Exactly one serializable commit moves seller reserved inventory to buyer and available buyer BUDS to seller with **fee zero**, retaining the immutable verified receipt provenance through subsequent resales. Conflicting sources for the same buyer/asset inventory cannot silently merge. Other buyers and replay reject.
- `POST /market/cancel`: authenticated original owner only. Only active listings close; exactly the held goods return to seller.
- `POST /market/expire`: requires authenticated registered session but not listing ownership; time must reach frozen expiry. Returns exactly the reserved goods; second closure rejects.
- `POST /market/prepare`: canonical settlement only; explicitly denied in ordinary mode. Ordinary buy/cancel/expiry routes are denied in canonical mode. No cross-mode authority bypass.

`BudsLedger.operate` and all market methods share one PostgreSQL SERIALIZABLE state transaction, so BUDS/inventory mutations and listing status/operation replay have the same commit boundary. MemoryTransactionFixture is test-only. `composeOrdinaryMarketRuntime` provides an explicit ordinary-only runtime composition and rejects mismatched identity/store instances or a missing trusted receipt verifier. It requires authenticated `RuntimeAuthority` registered principals and inventory issuer scopes. Production operation additionally depends on a correctly configured authenticated identity/session verifier, independently deployed receipt issuer, and least-privilege provisioned PostgreSQL namespace. The existing `createRuntime` remains canonical-only; this avoids silently enabling ordinary transfers on canonical custody deployments.

## Acceptance evidence

Unit tests cover owner-only listing, reservation limits, forged receipt rejection, duplicate import/list/trade, zero-fee full fill, two racing buyers (one winner), verified source retention through resale and conflict rejection, concurrent cancel-versus-expire (one release), no free assets, no duplicated credits, and rollbacks. HTTP tests exercise ordinary routes with authorized/unauthorized sessions and fail-closed cross-mode routing. Disposable live PostgreSQL integration tests exercise two independently constructed market instances racing for one listing and verify total game goods and issuance after the winner commits.

The retained R04.8 Level 1, R04.5–R04.8 Level 2 economic integration, and R04 app Level 2 must all pass on the *same final SHA*. Do not inherit green results from predecessor commits as final qualification. No unrelated global suite required.
