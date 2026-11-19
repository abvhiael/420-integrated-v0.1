# TREASURY-REC-6 — Grants, Wallet and Ecosystem Integration

Status: **IMPLEMENTATION CANDIDATE — exact-head qualification pending**.
Baseline: `a1f1164f3a147af52cd36e3b872464ef29eb3476` (REC-5 executable-qualified merge, its separately recorded security closeout remains open).

## Consumer changes

- Grants rejects an expired, missing, or contradictory SCHEDULED Treasury record at approval and rechecks the original exact tuple and reverse binding at PAID/cancellation. PAID continues to mean EXECUTED plus nonzero release commitment, not independently verified asset transfer. Expiry never automatically detaches an approved milestone; canonical Treasury cancellation comes first. Executed history can be finalized after expiry. The external Treasury view ABI is unchanged.
- Wallet service discovery requires the frozen ProtocolRegistry and chain-pinned code hash, active service plus distinct router component, matching codehash/profile and constructor/Timelock graph. The capability component is separate. Typed Civic actions are prepared without broadcasting; existing Civic commitment review remains authoritative.
- Wallet release preparation requires the designated executor deployment pin, operator SmartAccount, exact execution capability and canonical commitment preview; no raw arbitrary commitment handoff is introduced. Existing SmartAccount owner execution and explicit confirmation, fresh simulation, chain/account revalidation and canonical receipt handling are used. Production configuration is intentionally null pending REC-8/AUDIT-8, not a fake deployed address. No new public Treasury website.
- SDK packages the same exact executable discovery and action preparation runtime. Wallet UI consumes the canonical client and shows commitment-only evidence and explicit receipt status.
- HighCountry gateway's supplied nonzero release commitment is not independent transfer evidence. It retains independent Treasury capability and organization permission gates; Town treasury references are permission-scoped references only. No new custody authority.
- Indexer/Analytics/Explorer derived read-model reconciliation remains REC-7, deployment artifact materialization REC-8 and live receipts AUDIT-8.

## Qualification

Targeted exact-head workflow: `.github/workflows/treasury-consumer-qualification.yml`. Real Grants/Treasury/capability/Registry contracts, retained Grants adversarial suite, Town and HighCountry integration owners, Wallet tests and SDK build/packaging. Qualification results must be recorded before completion.
