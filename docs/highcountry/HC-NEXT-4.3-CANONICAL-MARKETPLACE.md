# HC-NEXT-4.3 — canonical ecosystem marketplace

**Status: repository implementation and CI qualification in progress; live deployed-chain acceptance OPEN.** This is a separate, wallet-linked on-chain escrow market. It must not be confused with HC-NEXT-4.2's internal zero-fee game-goods trading.

## Transaction-writing

The production canonical `composeSettlementRuntime` verifies immutable prepared buyer/seller wallet bindings, current registration epochs, deterministic chain operation ID, live escrow listing and operator authority, signer chain ID, pinned escrow contract bytecode, and market restriction status before `eth_sendTransaction`. An authenticated operator calls `/operator/reconcile`; neither arbitrary browser inputs nor the ordinary-market HTTP routes are a canonical transaction-writing authority.

`CanonicalSettlementWorker` now commits a `dispatchStarted` write-ahead marker in SERIALIZABLE PostgreSQL **before** invoking nontransactional chain RPC. On a crash or dropped response after a possible broadcast, recovery can inspect the deterministic finalized operation; it **must not rebroadcast** when the dispatch outcome is uncertain. Persisted tx hashes also prevent duplicate sends. A finalized successful receipt permits settlement exactly once; a verified irrevocable closure with no possible reserved transfer permits refund; unresolved states remain held and require independent review. A dispatch that was marked but never sent may therefore remain pending: do not clear the marker or retry by operator discretion.

## Independently authenticated finality

The pinned `FinalizedRpc` uses the node's `finalized` block tag, EIP-1898 canonical blockHash reads, correct chain ID, verified deployed bytecode hash and a stable block header. `CanonicalRpcEscrowClient` now additionally requires, for each escrow log, a successful transaction receipt with identical transaction hash, emitting contract address, block number/hash, exact logIndex and exact log topics/data; the finalized block hash must match the chain, and speculative or removed logs fail closed. Reader validates immutable listed asset, quantity, seller and deterministic transfer operation against the finalized contract state.

## Indexer reconciliation

`CanonicalHttpIndexer` provides a pinned-chain/pinned-escrow authenticated HTTPS endpoint. The expected API responses are `GET /escrow/listings/:id` and `GET /escrow/transfers/:operationId` with `{chainId,escrow,result}`. `CanonicalIndexerReconciler` cross-checks projected active/closed/sold listings and completed transfers against the **independently finalized reader**, never against an indexer assertion alone. With indexer configured for canonical runtime, worker payout waits for matching finalized transfer projection; stale or forged indexer data denies payout rather than overriding the chain. The indexer does not authorize refunds or issue BUDS.

## Qualification scope

Required targeted exact-SHA evidence: R04.8 Level 1, R04.5 Level 1 where economy paths change, R04.5–R04.8 Level 2 and R04 app Level 2 (including disposable Anvil deployment, signed HTTP sessions, actual RPC transaction writing, finalized receipt and PostgreSQL restart). Tests include post-broadcast/pre-hash crash recovery, exactly-once submission, tampered failed receipt, indexer divergence/mismatched buyer, chain/escrow pinning, and rollback.

**External deployed-chain acceptance cannot be inferred from Anvil CI.** To close HC-NEXT-4.3 fully, the release authority must provide and execute all of the following on an independently deployed production-equivalent testnet, recording chain ID, HTTPS RPC, escrow/identity/inventory/emergency address and verified code hashes, funded and approved seller/buyer/operator wallets, indexer HTTPS endpoint/auth policy, issuer and PostgreSQL namespace/permissions, transaction hashes and finalized receipt block hashes, indexer cursor/state, exact deployed commits and audit evidence:

1. Deploy the reviewed canonical escrow, inventory registry and identity source with pinned runtime bytecode, approve seller's escrow permissions, register and bind real controlled seller/buyer wallets, record approved listing and test BUDS award.
2. Actually post an owner-authorized on-chain listing, import its finalized escrow lock as verified inventory and reserve buyer BUDS through a signed authenticated session.
3. Dispatch the deterministic operator settlement transaction **using the deployed operator signer**, wait for finalized RPC state, independently authenticate receipt and exact emitted log, require matching deployed indexer projection, and settle BUDS once across service restart and a second contending worker.
4. Exercise a second listing's on-chain cancellation/expiry, independently prove that the transfer cannot still occur, refund reserved BUDS without minting fictitious off-chain inventory, and reject conflicting forged receipt, replay, wrong chain/code hash, unauthorized operator, revoked account, signer outage, reorg and indexer lag.
5. Reconcile deployment transaction receipts with PostgreSQL issued/burned/available/reserved BUDS and chain custody balances; attest to no free assets/duplicate credits or payout after reversal. Capture actual runner logs, deployment manifest, signer approval and operational security signoff.

Until this externally witnessed gate is satisfied, **do not label the step fully qualified, deployed or ready for production**, even when all repository-side tests pass. Do not invent addresses, network access, approval or proof of a remote broadcast.
