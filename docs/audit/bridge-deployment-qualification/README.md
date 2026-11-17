# BRIDGE-AUDIT-12 — authoritative pre-testnet closeout record

**Status: local deployment preparation qualified; full release readiness blocked by an existing global Genesis freeze conflict.** Baseline current main: `996c2f13b64a02ed625f7fa0d8328ce7a8aaf753`. No production route is activated, no live deployment is claimed, and the task is not falsely marked fully closed. The published PR/final report supplies the exact qualified commit SHA; source and artifact hashes avoid a self-referential SHA inside that commit.

This record owns the final Bridge deployment preparation. Original audit evidence, its SHAs and CI IDs remain intact. `OPERATIONS.md` provides exact reproduction, dependency ordering, unsigned deployment/Registry publication, governance activation, isolation and recovery procedures. `RESULTS.json`, `SHA256SUMS`, the compiler package and local logs provide machine-readable evidence.

## Completed preparation

- Reconciled the 11-component canonical Bridge graph, 14 verifier candidate families and the generic token/source-provider route inventories against main. Updated the stale Genesis Bridge contract map to the actual production adapter candidates, custody/representation and token-route helper; two legacy BTC/ETH placeholders are separately disabled.
- Verified the authoritative frozen gateway `0x0438`, Registry `0x0434` and governance timelock `0x0429`. Router/asset registries do not regain retired `0x0443`/`0x043c` addresses. Non-predeploy reservations remain candidates, not frozen placements.
- Compiled the complete 152-source Bridge closure using native solc 0.8.24+commit.e11b9ed9, optimizer 200, viaIR, Cancun. Retained 113 Bridge/Registry artifacts, with ABI, creation/runtime bytecode, storage layouts, immutable references and link references. Maximum runtime 23,129 bytes; no unresolved library references or EIP-170 excess.
- Prepared deterministic configuration snapshots, explicit constructor schemas, pinned Genesis arguments and unsigned CREATE/publication plans with derived nonce/address identity. All source, configuration and artifact drift fails closed. Actual deployed external dependencies are required inputs; no source/issuer approval or placeholder root is fabricated.
- Corrected the shared VerifiedGateway420 initialization recipe from its obsolete two-argument constructor to the actual four-argument constructor, including Registry/configuration and explicit zero verifier. Retained constructor-materialized frozen-snapshot candidate runtime at `0x0438`, exact immutable values, empty storage and empty storage root. **It remains a candidate, not ARTIFACT_READY**, because current global inputs conflict with the frozen commitment.
- Executed a fresh owned local Anvil rehearsal of all 11 core constructors/publications. Checked predicted CREATE addresses, runtime bytes outside immutable slots, actual immutable getters, frozen placement, canonical Registry address/runtime/version publication, custody's qualification anchor/hash/self-address, empty economic approvals, both always-reverting legacy directions and unauthorized installation/activation rejection. The outcome authority is an existing always-reverting test fixture, explicitly excluded from production preparation.
- Qualified the planning boundary with 17 Python tests, including artifact/source/config/compiler-input tampering, wrong Registry/governance/configuration, active frozen gateway, duplicate deployments, invalid chain/nonce, legacy selection, custody ordering and production rejection of the real freeze conflict. The one initial rehearsal harness failure was asynchronous receipt availability, before contract assertions; receipt polling was corrected and only the affected rehearsal was repeated. Its actual failure log is retained.
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
| Required qualification | Fresh 17-test planning suite, complete production compilation, local rehearsal, affected inventory/address checks and retained-source verifier |
| Current-main integration | Exact tree/source verification and qualified SHA in associated PR; no unrelated source overwritten |
| One authoritative record | This directory; original chain/security evidence remains original evidence |
| Only external blockers in testnet roadmap | Existing source/network/issuer/provider/custody gates remain there; global freeze conflict stays below |
| Fully deployable closeout | **BLOCKED** until existing global commitment conflict is resolved; no readiness or full closure claimed |

## Existing global freeze conflict — not a testnet dependency

`contracts/config/genesis-config-commitment.json` is FROZEN_V1 with hash `0x01aea63faef55d711e5f93e800b04702177874f4015375b659038ce991d20921`. That commitment still hashes its original payload correctly, and all Bridge frozen addresses agree. Two of its six authority-file blob pins differ from current main:

| Authority file | Frozen blob | Current main blob |
|---|---|---|
| `contracts/config/genesis-address-namespace.json` | `e6461503fbf49de5ef296ab3b102c39981a29342` | `d9c40056db30513c0445f0c341d261b63dc6a1a5` |
| `config/genesis-applications.json` | `c8d3697a02dbc7b4fbd6e3713f5ac4a0e6611806` | `3f177b0062c307758767c0abfe596cc1d3e2ae2b` |

The namespace changes add the AI router component preimage and Registry-resolved arbitration router; the applications change retains the recorded Arcade launch deferral and guest-first policy. Reverting them would disturb concurrent approved work. Changing the frozen hash would change every affected resident runtime and invalidate its materialization. The commitment explicitly requires an **explicit commitment-version decision and re-materialization of affected Genesis residents** and forbids silent regeneration under FROZEN_V1. That existing protocol-wide decision is not invented or performed inside this Bridge task. Production planning rejects the conflict; canonical candidate files say `deployment_ready: false`. The prior global verifier already rejects these same input pins. Nothing here suppresses or weakens that assertion.

## Remaining work and next canonical step

The only observed pre-testnet closeout blocker is the existing shared freeze reconciliation above. It must be resolved before this step can truthfully be fully closed; it has not been moved into the testnet roadmap. No actual deployment chain ID, deployer, nonce, funded custody, issuer/provider approval, source authority, trusted root or live gateway has been guessed.

The next existing roadmap work remains [420Bridge testnet/deployment qualification](../420BRIDGE-TESTNET-WORK-ROADMAP.md), followed by the existing independent audit/launch review. It is not started here. Its SOL/POT/ARRR, Ethereum/BTC and native-provider/custody prerequisites retain their original scope and status.
