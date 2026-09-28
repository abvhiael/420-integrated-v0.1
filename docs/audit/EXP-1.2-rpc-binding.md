# EXP-1.2 — canonical RPC/node binding

EXP-1.2 qualifies the binding implementation that 420Indexer must use before any execution RPC/node can be trusted.

The repository still contains only placeholder public RPC URLs and unprovisioned RPC infrastructure. Therefore this milestone deliberately does not fabricate a live testnet endpoint. Instead it establishes and tests the fail-closed binding contract that a real endpoint must satisfy.

## Qualified binding semantics

The runtime source must:

- report chain ID 420;
- expose block 0 with a non-empty hash;
- match the frozen expected genesis block hash once the launch ceremony produces it;
- expose head, safe and finalized records on the same chain;
- preserve non-empty block hashes;
- satisfy finalized <= safe <= head;
- remain within the configured maximum head age;
- fail closed on malformed/unavailable source reads.

The implementation uses `indexer/rpc/source.go` and the negative/positive cases live in `indexer/rpc/source_test.go`.

## Current target-network limitation

`testnet/services/endpoints.json` still contains `REPLACE_WITH_HTTPS_RPC_*` placeholders and the infrastructure inventory remains unprovisioned. A placeholder cannot be elevated to runtime or live evidence. The exact public RPC URL and observed genesis block hash must be written only after the testnet source is actually provisioned and approved.

## Finding impact

EXP-1.2 closes the repository/runtime-binding implementation portion of EXP-FIND-004. The live-binding portion remains an explicit later promotion gate and must be revalidated against the real testnet in EXP-7.

## Completion rule

EXP-1.2 is complete at its intended implementation/binding scope only after:

1. all source-validation tests pass;
2. the EXP-1.2 verifier passes;
3. retained 420Indexer, 420Docs and 420 Integrated qualification are green on the same exact head;
4. no placeholder endpoint is promoted to live evidence.
