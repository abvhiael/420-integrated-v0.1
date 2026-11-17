# Explicit Genesis configuration V2 decision

BRIDGE-AUDIT-12 requires deterministic deployment against current main. Under that assigned reconciliation scope, supersede the internally inconsistent V1 authority-input snapshot with **FROZEN_V2**, preserving the approved current-main inputs. This is the explicit version decision required by the existing commitment policy, followed here by affected resident re-materialization. It is not silent regeneration under FROZEN_V1, a contract/interface upgrade, or a new approval process.

V1 remains byte-for-byte preserved at `contracts/config/history/genesis-config-commitment-v1.json`, Git blob `c8537f6c984ba7d4965e8b51aaefc26c6e2e1cd5`, configuration hash `0x01aea63faef55d711e5f93e800b04702177874f4015375b659038ce991d20921`. The active record explicitly links that predecessor.

V2 uses the same serialization schema, canonicalization, six authority-input paths, initialization version 1, timelock `0x0429`, Registry `0x0434` and configuration scope. Its domain is `420/GENESIS/CONFIG/V2`; its independently pinned hash is:

`0xa3d526cc61fa265507d4e44da7c1b07a42ffd3fc308a167692c5dba6505ae07d`

Only two authority input contents differ from V1:

| Input | V1 blob | V2/current-main blob | Reason |
|---|---|---|---|
| `contracts/config/genesis-address-namespace.json` | `e6461503fbf49de5ef296ab3b102c39981a29342` | `d9c40056db30513c0445f0c341d261b63dc6a1a5` | Retain approved AI router preimage and Registry-resolved arbitration router additions. |
| `config/genesis-applications.json` | `c8d3697a02dbc7b4fbd6e3713f5ac4a0e6611806` | `3f177b0062c307758767c0abfe596cc1d3e2ae2b` | Retain recorded Arcade launch deferral and guest-first policy. |

All frozen contract addresses and the other four authority blobs are unchanged. The global verifier and production planner check the exact V2 identity and current input blobs. Payload tampering, input drift and attempted use of retired V1 are negative planner cases, not ignored discrepancies.

## Affected identities and evidence

| Surface | Reconciliation |
|---|---|
| VerifiedGateway420 at `0x0438` | Execute the unchanged compiler constructor with canonical V2 arguments; compare immutables and runtime; retain explicit empty storage, zero verifier and zero qualification. Install the qualified offline artifact/state identity into both shared manifests. |
| Four fixed Swap residents | Re-materialize GenesisDEXFactory, PublicBatchAuction, TWAPOracle and ApprovedQuoteAssetRegistry from unchanged retained compiler templates and compiler-declared immutable offsets. Fresh constructor execution exactly matches all four runtime bytes, getter values and empty declared storage. |
| Nine Pay deployment identities | Re-derive from fresh current-main compiler output and V2 arguments; fresh constructor execution matches all nine runtime hashes and canonical immutable getters. No fixed Pay address is invented. |
| Bridge core and other deployment inputs | Fresh 11-component local rehearsal uses V2; constructor templates pin V2 for all applicable candidates. Registry-resolved deployments still require actual deployer/nonce/chain and external dependencies. |
| Other retained predeploys | Stake uses its independent Stake configuration hash; Registry, Names, Identity and Random have no global configuration immutable in their retained constructor identities. Those unaffected qualified artifacts are preserved. No whole-network Genesis readiness is inferred. |

The previous Pay package also predates three already-integrated main implementations. Reconcile exactly these source identities, preserving `prior-pay-package.json` as historical evidence:

| Contract | Current source Git blob |
|---|---|
| InvoiceRegistry420 | `98061a3fed76b4caae040dec1f26ae3de698ecee` |
| PaymentRegistry420 | `2c57d344e36995d17154a1553fc7aac24dc0d7d3` |
| RefundManager420 | `432705e375bef5c4f1a6b3d336a46e48ec1903f8` |

Their current compiler-derived ABI, creation/template/runtime identities replace stale deployment metadata. There are no production Solidity edits. The Pay deployment/publication/wiring regression passes with current sources and V2; the Pay static/materialization verifier passes. Current Foundry configuration provenance is retained; optimizer 200, viaIR, Cancun and solc 0.8.24 remain unchanged. Original Swap compiler artifacts and the original Bridge compiler archive remain byte-identical.

`v2-residents/RESULTS.json`, raw compiler archive, test source hashes and `v2-logs/` retain the actual executions. `RESULTS.json` and `SHA256SUMS` bind the authoritative final package. Existing native security, fuzz and invariant evidence retains its original SHAs/run IDs and is source-verified rather than relabelled as a new execution.

No live V1-to-V2 migration is claimed or performed. A real populated deployment must never receive this offline runtime replacement as a storage rollback. The existing governance activation, deployed-runtime verification, custody/source/issuer prerequisites and funded testnet acceptance remain mandatory under the existing testnet roadmap.
