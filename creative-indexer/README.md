# 420 Creative Protocol Reference Indexer

This package is the first Decision #7 reference projection for the Decision #10 Creative Protocol Music Kernel V1.

The indexer is deliberately non-canonical: chain history and committed manifests remain authoritative. PostgreSQL is a disposable projection that must be reproducible from canonical input.

## Current milestone

HZ-AUDIT-6 retains the deterministic Decision #10 fixture path while adding the repository-side canonical RPC/reorg/rebuild integration boundary. It implements:

- PostgreSQL canonical projection schema;
- an idempotent raw event journal with block/transaction/log ordering fields;
- module-version projection through `CreativeProtocolRegistry420` semantics;
- Creator, Work, Recording, contributor-credit, rights-version/share, License, rights-transfer, settlement and royalty projections;
- exact Decision #10 economic fixture verification;
- deterministic SHA-256 canonical projection digest; and
- destructive database reset + full replay producing the exact same digest;
- retained block hash, parent hash, transaction index, transaction hash and log index ordering metadata;
- explicit source-provided finality instead of marking every indexed block finalized;
- canonical-tail replacement when an indexed event-bearing block hash changes;
- fail-closed refusal to roll back finalized indexed blocks;
- coordinated reset/replay across base, catalog and HZ-4 streaming projections;
- a complete HZ projection digest that remains identical after journal rebuild; and
- a JSON-RPC `eth_getLogs` source with canonical block-header verification and a protocol decoder/enrichment boundary.

Public-testnet RPC endpoint selection, deployed-address binding, protocol-specific production decoder/enrichment wiring, observed reorg receipts and live rebuild evidence remain HZ-AUDIT-7. The fixture source remains available as deterministic repository evidence rather than pretending to be live chain history.

## Run locally

Generate the Decision #10 fixture first:

```sh
cd contracts
mkdir -p ../artifacts/contracts
forge script script/Decision10DeploySeed420.s.sol:Decision10DeploySeed420 --sig "run()" -vvv
```

Start PostgreSQL and create a database named `creative_indexer`, then:

```sh
cd creative-indexer
npm install
npm run build
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/creative_indexer \
CREATIVE_FIXTURE_PATH=../artifacts/contracts/creative-kernel-v1.fixture.json \
npm test
```

## Reconstruction invariant

For a fixed canonical history:

```text
FIRST PROJECTION DIGEST
        ==
IDEMPOTENT REPLAY DIGEST
        ==
CLEAN DATABASE REBUILD DIGEST
```

The fixture also independently asserts:

```text
Work pool + Original Recording pool + Remix Recording pool + Treasury
= Vault backing
= 260 native 420
```

This package must never become a hidden write authority for rights, licenses, royalties, provenance, or identity.
