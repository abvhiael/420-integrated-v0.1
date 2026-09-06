# High Country HC-5 — Breeding + Randomness

HC-5 owns genetic derivation and the randomness boundary used to create new immutable genomes from qualified parents.

## Scope

- provider-neutral randomness requests keyed by domain + context
- one-time provider fulfillment with provider provenance
- requester/domain/context-bound randomness consumption
- single-consumption anti-reroll semantics
- immutable breeding-event provenance
- deterministic 28-locus recombination from two existing parent genomes
- bounded mutation derived from fulfilled entropy
- child-genome registration into `GenomeRegistry`

## Invariants

- `HC-INV-BREEDING-014`: randomness request/provider/context provenance is immutable and fulfilled entropy can be consumed at most once by the bound requester/context.
- `HC-INV-BREEDING-015`: breeding-event parents, child identity, request identity, and finalized entropy remain immutable after creation/finalization.

## Phase boundary

HC-5 does not model environment-dependent phenotype expression. `PhenotypeRegistry` remains the permanent record substrate created in HC-4, while phenotype expression caused by cultivation conditions belongs to HC-6, where the six environmental dimensions and plant lifecycle are authoritative.
