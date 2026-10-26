# HC-SEED-03 — Genetic translation and common reference genomes

## Completed result

All 23 canonical common cultivars have version-one reference genomes in `deployments/highcountry/common-reference-genomes.v1.json`, derived by `scripts/highcountry/common_reference_genomes.py` under `deployments/highcountry/common-genome-translation.v1.json`. Each entry includes 28 nonzero bytes32 loci, a stable nonfounding line ID, versioned genome ID, metadata commitment, full metadata and exact normal-registration arguments. Source research and canonical regional identities remain unchanged.

The generated manifest is registration-ready, **not live-registered**. HC-SEED-04 owns actual deployment registration and subsequent rare breeding. Qualification uses disposable contracts, test capabilities and test Genesis roots; none is a live deployment or production authority.

## Existing interpreter inspection

At baseline `830cb2ce38ef18c9be0269aaef844fbd42d5f293`:

- `contracts/src/highcountry/genetics/GenomeRegistry.sol` stores an immutable fixed array of 28 bytes32 values. No botanical trait decoder exists in this registry.
- `contracts/src/highcountry/breeding/BreedingEngine.sol` draws a parent for each whole locus using `keccak256(abi.encode(entropy, breedingEventId, i))`; bit zero selects parent A/B, and a byte threshold below five triggers its existing hash mutation. Neither operation interprets biological alleles. No breeding event is fabricated for a common reference specimen.
- `contracts/src/highcountry/cultivation/CultivationEngine.sol` computes stress and quality from six environmental dimensions and seals the genome identity into expression. It does not decode loci or infer climate adaptations from real-world origins.
- `contracts/src/highcountry/harvest/HarvestScoring.sol` uses `9000 + uint256(genomeId) % 2001` as the existing bounded modifier. It does not read loci. No ID search, alternative salt, performance-target selection or change to this rule occurs here.
- The existing Original Sixteen archive and approved art rules explicitly treat their V1 loci as opaque. Founder genomes, semantics and namespaces are preserved.

The source-to-game translation therefore follows actual V1 semantics rather than claiming an absent biological interpreter. Source descriptions become attributed reference metadata; the 28 loci are domain-separated, deterministic opaque commitments. Flavor, classification, terpene and morphology annotations do **not** become yield, potency, resistance, flowering or pharmacological rules. Reader-reported effects remain research-only and are excluded from the reference trait annotations.

`scripts/highcountry/common_reference_genomes.py::describe_reference` is an off-chain exact-reference inspector, not a new gameplay scoring engine. It returns descriptions only when genome ID, line ID, metadata hash, all loci and founding flag match a reference exactly. Unknown or bred genomes receive no inferred reference traits; a spoofed reference record rejects. Callers must first validate the manifest against canonical inputs. No frontend or live registry integration is claimed in this step.

The five inspected engine files are SHA-256 pinned in `common-genome-engine-inspection.v1.json`. The generator and CI reject a changed source baseline until its translation implications are reviewed.

## Derivation and versioning

The translation policy specifies UTF-8 canonical JSON: sorted object keys, compact separators, escaped non-ASCII characters, and no floating point values. Keccak is Ethereum Keccak-256, not standardized SHA3-256. Every hash input is explicit:

1. Research-entry commitment = Keccak(canonical entry JSON).
2. Stable line ID = Keccak(canonical JSON `[lineDomain, cultivarId]`).
3. Locus i = Keccak(canonical JSON `[locusDomain, cultivarId, referenceVersion, i, researchEntryHash]`) for i from 0 through 27.
4. Metadata hash commits the metadata object, including policy commitment, research commitment, source annotations, competing ancestry accounts, uncertainty and exact source records.
5. Genome ID = Keccak(canonical JSON `[genomeDomain, cultivarId, referenceVersion, lineId, metadataHash, loci]`).

Separate common domains prevent reuse of `HC.FOUNDING.GENETIC_LINE.1` through `.16`. New versions preserve line IDs and derive new metadata, loci and genome IDs. The writer rejects an attempt to overwrite an existing version with differing contents. Use `--reference-version N` to generate a distinct versioned file. No mutable salt or desired-yield input exists. Altered inputs make `--check` fail rather than rewriting a published specimen.

The translation policy's encoding is not Solidity `abi.encode`; Solidity qualification independently reconstructs the canonical JSON preimages and matches all 644 locus commitments to Ethereum Keccak.

## Registration requirements

Every record targets `registerGenome(bytes32,bytes32,bytes32,bytes32[28])`, with `founding=false`. Genesis must already be finalized. The authorized caller needs `ModuleIds.GENOME_REGISTRY` / `ActionIds.GENOME_REGISTER` with scope equal to the exact genome ID and amount zero. All identity/metadata fields are nonzero, all arrays contain exactly 28 values, and IDs are unique. Existing records cannot be overwritten. This manifest cannot grant capabilities, finalize Genesis or register itself.

Registration arguments are serialized as four ABI-compatible values in each entry; they are not broadcast transactions. Registration verification and address/chain binding belong to HC-SEED-04. An authorized post-Genesis reference specimen is not a claim of experimentally verified real-world DNA or confirmed historical parentage.

## Qualification

Install the same dependency already used by the repository's R07.2 Keccak rehearsal: `pycryptodome==3.23.0`.

```
python scripts/highcountry/common_reference_genomes.py --check
python -m unittest discover -s scripts/highcountry -p 'test_common_reference_genomes.py' -v
python scripts/highcountry/run_seed_genome_contracts.py
```

23 Python checks cover full canonical identity coverage, deterministic serialization and derivation, version separation, evidence commitments, no unsupported trait inference, exact reference inspection, registration arguments, preserved ancestry uncertainty, immutable version files and malformed-data rejection.

Nine Solidity tests run the actual unmodified GenomeRegistry, GenesisRegistry and HighCountryAuthorization, with the existing capability mock solely as a disposable grant issuer. They prove all 23 prepared records register exactly after finalization, all 23 reject before finalization or without grants, wrong-scope and revoked grants reject, zero identities reject, duplicate IDs cannot rewrite loci/metadata, the sixteen founding records remain unchanged, and all 644 Python locus commitments match Solidity Keccak.

The bounded runner copies only the transitive source import closure into a temporary Foundry project; no source transformations or test-assertion weakening. Compiler settings match canonical Solidity 0.8.24, Cancun, optimizer 200 runs and via-IR. It compiles fourteen files instead of unrelated applications. Foundry is pinned to v1.7.1 in the dedicated Level 1 workflow. No production contract changes are included.

HC-SEED-01/02 inputs remain byte-for-byte unchanged. Retain prior evidence: HC-SEED-01 at `2c97a9454f9a51cee10ed57a6c98ec21d1b01bda` / run 40265740974; HC-SEED-02 at `830cb2ce38ef18c9be0269aaef844fbd42d5f293` / run 40266592926. No unrelated global rerun is required. Exact-SHA HC-SEED-03 CI evidence is reconciled in PR #838 after publishing.

Next: HC-SEED-04, authorized common reference registration and canonical breeding derivation of the approved rare crosses. A future biological or statistical trait interpreter would require an explicitly versioned gameplay ruleset and its own qualification; it is not silently introduced by source metadata.
