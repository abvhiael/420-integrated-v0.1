# Pay ecosystem integration

| Consumer | Authoritative evidence |
| --- | --- |
| Wallet and hosted checkout | The Pay SDK resolves Invoice and Payment Registry runtimes at a canonical block. It binds the payment, invoice, merchant and selected Wallet account, and applies the invoice acceptance policy. A Wallet submission hash alone does not confirm payment. |
| Swap and Oracle | The Pay quote source uses the Registry-resolved Swap market and settlement health interfaces. Pay conversion, delivery and invoice accounting share the same transaction. Existing conversion and rollback coverage is retained in the [native checkout qualification](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44463975258). |
| Market | The settlement adapter verifies active Registry bindings, invoice credit, payer, merchant, asset and amount. Stock is released for a refund only after the active Refund Manager shows the full amount was delivered. |
| Commerce | The finalized projection keeps refund authorization separate from delivery. A reported Market refund is returned only when both the Market report and canonical Pay delivery can be verified. Missing delivery evidence cannot be presented as a returned balance. |
| Indexer and webhook consumers | The Indexer provides event provenance. Pay verifies that provenance against the receipt and Registry. On rollback it suppresses undelivered orphan events and sends compensation for events that may already have reached the subscriber. |
| Explorer, Search, Status, Notifications and Mail | These services may present qualified observations under their own access and consent rules. Settlement decisions use Pay and its canonical Registry. |

No consumer writes a parallel financial ledger. Commerce keeps workflow
references, Market records its order and stock lifecycle, and the webhook
outbox keeps delivery bookkeeping. Deploy an updated Market adapter through
the existing governance registration and runtime-hash approval. Bind
Commerce to the active Refund Manager when reporting delivered totals.
