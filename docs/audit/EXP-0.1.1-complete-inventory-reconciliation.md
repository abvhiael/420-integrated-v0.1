# EXP-0.1.1 — pinned-tree Explorer inventory reconciliation

**Audited base:** `95a83a961286701b6e8c064de1deccad10f41fd7` (immutable; not a moving `main` reference).  
**Evidence workflow:** [PR #372 run #36068061554](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/36068061554).  
**Raw machine evidence:** [full-tree.tsv, explorer-candidates.tsv and summary.json](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/36068061554/artifacts/10837461133).

## Accounting gate — passed

The repository-side `scripts/exp-0-1-1-inventory.py` reads `git ls-tree -r -z --full-tree` at the pinned SHA, rather than relying on truncated GitHub directory results or code search. It records the path and Git blob SHA of **all 4,388 tracked entries**, checks for duplicate paths, verifies candidate paths against that full tree and collects evidence for every textual Explorer match. The workflow found **333 matching tracked text files**, **351 candidates** including exact known cross-service files, **zero uninspected text matches** and **zero missing candidate tree entries**. The resulting three-file artifact was successfully uploaded. This proves complete enumeration of Git-tracked entries at the selected commit; it does not assert that ignored, untracked or binary-content-only references are enumerated.

## Classification reconciliation

The initial automatic classification (68 Explorer-owned / 18 shared / 89 referenced / 176 incidental) is **not** the final relationship taxonomy. Inspecting candidate paths and matched evidence yields **68 Explorer-owned / 56 shared / 143 referenced / 84 incidental**, with **135 corrections**, **351 of 351 candidates assigned a category**, and **4,037 non-candidate tracked files recorded as out of scope**. File classification means that the file's relationship to the Explorer inventory is recorded; it is not a claim that every transitive runtime dependency has been qualified.

- **Explorer-owned**: `explorer/**`; `docs/apps/explorer/**`; `testnet/public-services/explorer/**`; `contracts/config/420explorer-genesis.json`; `docs/420EXPLORER.md`; `docs/publication/explorer-integration.md`; `scripts/verify-explorer-indexer-consumer.py`; `scripts/validate-doc-explorer-integration.py`; `.github/workflows/explorer-live-testnet.yml`.
- **Shared**: Indexer (`indexer/**`, `420-indexer/**` candidates), `.github/workflows/420indexer.yml`, `config/420indexer-v1.json`, `config/genesis-applications.json`, the genesis dApp contract map, common Indexer readiness, contextual documentation and publication maps, testnet service inventory/endpoints/preflight/observation inputs, `mkdocs.yml`, and the common documentation context package. These belong to shared infrastructure or qualification paths; Explorer does not independently own their authority.
- **Referenced**: Exchange's `EXCHANGE_EXPLORER_URL` workflow/configuration; Wallet's Explorer link and genesis app catalog; AppStore, Verify, Search, Registry and other application docs and UI deep links; testnet launch/runbooks and support pages. These are consumers or contextual references, not Explorer-owned components.
- **Incidental**: historical release copies and ecosystem-level text that mentions an explorer generically or in a non-integrating narrative. These do not, on the available path/text evidence, establish a direct Explorer build, test or runtime dependency.

Notable corrections to the automatic pass: `.github/workflows/exchange-web-deploy.yml` is a **reference**, not an Explorer-owned/shared CI gate; `mkdocs.yml` and `packages/420-docs-context/genesis-dapps.json` are **shared publication integration**, not incidental; `scripts/testnet-preflight.py` and `config/genesis-applications.json` are **shared testnet/genesis integration**; the Wallet genesis app catalog is a **referencing client**, not Explorer-owned code. `contracts/src/libraries/ServiceIds420.sol` references the Explorer service identifier but is **not an Explorer-owned smart contract**.

## Test and qualification boundary

The PR workflow passed Go tests and vet for `indexer/...` and `explorer/...`, the TypeScript Indexer suite (144 tests), readiness JSON validation, and both shared-indexer verifier scripts. Inventory generation and upload also passed. These are the tests **run for this inventory PR**, not a blanket live-deployment or Genesis qualification assertion.

The accounting and path-level classification work of **EXP-0.1.1 is complete at the pinned commit**. Source-by-source import/reference depth, required versus optional dependencies, ABI/address authority, runtime behavior and missing capability verification belong to the explicitly subsequent EXP-0.1.2 through EXP-0.1.6 gates. Do not treat this inventory report as qualification of those milestones.

**Method limits:** `git grep -I` excludes binary contents; binary filenames and SHA entries remain in the complete tree. Identifiers or transitive dependencies that never contain the Explorer token and are not part of the enumerated explicit inputs will be traced during dependency reconciliation. The candidate taxonomy is based on repository path and matched textual evidence rather than an assertion that the entirety of every cross-application source file has been line-by-line audited. The CI artifact holds the initial register; the separately supplied reconciled register preserves the 135 classification corrections and pinned blob SHAs.
