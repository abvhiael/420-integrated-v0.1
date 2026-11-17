# BRIDGE-AUDIT-12 — authoritative pre-testnet closeout record

**Status: BRIDGE-AUDIT-12 pre-testnet deployment preparation qualified.** Reconciled current main: `3afd666f9e39e77ab13dc78f0e78a72f87785572` (original preparation baseline `996c2f13b64a02ed625f7fa0d8328ce7a8aaf753`). No production route is activated and no live deployment is claimed. Exact qualified SHA/tree and integration are recorded by PR #1187. The V1 authority conflict is resolved by the explicit V2 decision and affected-runtime evidence below. The published PR/final report supplies the exact qualified commit SHA; source and artifact hashes avoid a self-referential SHA inside that commit.

This record owns the final Bridge deployment preparation. Original audit evidence, its SHAs and CI IDs remain intact. `OPERATIONS.md` provides exact reproduction, dependency ordering, unsigned deployment/Registry publication, governance activation, isolation and recovery procedures. `RESULTS.json`, `SHA256SUMS`, the compiler package and local logs provide machine-readable evidence.

## Completed preparation

- Reconciled the 11-component canonical Bridge graph, 14 verifier candidate families and the generic token/source-provider route inventories against main. Updated the stale Genesis Bridge contract map to the actual production adapter candidates, custody/representation and token-route helper; two legacy BTC/ETH placeholders are separately disabled.
- Verified the authoritative frozen gateway `0x0438`, Registry `0x0434` and governance timelock `0x0429`. Router/asset registries do not regain retired `0x0443`/`0x043c` addresses. Non-predeploy reservations remain candidates, not frozen placements.
- Compiled the complete 152-source Bridge closure using native solc 0.8.24+commit.e11b9ed9, optimizer 200, viaIR, Cancun. Retained 113 Bridge/Registry artifacts, with ABI, creation/runtime bytecode, storage layouts, immutable references and link references. Maximum runtime 23,129 bytes; no unresolved library references or EIP-170 excess.
- Prepared deterministic configuration snapshots, explicit constructor schemas, pinned Genesis arguments and unsigned CREATE/publication plans with derived nonce/address identity. All source, configuration and artifact drift fails closed. Actual deployed external dependencies are required inputs; no source/issuer approval or placeholder root is fabricated.
- Corrected the shared VerifiedGateway420 initialization recipe from its obsolete two-argument constructor to the actual four-argument constructor, including Registry/configuration and explicit zero verifier. Retained constructor-materialized frozen-snapshot candidate runtime at `0x0438`, exact immutable values, empty storage and empty storage root. The canonical V2 gateway is now ARTIFACT_READY in the shared predeploy and deployment manifests, with runtime `0x560f89d7b0c658beeb207cbca1e034d33be66e4b2bcab452b755d5a7b993c64b`, zero verifier, zero qualification and empty storage.
- Executed a fresh owned local Anvil rehearsal of all 11 core constructors/publications. Checked predicted CREATE addresses, runtime bytes outside immutable slots, actual immutable getters, frozen placement, canonical Registry address/runtime/version publication, custody's qualification anchor/hash/self-address, empty economic approvals, both always-reverting legacy directions and unauthorized installation/activation rejection. The outcome authority is an existing always-reverting test fixture, explicitly excluded from production preparation.
- Qualified the planning boundary with 20 Python tests, including artifact/source/config/compiler-input tampering, wrong Registry/governance/configuration, active frozen gateway, duplicate deployments, invalid chain/nonce, legacy selection, custody ordering and production acceptance of V2 plus rejection of authority drift, payload tampering and retired V1. The original 17-test result and initial controlled rehearsal remain historical evidence at `ac21f1dc9d1793c231c66c670b5cc0586aa59d1c`. The V2 rehearsal freshly executes all 11 core deployments with the actual V2 configuration hash. The one initial rehearsal harness failure was asynchronous receipt availability, before contract assertions; receipt polling was corrected and only the affected rehearsal was repeated. Its actual failure log is retained.
- Preserved and verified the prior security/settlement qualification: 14 attack families, 196 coverage entries, 399 referenced original pass records and the separately recorded 160-case/12,500-fuzz/512-invariant-run/32,768-call cohort. Counts overlap; they are not added or relabelled fresh tests. Historical CI remains at SHA `5f58baf6dc861939a21119a0fce645060a067518`, runs `43563876850` and `43563876854`. No new CI runs or unrelated workflows are requested; `[skip ci]` preserves the existing trigger policy.

## Original requirement mapping

| Requirement | Evidence / status |
|---|---|
| Exact Genesis/adapter inventory | Genesis contract map, complete compiler manifest, constructor templates, retained 14-family verifier inventory |
| Frozen addresses | Authoritative namespace parity; local fixed gateway/Registry execution |
| ABI, bytecode, layouts, immutables | `package.tar.gz`, canonical materialized gateway candidate |
| Scripts and constructor parameters | `package.py`, `prepare.py`, `rehearse.py`, constructor templates; shared init recipe corrected |
| Ordering and Registry bindings | Executable unsigned plan; qualification publication precedes custody construction; 11 live local publications |
| Governance activation/rollback | `OPERATIONS.md`; original runtime/admission/revocation/recovery tests retained and source-verified |
| Deterministic manifests | Compiler/configuration inventory, unsigned plan, source/artifact and retained-file hashes |
| Adapter identity/activation prerequisites | Exact compiler identities, explicit external input schemas, existing identity/admission/runtime/proxy/root/config evidence preserved |
| No silent placeholder activation | Legacy selection rejected in planning; both runtime execution directions reject; no economic approvals generated |
| Local-EVM deployment rehearsal | `rehearsal/RESULTS.json`, seven assertion groups / 11 core deployments |
| Required qualification | Fresh 20-test planning suite, complete production compilation, local rehearsal, affected inventory/address checks and retained-source verifier |
| Current-main integration | Exact tree/source verification and qualified SHA in associated PR; no unrelated source overwritten |
| One authoritative record | This directory; original chain/security evidence remains original evidence |
| Only external blockers in testnet roadmap | Existing source/network/issuer/provider/custody gates remain there; global freeze conflict stays below |
| Fully deployable closeout | **PASS for pre-testnet preparation**; genuine live acceptance remains in the existing testnet roadmap |

## Explicit global configuration reconciliation

[GENESIS-CONFIG-V2.md](GENESIS-CONFIG-V2.md) records the version decision required by the existing frozen configuration policy. V1 is preserved byte-for-byte in `contracts/config/history/genesis-config-commitment-v1.json`; its original hash and qualification evidence are historical. V2 commits the six current authority inputs without reverting the approved namespace additions or Arcade deferral:

`0xa3d526cc61fa265507d4e44da7c1b07a42ffd3fc308a167692c5dba6505ae07d`

The global verifier pins that exact V2 status/domain/hash and checks all six input blobs and preserved V1 identity. Production planning verifies the same payload/hash and authority pins; drift still fails closed. No assertion is removed or converted into a pass for a known mismatch.

Fresh constructor execution matches the four affected frozen Swap runtimes and all nine Pay runtime identities (13 comparisons), in addition to the canonical Bridge gateway and 11-component Bridge rehearsal. Three Pay deployment records predated already-integrated main implementations: InvoiceRegistry420, PaymentRegistry420 and RefundManager420. Their retained deployment identities now match the freshly compiled current sources; `prior-pay-package.json` preserves the old record. No production Solidity implementation changes. The affected Pay publication/wiring test passes (1 test, zero failures/skips); the global, Swap and Pay verifiers, deterministic reconciliation, inventory and frozen-address checks pass. Logs, source hashes and 15 affected-owner compiler artifacts are retained in `v2-logs/` and `v2-residents/`.

The original 113-artifact Bridge compiler package is unchanged: its 152 source hashes still match this head, so its passing compiler/security evidence is preserved without redundant native-chain suites or CI. Historical CI IDs `43563876850` and `43563876854` remain at their original SHA, not this head. New CI run IDs: none; existing `[skip ci]` behavior is used without changing any workflow trigger, path filter or branch rule.

## Remaining work and next canonical step

No pre-testnet blocker remains in this assigned preparation step. Actual deployment chain ID, deployer/nonce, real source authority, custody, trusted roots and issuer/provider authorization remain explicit inputs to the existing [420Bridge testnet/deployment qualification](../420BRIDGE-TESTNET-WORK-ROADMAP.md), followed by the existing independent audit/launch review. That next work has not begun here. Its SOL/POT/ARRR, Ethereum/BTC and native-provider/custody prerequisites retain their original scope; a destination testnet alone cannot satisfy source-side authority requirements.
