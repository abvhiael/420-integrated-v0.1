# Authentic blockchain evidence catalogue

BRIDGE-AUDIT-3.V.17. This is a reproducible historical qualification dataset, not a verifier, live trust root, issuer approval or route activation mechanism.

The checked-in package contains 495 original-byte artifacts (25,240,921 bytes) across 15 datasets: 341 historical or historically derived artifacts, 12 controlled fixtures, 18 RPC observations, 18 expected-result records, 37 provenance records and 69 qualification records. All records carry SHA-256, Git blob identity, network, origin, scope and immutable source lineage. The source lock enumerates every pinned path/object. Data copied from earlier audit branches retains its original source commit, even when that PR has not merged into main.

## Reproduce

Use Python 3.10 or newer; no third-party packages, node credentials, viewing keys or network access are needed for verification.

```sh
python3 scripts/bridge_evidence_catalogue.py verify
python3 scripts/test_bridge_evidence_catalogue.py
python3 scripts/bridge_evidence_catalogue.py materialize --destination /tmp/bridge-evidence-copy
```

To independently reacquire pinned bytes from a Git repository containing the source objects (fetch the exact source commits from `sources.json` first):

```sh
python3 scripts/bridge_evidence_catalogue.py materialize --repository /path/to/source-repository --destination /tmp/bridge-evidence-reacquired
python3 scripts/bridge_evidence_catalogue.py build --repository /path/to/source-repository
```

`build` regenerates the package deterministically from the source lock. Recovered original records already bundled here are reused only after checking their original published checksum manifests. Initial recovery used the retained original workspace logs; it did not generate replacement test runs. `materialize --repository` reads the original commit/path blobs rather than trusting copied data. Both outputs must pass full catalogue verification. Use a fresh destination; unlisted payloads are rejected.

The catalogue digest is pinned in `catalogue.sha256`; reviewers should compare that digest and the source lock against the qualified Git revision. Local hashes establish byte integrity relative to that revision, not independent network finality. `claim --artifact ID --capability NAME` enforces the recorded scope. It rejects full 420 gateway authorization, route activation, current validator authority/current tip, full-archive integrity and shielded note ownership for every record. This command is a dataset classification check, not a production authorization service.

## Dataset inventory

Historical columns include raw and historically derived records. RPC captures and controlled material are deliberately separate.

| Dataset | Original source SHA | All artifacts | Historical | Controlled | RPC observations |
|---|---|---:|---:|---:|---:|
| bitcoin | `97413f2eea862d5f2ec3117313cd3beb15a634f4` | 12 | 4 | 0 | 0 |
| ethereum | `2d766cb0421cdfb3b28a1cd5dc14991b03c16cc3` | 52 | 34 | 0 | 7 |
| litecoin | `5741522429732437b92b3a9e0d0f659d6b781b1f` | 20 | 9 | 1 | 0 |
| dogecoin | `cfafb347a3f4c1f8401df47488a78c30922af3b8` | 115 | 107 | 0 | 0 |
| bnb | `f28a454008450d5ad5d95e6d07cf1841bf7d1bc5` | 115 | 107 | 1 | 1 |
| solana | `97413f2eea862d5f2ec3117313cd3beb15a634f4` | 17 | 7 | 2 | 2 |
| tron | `97b1323b27d8208dba3843734cf2275b63e47bfd` | 21 | 16 | 0 | 0 |
| xrpl | `d37d35a18668d68cc960aae6be19441f241a7e2a` | 15 | 8 | 1 | 0 |
| potcoin | `e2f1230095f7261a29610f786b1eb48e0b6d0623` | 10 | 3 | 2 | 0 |
| curecoin | `30dcfe4d990bb5b65add04fcc8214b3aff91ea1f` | 36 | 26 | 2 | 0 |
| dobbscoin | `97ba7bcbfe9a28e4fc1709248015d5a9b7d25a04` | 10 | 2 | 1 | 0 |
| pirate | `02c96466f03b203a682c548cb1a6e591848aa4af` | 10 | 3 | 2 | 0 |
| cctp | `0a677dc9c7eedc2f56c5b35141ae770a2e13e679` | 27 | 15 | 0 | 3 |
| cadc | `6ca38ccba5fbec26dced66ee21d08ddecd5a5b16` | 18 | 0 | 0 | 4 |
| token-routes | `3724e246f2c4deeab69ac0892742291c72a40df0` | 17 | 0 | 0 | 1 |

## Expected results and retained qualification

`catalogue.json` links each dataset to original provenance, expected results and original qualification records. It reproduces 418 matches against earlier checksum manifests with zero conflicts. It independently calculates 39 bounded header identities / CCTP wire bindings with Python's standard library; the previously qualified chain verifiers, signature verification, native historical replays and issuer protocol tests remain tied to their original source revisions. No old consensus suite was rerun. These 39 checks supplement retained cryptographic qualification; they do not claim to repeat full chain validation.

19 original CADC/token-route logs were omitted from their published source trees despite being listed by the published checksum manifests. The retained original bytes match those published hashes. They are stored under `recovered/` with an explicit `RECOVERED_ORIGINAL_RECORD` lineage and absent-original-path disclosure. They are not retroactively represented as files present in those older commits. Prior failed diagnostic logs remain failed diagnostics, distinguished by their original filenames and results; inclusion does not turn them into passing evidence.

## Evidence boundaries

- BTC, LTC, DOGE and BNB include authentic historical headers/transactions and applicable inclusion or consensus evidence. Ordinary payments are not approved gateway deposits; historical segments do not establish the current canonical tip.
- Ethereum includes retained genuine consensus proof/checkpoint data, transaction/receipt and account proofs. Controlled gateway execution remains separate from historical network evidence.
- Solana contains genuine signed transactions alongside explicitly untrusted RPC execution/finality/loaded-address/stake observations. The 699-account stake candidate is not authenticated authority. Existing testnet deferrals are preserved.
- Tron and XRPL retain authenticated historical consensus contexts and successful payments; those payments lack the required 420 gateway binding. Historical SR/UNL data is not current governance approval.
- PotCoin has genuine genesis evidence. Applicable post-transition historical PoS evidence remains unavailable; controlled vectors cannot replace it.
- Curecoin and Dobbscoin include historical samples and retained independently checked native replay results. Their large complete source archives are not vendored here; reported full-replay counts are not counts of bundled blocks. Test checkpoint authorities / unapproved candidates and regtest AuxPoW are not production trust roots.
- Pirate includes historical Equihash headers and a public shielded transaction/inclusion sample. The source explicitly says the complete archive checksum was not verified. Canonical tip, native dPoW/notary/anchor evidence, ownership, viewing authority and spent-state are not established. No viewing credentials are included. Native regtest material is controlled, not historical mainnet evidence.
- CCTP includes five genuine issuer messages and attestations; four retained records have destination execution observations. The Ethereum-to-Base record does not claim an observed destination receipt. Existing native issuer transfers do not authorize a 420 domain or deployment.
- CADC includes two genuine native issuer OFT transfers and original fork qualification; RPC captures alone are not chain-finality proofs. Required issuer authorization, 420 endpoint/EID/OFT and approved DVNs remain external prerequisites.
- Token-route decimal/mint observations qualify recorded source-state comparisons only, not finality or gateway transfer authorization.

No record establishes complete 420 gateway-transfer authorization. See per-dataset `limitations` for precise scope; unavailable data remains explicit rather than synthesized. Original scripts are named at their original immutable commits and may require their documented tooling/network access; the catalogue verifier never runs them automatically.
