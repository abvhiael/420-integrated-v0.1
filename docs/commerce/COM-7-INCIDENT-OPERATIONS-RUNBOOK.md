# COM-7 — Security operations, monitoring and recovery runbook

**Scope:** 420Commerce service, immutable canonical Pay/Market authorization boundaries, local projections and encrypted buyer delivery. This procedure is repository-side readiness; it is **not** evidence of a production outage drill or external security approval.

## Stop conditions and containment

Immediately disable Commerce checkout/payment preparation at the deployment edge (without granting Commerce any Pay/Market authority) if any of the following is observed: canonical RPC outage, an unapproved chain/manifest/contract hash, finality inconsistency, halted projection, stale finalized source, payment receipt correlation error, sudden refund-accounting mismatch, unknown canonical event ancestry, exposed private delivery information or active content from an upload. Do not interpret SQL checkout state or 420Analytics/Notifications projections as authoritative settlement.

The `GET /v1/health` response exposes `authoritative:false`, `state` (`ready`, `stale`, `halted`), height, finalized height and updated-at fields. This is not an external monitoring service. Configure an external monitor against the verified origin, and alert on non-ready state, finalized head stagnation exceeding locally approved intervals, elevated 429/503 rates, repeated `commerce_projection_unavailable` log entries, worker crash loops, and delivery purge errors. Logs must not include Wallet signatures, authentication nonce data, shipping data, encrypted payloads or API credentials.

## Recovery drill and evidence

1. Capture time, exact implementation SHA, deployment configuration hash (not secrets), chain ID, expected finalized block hash/height, service error/health state and correlation-safe opaque incident ID. Preserve restricted audit evidence.
2. Turn off new checkout authorizations in the owning deployment control plane. Do not try to repair money/stock by editing Commerce SQL or impersonating canonical protocol operators.
3. Verify approved chain, Registry binding, contract runtime hashes, MerchantRegistry controller, Pay/Market finality, Indexer ancestry and the last known finalized checkpoint. Halt on finalized ancestry mismatch; never rewrite a finalized block.
4. For a permitted nonfinal reorg, replay from verified canonical Indexer events and invoke the existing projection rebuild, checking canonical event IDs, deduplication, outbox invalidation/retraction, state and finality. If a finalized mismatch occurred, require a human security review and independent canonical authority reconciliation before recovery.
5. Restore from an encrypted, access-controlled, integrity-checked database backup only after validating expected schema and preserving audit continuity. Check that purge/retention and one-time authentication nonces remain correct. Never restore stale auth capabilities as new trust.
6. Check representative merchant/buyer read-only journeys, authorized tenant isolation, correct partial/full Pay refunds, Market order/reservation lifecycle, inactive/rotated merchant controller, signer nonce replay, and no unintended Pay/Swap transactions.
7. Re-enable checkout only after an authorized operator signs off on recorded canonical evidence and the deployment-specific testnet acceptance gates. Provide incident timeline, checks, exact SHA, no-secret diagnostics and remaining limitations.

## Independent review readiness package

Reviewers need the canonical COM-1.7 threat register (COM-T01–T16), COM-2 through COM-7 code and retained tests, exact-SHA scoped CI runs, governance authority proofs, browser/CSP/host/CORS configuration, credential/secret inventory without secret values, upload format constraints, database schema/retention and key-rotation design, load capacity profile, RPC/indexer outbox/finality simulations, incident logs, risk register and unresolved live testnet gates. An internal checklist is **not** a substitute for an independent security review or external signoff.

## Qualification boundary

COM-7's load and recovery acceptance require recorded runnable evidence and real multi-instance exercises where applicable. COM-8 real transaction hashes, actual deployed protocol versions, swap routes and approved governance/RefundManager bindings are live/testnet-gated. The monolithic Level 3 merge-candidate test suite is a separate exact-SHA exercise and must use one owning full Foundry inventory in Solidity, while Genesis validates addresses/manifests independently.

## Health monitor operator invocation

Deploy the application health endpoint only over an approved HTTPS origin. To check readiness from an external scheduler or monitoring runner (never from a browser), configure `COMMERCE_HEALTH_URL=https://<approved-host>/v1/health` and `COMMERCE_CHAIN_ID=<approved-chain>` then run `node commerce/src/monitor.mjs`. A nonzero exit is a health alert; ingest only the emitted event/code and do not send private keys, Wallet signatures, delivery data or bearer credentials. Confirm the real chain ID and origin from the approved manifest. This is an executable integration point, not a claim that a monitoring vendor or production alert rule is already deployed.
