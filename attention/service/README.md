# 420 Attention projection service

ATTENTION-AUDIT-7 implements the non-canonical service consumed by `attention/web`.

## Source and authority

420Indexer remains the owner of canonical block-history ingestion, log ordering, rollback and replay. This service does **not** maintain an independent chain history.

The service:

1. reads canonical/rebuildable log pages from 420Indexer for the configured Attention contracts;
2. decodes only the public Attention/Cannaseur events required by the application;
3. performs block-scoped canonical `eth_call` reads only where emitted events do not contain enough immutable public state to reconstruct a safe view (campaign economics and proof details);
4. deterministically rebuilds the complete in-memory Attention projection;
5. atomically swaps the rebuilt projection;
6. exposes the versioned `/v1/attention/*` API used by the browser;
7. prepares bounded calldata for explicit Wallet review without signing or holding keys.

A later canonical Indexer reorg causes its log history to change; the next service rebuild discards the prior projection and reconstructs from the replacement canonical branch. Duplicate event identities are idempotent. Conflicting identity reuse fails closed.

## Privacy

The public projection excludes raw behavioral telemetry, browsing history, private audience/targeting data, delivery endpoints, credentials, keys, bearer tokens and unrelated personal data. The privacy guard recursively rejects forbidden fields.

Evidence hashes and audience-policy commitments are hashes/commitments, not permission to expose the underlying private material.

## Runtime boundary

The committed `runtime-config.json` remains unresolved before production-equivalent testnet:

- chain ID is null;
- Indexer and RPC endpoints are null;
- Registry-resolved Attention component addresses are null.

Fixed Genesis addresses remain pinned:

- AttentionTreasury: `0x0000000000000000000000000000000000000421`
- CannaseurCampaignRegistry: `0x000000000000000000000000000000000000043b`

ATTENTION-AUDIT-8 owns live address/endpoint materialization and deployment qualification.

## Qualification

```sh
cd attention/service
npm install
npm run qualify
```
