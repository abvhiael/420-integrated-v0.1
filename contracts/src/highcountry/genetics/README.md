# High Country Genetics Foundation

HC-4 introduces the immutable genome substrate and typed genetics assets used by breeding and cultivation.

- Every genome stores exactly 28 loci.
- Genome records are append-only and immutable after registration.
- Sixteen founding-line IDs are reserved by `FoundingGenetics`.
- Founding genomes may only be registered before Genesis finalization.
- Normal gameplay genomes may only be registered after Genesis finalization.
- Seed lots are transferable and retain genome + breeding-event provenance.
- Clones are transferable and retain genome + mother provenance.
- Mothers are finite assets with an explicit maximum cutting budget and retire when exhausted.
- Phenotypes are permanent, immutable provenance records tied to a genome and source plant/breeding event.
- Capability-scoped actions isolate registration, transfer, and mother-cutting authority.

This layer intentionally stops short of recombination and mutation logic; those enter in HC-5 through the Breeding Engine and 420 Randomness boundary.

Current HC-4 focus: typed asset invariants and qualification.
