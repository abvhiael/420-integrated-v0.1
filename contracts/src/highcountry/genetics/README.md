# High Country Genetics Foundation

HC-4 introduces the immutable genome and typed genetics-asset substrate used by later breeding and cultivation modules.

- Every genome stores exactly 28 loci.
- Genome records are append-only and immutable after registration.
- Sixteen founding-line IDs are reserved by `FoundingGenetics`.
- Founding genomes may only be registered before Genesis finalization.
- Normal gameplay genomes may only be registered after Genesis finalization.
- Seed lots are transferable and preserve genome plus breeding-event provenance.
- Clones are transferable and must reference an existing mother with the same genome.
- Mothers are transferable while active, have a finite cutting budget, and retire automatically when exhausted.
- Phenotypes are permanent immutable provenance records.
- Breeding-event IDs and plant IDs remain opaque provenance anchors until HC-5 and HC-6 own their canonical registries.
- HC-INV-GENETICS-009 through HC-INV-GENETICS-013 protect genome immutability, typed-asset provenance, mother budget conservation, and phenotype permanence.
