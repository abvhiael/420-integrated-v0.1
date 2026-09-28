# EXP-1.1 — runtime authority and target-network baseline

**Status:** implementation-head qualified; final evidence-recording head requalification required.

EXP-1.1 establishes the repository-authoritative runtime target contract that later EXP-1 steps must use. It intentionally does **not** convert unresolved testnet infrastructure into live evidence.

## Pinned identity

- Network: **420 Integrated Testnet** (`420-testnet`)
- Chain ID: **420**
- Network ID: **420** (testnet default, non-constitutional)
- Release channel/version: **TESTNET_RC / 0.1.0-rc1**
- Execution genesis SHA-256: `65c8efba297009c02dc7ec424f777ba7131f5677a1e11135765ed05de3d06f7e`
- Consensus genesis SHA-256: `83da87ffbfbf0ed42a199a99b805c36fb33cd7947cb17bfad73689085531dc9d`

The launch contract still records chain ID 420 as `CANDIDATE_PENDING_COLLISION_PREFLIGHT`; consensus genesis still contains launch-ceremony placeholders for genesis time and rotation seed. Those facts are explicit promotion blockers, not silently ignored configuration.

## Runtime topology

The approved topology contract requires at least three public RPC nodes, one archive RPC node, and one Indexer instance. Current public endpoint entries are placeholders and infrastructure is still unprovisioned. No placeholder or unprovisioned node may be treated as approved runtime, deployment, or live-network evidence.

## Authority boundaries

420Explorer remains a consumer of the 420Indexer `/v1` read API. The qualified boundary prohibits Explorer from adding an independent execution-RPC ingestion path, checkpoint store, reorg engine, or protocol-decoder registry. The Explorer runtime requires `EXPLORER_INDEXER_URL`, defaults to chain ID 420, and rejects Indexer responses that claim canonical authority.

## Finality and conflict rules

420Indexer must track head, safe, and finalized states separately. Reorg repair may alter only non-finalized indexed history. Finalized-history conflicts fail closed/degraded. Canonical chain/consensus state always wins over the hosted Indexer/Explorer projection.

## EXP-1 evidence contract

`docs/audit/EXP-1-evidence-schema.json` defines the exact-head evidence fields required for later runtime qualification: commit SHA, network/genesis identity, execution/consensus sources, Indexer identity, observations, workflow/command provenance, witnesses, result, and artifact digest.

## Handoff

EXP-1.2 may now bind 420Indexer to a concrete approved node/RPC source, but it must fail until the candidate chain identity is actually frozen and the source can be tied to the pinned genesis identity. EXP-1.1 itself is complete when its fail-closed verifier and the complete retained repository qualification suite pass on the exact implementation head.

## Implementation-head qualification

Qualified implementation head: `620a50e4f039b08ac65cc15c4e4406ca1ce7bc0f`.

- 420Indexer #682 — run `36340706393`, job `108680096155` — SUCCESS
- 420Docs Qualification #3018 — run `36340706375`, job `108680097990` — SUCCESS
- 420 Integrated Qualification #5635 — run `36340706374` — SUCCESS
- fault-matrix job `108680098367` — SUCCESS
- geth-engine job `108680098502` — SUCCESS
- offline-core job `108680098518` — SUCCESS
- production-dependencies job `108680098546` — SUCCESS
- dedicated EXP-1.1 runtime-authority verifier — SUCCESS
- evidence artifact `10938842860`
- evidence digest `sha256:418532def2e01939953a956116a13c8ae42a69b59335d443a7610d80c7b9a2d2`

The implementation head is qualified for **repository/runtime-target-contract scope only**. It deliberately preserves the unresolved chain-ID collision preflight, placeholder RPC endpoints, unprovisioned infrastructure, and unresolved consensus ceremony fields as blockers to deployment/live promotion.

This qualification evidence is now recorded in-repository. The resulting evidence-recording head must pass the full retained Indexer, Docs and Integrated qualification suites before EXP-1.1 is considered fully complete.
