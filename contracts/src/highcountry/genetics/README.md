# High Country Genetics Foundation

HC-4 introduces the immutable genome substrate used by later seed, clone, mother, phenotype, breeding, and cultivation modules.

- Every genome stores exactly 28 loci.
- Genome records are append-only and immutable after registration.
- Sixteen founding-line IDs are reserved by `FoundingGenetics`.
- Founding genomes may only be registered before Genesis finalization.
- Normal gameplay genomes may only be registered after Genesis finalization.
- Capability-scoped actions separate founding-genome authority from ordinary genome registration.

Asset registries for seeds, clones, mothers, and phenotypes build on this genome layer and are added in the remainder of HC-4.
