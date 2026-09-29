# REG-AUDIT-1 — authoritative Registry API decision

**Status:** DECISION FROZEN — implementation intentionally deferred to REG-AUDIT-2  
**Repository:** `abvhiael/420-integrated-v0.1`  
**Baseline main:** `ac1b9c5a5d7e1b031ea63c210b8c38ac3abee6df`  
**Working PR:** #393  
**Canonical roadmap source:** `docs/audit/420REGISTRY-COMPLETE-AUDIT-20260928.md`

## Original step definition

REG-AUDIT-1 requires the repository to resolve the contradiction between:

- `contracts/src/apps/ProtocolRegistry.sol`;
- frozen `contracts/src/interfaces/genesis/IProtocolRegistry420.sol`;
- `contracts/src/system/GenesisResidentAccess420.sol`;
- generated ABI/reference expectations.

The canonical roadmap explicitly forbids casually editing the frozen v1 interface and requires choosing one of three designs:

A. make `ProtocolRegistry` implement frozen v1 semantics while preserving existing service/history behavior;  
B. introduce a canonical adapter at the Registry authority address; or  
C. explicitly version/migrate the frozen interface under the repository's major-version governance rules.

**Exit criterion:** one authoritative ABI/state model with no ambiguous adapter ownership.

Implementation of that decision is REG-AUDIT-2 and is not silently pulled into this step.

## Repository facts that constrain the decision

1. `IProtocolRegistry420` is part of the semantically frozen Genesis interface layer v1.0.
2. The freeze rules allow ABI-compatible minor extensions, but semantic major changes require a new major interface version plus migration/review.
3. `GenesisResidentAccess420` directly casts its configured Registry address to `IProtocolRegistry420` and depends on `component()` and `supportsVersion()` for fail-closed dependency checks.
4. `contracts/config/genesis-dapp-contract-map.json` identifies the 420 Registry contract set as exactly `ProtocolRegistry.sol`.
5. No canonical Registry adapter implementing `IProtocolRegistry420` was found on the audited branch.
6. The repository already has a global Genesis address reconciliation blocker. Introducing a second canonical Registry contract/address would worsen, not reduce, that ambiguity.
7. Existing `ProtocolRegistry` service IDs use the `420/service/.../v1` namespace. Frozen resident component IDs use the distinct `420/APP/...` namespace. They must not be implicitly converted or conflated.
8. Existing `ProtocolRegistry.Service.version` is a strictly sequential publication revision. Frozen `Types420.Version` is semantic `major.minor.patch`. They are different concepts and must not be implicitly converted.

## Decision

**Choose option A.**

`ProtocolRegistry.sol` is the single canonical Registry authority and, in REG-AUDIT-2, must directly implement the frozen `IProtocolRegistry420` v1.0 read semantics while preserving the existing Registry service catalogue/history API.

There will be **no separate canonical Registry adapter** and **no v2 interface migration** for this reconciliation.

The frozen file `IProtocolRegistry420.sol` remains semantically unchanged.

## Authoritative state model

The single `ProtocolRegistry` contract owns two explicit, non-interchangeable identity views.

### 1. Service catalogue

Key: canonical `serviceId` from `ServiceIds420` or an explicitly governance-approved extension ID.

Purpose:

- ecosystem service identity;
- current implementation;
- sequential publication revision;
- code hash and metadata commitments;
- immutable service revision history;
- registration-profile commitments;
- service activation/deprecation for discovery.

The existing `Service`, history, registration-profile and strict publication model remain valid and must be preserved by REG-AUDIT-2.

The existing scalar `uint32 Service.version` is a **publication revision**, not a semantic version.

### 2. Frozen Genesis component registry

Key: explicit `componentId` from the frozen Genesis component/dependency namespace (`GenesisInterfaceIds420`, `AppDependencyIds420`, or another explicitly approved component identifier).

Purpose:

- dependency resolution for Genesis residents;
- exact implementation pointer;
- runtime code-hash commitment;
- semantic `Types420.Version`;
- shared `Types420.Lifecycle`;
- v1 interface compatibility checks.

A component ID is **not** a service ID. No hashing, string rewriting, aliasing or inferred conversion between the two namespaces is permitted.

Where one deployed implementation participates in both views, the relationship must be explicit and consistency-checked in REG-AUDIT-2. Matching names or addresses are not sufficient evidence of identity.

## Frozen `IProtocolRegistry420` semantics

REG-AUDIT-2 must make the single `ProtocolRegistry` satisfy the existing frozen interface without changing these semantics.

### `component(componentId)`

Returns the complete canonical current `Types420.ContractRef` for that exact component ID.

Unknown component IDs return the zero/default reference or fail closed in a way compatible with existing resident checks; they may never resolve to a guessed service record.

### `isActive(componentId)`

Returns true **only** when the current component lifecycle is `Types420.Lifecycle.ACTIVE`.

No service-catalogue `active` flag may be substituted for a missing component record.

### `resolve(componentId)`

Is an operational component-resolution read. It must fail closed for an unknown or non-ACTIVE component and return only the implementation of the exact active component record.

It must never resolve by service-name similarity, stale history, UI metadata or an indexer projection.

### `runtimeCodeHash(componentId)`

Returns the code-hash commitment stored for the exact current component record. A security-sensitive consumer must still compare that commitment with actual deployed runtime code, as `GenesisResidentAccess420` already does.

### `supportsVersion(componentId, requested)`

Compatibility is defined by the frozen v1 semantic-version rules and only for an ACTIVE component:

- registered major must equal requested major;
- registered minor may be greater than requested minor because minor revisions are backward-compatible extensions;
- when registered minor equals requested minor, registered patch must be greater than or equal to requested patch;
- a lower minor or lower patch at the same minor does not satisfy a newer requested version;
- an unknown component, inactive component or major mismatch returns false.

No conversion from the service publication revision to `Types420.Version` is allowed.

### Events

`ComponentRegistered` and `ComponentLifecycleChanged` remain the frozen component-registry events and must be emitted by the direct `ProtocolRegistry` implementation when REG-AUDIT-2 adds component registration/lifecycle mutation.

Existing service events remain valid for the service-catalogue view.

## Mutation/authority boundary

REG-AUDIT-1 does not invent a second publisher.

REG-AUDIT-2 must preserve the existing GovernanceTimelock authority boundary for canonical Registry mutations and must not allow:

- a registered implementation to mutate its own canonical record merely because it is registered;
- indexers, Explorer, Search, AppStore, Developer Hub or UI state to authorize Registry mutation;
- service publication to silently manufacture a component binding;
- component registration to silently manufacture a service ID;
- lifecycle changes to grant custody, signing, governance, bridge, validator or token-transfer authority.

## Security decisions

- **No adapter authority split.** One canonical Registry contract owns both views.
- **No frozen-interface semantic rewrite.** v1 remains the resident dependency contract.
- **No implicit namespace conversion.** Service IDs and component IDs are independent.
- **No implicit version conversion.** Sequential publication revision and semantic version are independent.
- **Fail closed.** Unknown, inactive, version-incompatible or code-hash-mismatched component dependencies cannot satisfy resident checks.
- **Historical provenance remains intact.** REG-AUDIT-2 may add component state/history but may not rewrite existing service history.
- **No address decision here.** REG-AUDIT-4 remains the owner of namespace-wide Genesis address reconciliation.

## Option rejection record

### Option B — canonical adapter

Rejected because it would create a second contract at the Registry authority boundary, contradict the current Genesis dApp contract map, introduce adapter ownership/upgradability questions, and add another address to an already blocked Genesis namespace. It does not provide a security benefit over direct implementation of the frozen read interface.

### Option C — interface v2 migration

Rejected for REG-AUDIT-1 because the required resident semantics already exist in frozen v1 and can be implemented by `ProtocolRegistry` without changing their meaning. A v2 migration would be a semantic-major change requiring migration/review and would unnecessarily force every resident consumer off the already-frozen contract.

## Gap analysis for REG-AUDIT-1

| Requirement | State before this step | Resolution in this step |
|---|---|---|
| identify authoritative API owner | ambiguous | `ProtocolRegistry` frozen as sole owner |
| choose A/B/C | missing | option A selected |
| preserve frozen v1 semantics | at risk | explicit no-edit/no-v2 decision |
| preserve service/history behavior | required | existing service catalogue retained |
| resolve service ID vs component ID ambiguity | broken/unstated | explicitly separate namespaces |
| resolve scalar revision vs SemVer ambiguity | broken/unstated | explicitly separate version concepts |
| define lifecycle compatibility behavior | missing | frozen component lifecycle semantics specified |
| define `supportsVersion` behavior | inconsistent mocks | canonical compatibility rule specified |
| adapter ownership | ambiguous | no adapter permitted |
| mutation authority | implicit | GovernanceTimelock remains sole canonical publisher |
| address assignment | out of scope | explicitly retained for REG-AUDIT-4 |
| implementation | intentionally deferred | REG-AUDIT-2 |
| durable verification | missing | machine-readable decision + verifier + CI added |

## Qualification requirements for this decision step

REG-AUDIT-1 is qualified only when:

1. this decision and its machine-readable companion are committed;
2. the frozen `IProtocolRegistry420.sol` content remains at the audited v1 SHA-256;
3. the decision selects exactly one option and rejects adapter/v2 ambiguity;
4. service and component namespaces are explicitly distinct;
5. service publication revision and semantic component version are explicitly distinct;
6. no Registry contract/interface implementation is changed in REG-AUDIT-1;
7. the dedicated REG-AUDIT-1 verifier passes;
8. retained frozen-interface verification passes;
9. repository-wide 420 Integrated Qualification and 420Docs Qualification pass on the exact candidate head;
10. after recording exact-head evidence, the retained gates rerun on that evidence-recording head before the step is marked COMPLETE.

## Next canonical step

**REG-AUDIT-2 — implement and test the API reconciliation**

Implement the chosen direct compatibility layer; add direct compile-time/runtime interface tests; verify code-hash/lifecycle/version mapping; prove inactive/deprecated dependencies fail closed; and prove historical provenance survives the reconciliation.

Exit: all Genesis residents can resolve Registry dependencies through the frozen/approved interface.


## Candidate qualification evidence

Candidate exact head: `ec7484ed68073a02bb0f87a7c6006e921a3a38e0`

- 420Registry REG-AUDIT-1 run `36510366989` — **SUCCESS**
  - exact-head checkout/assertion — success
  - current frozen 25-interface layer verifier — success
  - frozen v1 interface verifier — success
  - REG-AUDIT-1 decision verifier — success
  - evidence artifact upload — success
- 420 Integrated Qualification run `36510367027` — **SUCCESS**
  - fault-matrix — success
  - offline-core — success
  - production-dependencies — success
  - geth-engine — success
- 420Docs Qualification run `36510366960` — **SUCCESS**

Recording this evidence changes the branch head. Under the exact-head rule, these candidate results do **not** by themselves complete REG-AUDIT-1. The same retained gates must pass again on the evidence-recording head. The literal final qualified SHA and final run IDs are recorded in PR #393 after that rerun so the qualified commit is not invalidated by another evidence-only commit.


## Reconciled closeout evidence

Reconciled implementation/evidence head: `7f3158acedd5255b7f927b8cdbccd9b94870881f`  
Base `main`: `d99f8a9c5b10d0007a5729ea46802bb58f5b0d56`  
Divergence at qualification: **7 ahead / 0 behind**

Exact-head retained gates on the reconciled head:

- 420Registry REG-AUDIT-1 run `36511054370` — **SUCCESS**
- 420Docs Qualification run `36511054371` — **SUCCESS**
- 420 Integrated Qualification run `36511054406` — **SUCCESS**
  - fault-matrix — success
  - offline-core — success
  - production-dependencies — success
  - geth-engine — success

All original REG-AUDIT-1 exit criteria are satisfied by the committed decision:

- one authoritative API owner: `ProtocolRegistry.sol`;
- frozen `IProtocolRegistry420` v1 semantics preserved;
- no canonical adapter;
- no v2 migration;
- service IDs and component IDs remain distinct namespaces;
- service publication revision and semantic component version remain distinct;
- GovernanceTimelock remains the mutation authority;
- REG-AUDIT-2 is the sole owner of runtime implementation of this decision.

This closeout text itself creates a new exact head. The retained gates must therefore pass once more on the commit containing this section. PR #393 records that literal final SHA and final run IDs without changing repository content, avoiding an evidence-recursion commit.
