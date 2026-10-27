# BET-AUDIT-5D.3 — Odds ingestion, validation and provenance

Status: implementation candidate; **qualification pending the exact-head 5D.3 workflow**. This increment is built on the 5D.2 registry branch, not on `main`.

## Implemented local boundary

`SportsOddsIngestion420` has no payable, escrow or settlement operations. Quotes are relayed with a market-scoped authorized signer's secp256k1 EIP-712 signature and verified against chain ID, ingestion contract, market ID, immutable terms digest, market quote epoch, sequence, observation time, expiry, provider/feed/source-policy digest, evidence commitment and a fixed-length vector of selection prices. Integer prices are gross-decimal multiples of 1,000,000, not floating point. The source observation must be no older than the competition's configured maximum age; expiration must precede the market cutoff. Signatures enforce the lower-s restriction and reject malformed signatures. Quotes form an append-only event hash chain (latest state holds its predecessor), reject equal/lower sequences, and are unusable after invalidation, signer revocation, source/market not-ready, epoch changes, halt or expiry.

**Provenance limitation:** a nonzero evidence digest records a commitment, not proof that the underlying source data is true, licensed, retained, independently controlled or consistent with other feeds. A trusted source adapter must validate raw payload signatures, canonical fixture mappings, independent source agreement/outlier rules, feed rights and evidence retention before the quote signer signs. This contract does not provide cross-provider consensus, provider entitlement or immutable storage of the underlying raw payload. Quotes are not ticket-acceptance authorizations.

## Qualification boundaries

Scoped test: `contracts/test/sports-5d3/SportsOddsIngestion420.t.sol`; CI: `.github/workflows/420bet-sports-5d3.yml`. It covers accepted quotes, sequencing, predecessor commitment, invalid prices, missing/mismatched evidence, invalid selection cardinality, expired quotes, wrong epochs, suspension/resumption, explicit invalidation, emergency halt and invalid signatures. Inherited 5D.2 fixtures supply the real registry/capability/operator dependencies. These are synthetic test oracle keys and source observations.

Before declaring **full 5D.3 Level 1/2 qualification**, verify exact-SHA passing CI, review compiler/static analysis, independently replay recorded quote digests and mutation cases, exercise signer grant revocation, timestamp boundaries and reorg rollback, and reconcile 5D.2's source-closure evidence. Add production-grade feed adapter tests for original signed payload authentication, bookmaker provider namespaces, exchange consensus/conflict handling, normalization of spread/total and two-/three-way selections, provider outages/staleness and event schedule-change propagation. Retain source payload/evidence hashes according to actual entitlement and policy. Missing evidence fails closed.

Full live sportsbook source acceptance remains external: licensed provider contracts, real feed coverage for each competition/template, independent signer custody/control, official-network deployment/receipts, operator risk and jurisdictional approval, funded ticket/settlement acceptance and independent audit. None can be inferred from local passing fixtures.

Do not merge to main until 5D.2 is reconciled and this branch's scoped qualifying checks pass. Preserve unrelated passing CI evidence.
