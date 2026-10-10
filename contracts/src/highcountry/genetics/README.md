# High Country Genetics Foundation

HC-4 introduces the immutable genome and typed genetics-asset substrate used by later breeding and cultivation modules.

- Every genome stores exactly 28 loci.
- Genome records are append-only and immutable after registration.
- Sixteen founding-line IDs are reserved by `FoundingGenetics`.
- Founding genomes may only be registered before Genesis finalization.
- Normal gameplay genomes may only be registered after Genesis finalization.
- Seed lots preserve original issuance quantity and genome/breeding-event records; only remaining units are transferable. consumedQuantity and remainingQuantity provide spendable-balance accounting.
- Unconsumed clones are transferable and must reference an existing mother with the same genome; consumedByPlant permanently binds each used clone.
- Mothers are transferable while active, have a finite cutting budget, and retire automatically when exhausted.
- Phenotypes are permanent immutable provenance records.
- Breeding-event IDs and plant IDs currently remain opaque provenance anchors in these asset registries, even though HC-5 and HC-6 registries now exist. R02.4 closes seed/clone consumption at plant admission with owner approval, transfer-epoch invalidation, reciprocal binding and exact source context. Fabricated breeding/phenotype anchors remain R02.6; mother-cutting issuance remains R02.5. See docs/highcountry/R02.4-PLANT-SOURCE-CONSUMPTION.md.
- HC-INV-GENETICS-009 through HC-INV-GENETICS-013 protect genome immutability, typed-asset provenance, mother budget conservation, and phenotype permanence.
