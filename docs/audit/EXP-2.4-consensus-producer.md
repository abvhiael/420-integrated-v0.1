# EXP-2.4 — Consensus, validator, and historical producer presentation qualification

EXP-2.4 qualifies the repository Explorer consensus/validator presentation path and historical execution-block producer trace.

## Repository guarantees

- Consensus finality ordering remains finalized <= safe <= head.
- Consensus dimensions are nonzero and internally consistent.
- Current/next-slot, epoch, slot-in-epoch, rotation, and slot-in-rotation values are arithmetically consistent.
- Active committee shape, proposer schedule membership, and proposer/fallback uniqueness fail closed.
- Checkpoint roots are required.
- Certified QCs require block/parent provenance, valid signer/quorum participation, and cannot be beyond the projected head/current slot.
- Explorer derives participation and boundary presentation only from validated Indexer data.
- The Indexer client rejects any consensus response claiming canonical authority.
- Historical block producer traces retain execution hash, consensus root/slot, producer seat, proposer rank, certification, finality, and explicit authority labels.

## Deferred boundaries

This milestone does not claim a deployed consensus source, live validator/committee witness, live block-to-producer comparison, deployed UI producer workflow, canonical consensus authority, or Genesis readiness. Those remain with EXP-4/7/8 as applicable.
