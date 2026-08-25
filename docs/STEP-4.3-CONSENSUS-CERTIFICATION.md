
# Step 4.3 — Canonical Consensus Objects, BLS QCs, and Chained Finality

Status: **IMPLEMENTED CORE; PRODUCTION BLS ADAPTER ENCODED, EXTERNAL DEPENDENCY NOT FETCHABLE IN THIS RUNTIME**

## Implemented

- deterministic fixed-size SSZ-style Merkleization subset;
- `Checkpoint`, `AttestationData`, `Attestation`, `QuorumCertificate`, and `ConsensusBlock`;
- SHA-256 domain-separated signing roots;
- production BLS12-381 `blst` adapter source in minimal-pubkey mode:
  - 48-byte public keys;
  - 96-byte signatures;
  - proof of possession;
  - individual verification;
  - signature aggregation;
  - fast aggregate verification;
- production BLS files are build-tagged `blst`; this sandbox cannot fetch the external module;
- default tests validate the QC/finality interface with a deterministic test double, never used in production;
- seat bitmap QC representation;
- quorum formula `floor(2N/3)+1`;
- 15-seat threshold = 11;
- one-block chained finality tracker;
- `head`, `safe`, and `finalized` state;
- conversion of consensus finality status into Engine API fork-choice state;
- integration test binding a real Engine payload hash (from the deterministic Engine mock) into `ConsensusBlock`.

## BLS implementation

The implementation uses Supranational `blst` Go bindings in minimal-pubkey-size mode. 420 code does
not implement pairings or curve arithmetic.

Registration proof-of-possession uses a distinct domain from ordinary signatures.

## Important scope

The SSZ package in Step 4.3 intentionally implements only the fixed-size/container subset currently
needed by consensus objects. General variable-list SSZ, network encoding, state serialization, and
full consensus-state Merkleization are Step 4.4/4.5 work.

The finality tracker implements the frozen one-block chained rule. Full lock/unlock safety rules,
fork-choice subtree weighting, equivocation detection, and SAFETY_HALT integration are separate
modules that build on these types.

## Next

Step 4.4 should implement:
- validator records and 15-seat committee state;
- proposer/fallback permutation generation;
- attestation production/collection;
- QC assembler;
- validator local slashing protection;
- basic in-process 15-validator consensus simulation.
