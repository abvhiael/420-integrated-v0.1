# CMP S-06 — Science read model, app and Level 2 evidence-ingestion milestone

**Status: IMPLEMENTATION CANDIDATE; Level 2 must pass on exact implementation SHA, live-source observation deferred to testnet.**

The standalone science read model accepts bounded chain-scoped non-authoritative source observations and separately projected canonical attestation/claim records, never raw scientific outputs or credentials. It exposes project/provider/credit unit/event/age/finality/status and explicitly no $420 amount. Source data alone remains UNVERIFIED; a matching finalized projection can show VERIFIED (but is not a monetary eligibility verdict). Revoked/stale data fail closed, and canonical projections/claims can be rewound on reorg. The 420Compute website has a read-only external-science section using an explicitly versioned `/v1/compute/external-science` Indexer interface, with inactive/unavailable source states; browser never treats indexed data as authority.

**Important:** the source read model is an independent in-process prototype, not yet wired into the canonical 420Indexer durable event-ingestion machinery. The new Indexer endpoint is a proposed interface, not an asserted deployed endpoint. Historical replay, bounded database query, durable source receipts, live independent source verification, and actual published source endpoint responses remain testnet tasks. Neither the Indexer nor browser creates a reward balance or claim transaction.

**Level 2:** the retained S-02–S-05 Node 22 suite and full 420Compute browser tests/check/build run together at this step; deployment/runtime and live ingestion require separate real testnet qualification. No global Foundry inventory or duplicate Genesis.
