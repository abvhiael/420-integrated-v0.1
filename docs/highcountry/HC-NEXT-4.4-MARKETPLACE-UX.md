# HC-NEXT-4.4 — Marketplace player experience

**Status:** Implementation and exact-SHA qualification in PR #805; do not mark complete until CI is green. Canonical deployed-chain acceptance is separately tracked under HC-NEXT-4.3.

## Player flows delivered

`/marketplace` is an actual High Country route. When offline it shows an explicit no-marketplace state; offline guest harvests cannot become spendable goods or BUDS. Authenticated connected players use the reviewed service bearer session without a wallet for internal trading. The page renders verified inventory (available and reserved), BUDS (available and reserved), browsing, listing/price/quantity/expiry entry, explicit purchase confirmation, sold/cancelled/expired history, seller cancellation, expired listing release, and trade dispute reporting/status. Only the server provides owners, participants, prices, balances, item receipts and final trade status. The UI never edits a seller, buyer, wallet, ledger or recipient field.

### Authority contract

- `POST /market/snapshot`: registered principal derived from verified session; returns only their inventory, balance, history and dispute notices, plus public active listings from the correct market mode.
- `POST /market/list`: seller identity and item availability are enforced by the canonical economy state; listing freezes exact units, price and expiry and reserves inventory.
- `POST /market/buy`: ordinary-only route, buyer derived from session; single database commit exchanges reserved goods for available BUDS, fee zero. Both account and asset conservation are enforced by existing HC-NEXT-4.2.
- `POST /market/cancel` and `POST /market/expire`: ordinary-only server operation with owner permission or finalized expiry; idempotent replay protection and exactly one reservation release.
- `POST /market/dispute`: requires authenticated affected buyer/seller on a non-active listing, valid reason and unique operation; persists one open report per listing/principal without minting credits, refunding, rolling back a trade or releasing custody.

All durable reports are kept in the same SERIALIZABLE PostgreSQL namespace (with compatible schema-one optional `marketDisputes` state) and in the test-only in-memory fixture. Submissions are disabled while an existing request is in flight. The browser produces no automatic BUDS accrual or wallet prompts.

### Separate optional canonical market

A connected canonical marketplace may show read-only canonical listings and history. The page does **not** pretend that a clicked buy button authorizes chain settlement, nor allow canonical cancellation via the ordinary API. Canonical wallet authorization, operator submission, finality, indexer reconciliation and return status belong to the separately reviewed wallet/settlement service of HC-NEXT-4.3. Until a configured real-network deployment has completed its own acceptance, canonical purchase is visibly unavailable here. A finalized transaction inclusion alone is not proof of canonical custody or a settled BUDS payout.

### Qualification and limitations

Required exact-SHA checks: High Country browser shell/client, R04.8 market, R04 economy runtime and PostgreSQL, R06 browser regression. Unit tests cover server-scoped browsing, balances, disputed-trade history, replay/duplication, transaction conservation, guest/anonymous denial, optional wallet-free UI display, and operation payload restrictions. Live production identity issuer, settlement operator, real indexer and chain authority are external deployment requirements. Dispute **intake** and immutable open status exist, but a resolution, arbitration or refund is not claimed without an approved adjudication policy and independent settlement authority. No fabricated refund or invented delivery proof may be displayed.
