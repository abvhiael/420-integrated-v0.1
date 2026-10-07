# 420 Creative Protocol Reference Indexer

This package is the first Decision #7 reference projection for the Decision #10 Creative Protocol Music Kernel V1.

The indexer is deliberately non-canonical: chain history and committed manifests remain authoritative. PostgreSQL is a disposable projection that must be reproducible from canonical input.

## Current milestone

The reference indexer consumes deterministic Creative Protocol histories and currently covers the Decision #10 kernel, HZ-2 catalog projections, and HZ-4 streaming settlement projections. It proves database/projector boundaries before live RPC ingestion is added. It implements:

- PostgreSQL canonical projection schema;
- an idempotent raw event journal with block/transaction/log ordering fields;
- module-version projection through `CreativeProtocolRegistry420` semantics;
- Creator, Work, Recording, contributor-credit, rights-version/share, License, rights-transfer, settlement and royalty projections;
- exact Decision #10 economic fixture verification;
- deterministic SHA-256 canonical projection digest;
- HZ-2 catalog/release/presentation/discovery projections;
- HZ-4 settlement/allocation/routing projections with conservation checks; and
- destructive database reset + full replay producing the exact same digest.

The production gap is to replace normalized fixture/caller-supplied events with live EVM RPC logs, canonical-block tracking, reorg rollback/replay, durable cursor recovery, health/metrics and production configuration. Until that exists, this package is a reference/rebuild projection library and test harness rather than a production 420Hz indexer daemon.

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
