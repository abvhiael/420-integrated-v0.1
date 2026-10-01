# NAMES-AUDIT-7 — Indexer/Search artifact reconciliation

Status: **COMPLETE**

Qualification level: **Level 1 — per-roadmap-step fast qualification**

Qualified implementation SHA: `3f5ca7e1d551b684aa3684bd9ce595755a23282c`

420Names qualification run: `36799099363` — **SUCCESS**

Directly affected 420Indexer workflow: `36799099362` — **SUCCESS**

## Canonical requirement

**NAMES-AUDIT-7 — indexer/search artifact reconciliation** requires:

> build real event descriptors from the frozen Names420 artifact and qualify lifecycle/query/reorg/recovery behavior against those exact descriptors.

This step owns derived Indexer/Search reconciliation only. It does not make Indexer or Search canonical Names authority.

## Frozen Names420 descriptor

Committed descriptor:

`420-indexer/descriptors/names420-v3.json`

Descriptor identity:

- schema: `420-names-release-descriptor-v1`
- descriptor version: `1`
- contract: `Names420`
- protocol: `420Names`
- protocol version: `3`
- canonical address: `0x0000000000000000000000000000000000000435`
- source blob SHA-1: `4cb9b06b4a3febb3bf024c087f3ade1eebdcf31d`
- frozen artifact payload SHA-256: `c40970d3a04503309f9467eaca00c915f5ce3dd1e993c2df3318aa6cd149ab2c`
- materialized runtime code hash: `0xa974fffd3a40e7f28db41e4ae30656b33789d2483b18b47c809ce2385de709b7`
- descriptor SHA-256: `74602adfdde367c82fcefcd35a89a5b0e415e92721289cca9e827be32299b3be`
- event count: `7`

Exact event signatures:

1. `CommitmentMade(bytes32,address,uint64)`
2. `NameRegistered(bytes32,address,uint64,uint8)`
3. `NameRenewed(bytes32,address,uint64)`
4. `NameTransferStarted(bytes32,address,address)`
5. `NameTransferred(bytes32,address,address)`
6. `ResolutionUpdated(bytes32,address,bytes32,bytes32)`
7. `ReverseNameSet(address,bytes32)`

The descriptor generator reads the frozen NAMES-AUDIT-6 artifact/state directly, derives each event signature/topic with Ethereum keccak semantics, sorts deterministically, rejects event-cardinality/signature drift, and reproduces the committed descriptor byte-for-byte.

Generator:

`420-indexer/scripts/generate-names420-descriptor.mjs`

## Indexer reconciliation

`420-indexer/src/abi-manifest.ts` now treats the Names descriptor as a frozen release artifact and validates:

- schema/version/contract/protocol identity;
- canonical address;
- source path/blob identity;
- frozen compiler-artifact payload identity;
- materialized runtime hash;
- pinned descriptor SHA-256;
- exact seven-event set;
- event signature/topic identity;
- duplicate/unexpected/missing events;
- wrong-contract log rejection.

The generic descriptor builder remains available, but Names qualification no longer relies on a synthetic one-event test fixture.

## Lifecycle / query / reorg / recovery qualification

`420-indexer/test/names420-release-descriptor.test.ts` exercises actual frozen descriptors for:

- registration decoding;
- resolution decoding;
- renewal decoding;
- transfer decoding;
- lifecycle reduction through registration/renewal/transfer;
- wrong descriptor address;
- artifact/runtime drift;
- event/digest drift;
- matching topic emitted from the wrong contract;
- orphan Names registration retraction;
- canonical fork replacement observation/finalization;
- recovered canonical owner state after replacement.

`420-indexer/test/query-layer.test.ts` now explicitly verifies Names object history can be requested in canonical ascending `block_number, tx_index, log_index` order.

The Search client already requests `direction=asc`. NAMES-AUDIT-7 adds a second fail-closed boundary inside Search so malformed or unordered protocol history cannot silently produce a stale public name state.

## Search reconciliation

`search/discovery/names_identity.go` now validates that Names history is monotonically ascending before reconstruction.

`search/discovery/names_identity_test.go` additionally proves:

- registration -> resolution -> transfer reconstruction;
- transfer resets forward resolution to the new owner;
- transfer clears stale profile/service associations;
- latest transfer event supplies result provenance;
- unordered history is rejected rather than replayed incorrectly;
- bounded/incomplete protocol history remains fail-closed.

Search continues to treat Indexer output as rebuildable derived state. It does not recover plaintext labels, treat Identity/Registry references as authority, or bypass on-chain Names authority.

## Level 1 exact-head results

Names audit run `36799099363` on `3f5ca7e1d551b684aa3684bd9ce595755a23282c`:

- exact-head verification — PASS
- Genesis interface-layer verifier — PASS
- Names dependency-model verifier — PASS
- Solidity formatting — PASS
- NAMES-AUDIT-5 frozen compiler-artifact verification — PASS
- NAMES-AUDIT-6 deterministic Genesis-state verification — PASS
- NAMES-AUDIT-7 descriptor regeneration and committed cleanliness — PASS
- descriptor SHA-256 — `74602adfdde367c82fcefcd35a89a5b0e415e92721289cca9e827be32299b3be`
- descriptor event count — `7`
- targeted TypeScript descriptor/lifecycle/query tests — **19/19 PASS**
- Search discovery package tests — PASS
- Search Indexer-client package tests — PASS
- retained Wallet Names integration/management tests — **23/23 PASS**
- Names Wallet static qualification — PASS
- Names authority/opcode scan — PASS

The core Solidity/Slither suites were correctly skipped on this exact head because no Names contract/interface/hardening files changed.

Directly affected 420Indexer workflow `36799099362` also passed `npm test` on the same exact implementation SHA.

## CI correctness repair

An intermediate gate used `git diff --exit-code`, which does not report untracked generated files. That could have allowed a generated-but-uncommitted descriptor to pass.

The final workflow uses `git status --porcelain -- descriptors/names420-v3.json` and fails if the descriptor is missing, untracked, modified, or stale. The successful exact-head run above exercised this corrected gate.

## Level 2 status

**Not required for NAMES-AUDIT-7 alone.**

The next sensible Names app-integration milestone is after **NAMES-AUDIT-8**, when the frozen runtime/state, derived Indexer/Search artifact, and deployment/operator procedures have converged. No broader repository/global qualification is run ceremonially here.

## Main divergence

Current main observed during closeout:

`df8f639d8f43b763298c8750ef49d3e5849c597c`

No current-main changes were found in the Names descriptor/generator, affected Indexer descriptor/lifecycle/query files, Search Names discovery/client files, Names contract/artifact, or Names audit workflow. Early reconciliation is therefore unnecessary for this step; Level 3 still requires exact final main reconciliation.

## Deferred work

- live-chain reorg/recovery observation remains NAMES-AUDIT-9;
- Names deployment/operator/runbook work remains NAMES-AUDIT-8;
- repository-wide complete app-phase reconciliation remains Level 3;
- Indexer/Search remain derived, non-authoritative consumers.

## Exit criteria

- real descriptors built from frozen Names420 artifact: **SATISFIED**
- descriptor source/artifact/runtime provenance frozen: **SATISFIED**
- exact seven-event ABI/signature/topic set: **SATISFIED**
- lifecycle behavior against exact descriptors: **SATISFIED**
- ascending query behavior: **SATISFIED**
- reorg/replacement recovery behavior: **SATISFIED**
- Search lifecycle reconstruction: **SATISFIED**
- transfer stale-association clearing: **SATISFIED**
- fail-closed unordered/incomplete history: **SATISFIED**
- descriptor drift/wrong-address negatives: **SATISFIED**
- exact-head Level 1 CI: **SATISFIED**

## Next canonical roadmap step

**NAMES-AUDIT-8 — deployment/operator documentation** — publish Names-specific deployment order, configuration, verification, recovery, monitoring, threat model and known limitations.
