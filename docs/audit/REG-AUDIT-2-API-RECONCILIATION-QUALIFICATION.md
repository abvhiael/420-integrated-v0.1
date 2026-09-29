# REG-AUDIT-2 — implement and test the API reconciliation

**Canonical roadmap source:** `docs/audit/420REGISTRY-COMPLETE-AUDIT-20260928.md`  
**Status:** IMPLEMENTED — exact-head qualification pending final reconciled evidence head  
**PR:** #393

## Original definition

After REG-AUDIT-1:

- implement the chosen compatibility layer;
- add direct compile-time/runtime interface tests;
- verify code-hash/lifecycle/version mapping;
- prove inactive/deprecated dependencies fail closed;
- prove historical provenance survives the reconciliation.

**Exit:** all Genesis residents can resolve Registry dependencies through the frozen/approved interface.

## Implemented reconciliation

REG-AUDIT-1 option A is implemented directly in `ProtocolRegistry.sol`.

- `ProtocolRegistry` now implements frozen `IProtocolRegistry420` v1.0 directly.
- No adapter contract was introduced.
- The frozen interface file is unchanged.
- Service IDs and component IDs remain separate namespaces.
- Sequential service publication revisions remain separate from semantic component versions.
- The previous ambiguous service `isActive(bytes32)` read is renamed to `isServiceActive(bytes32)`; frozen `isActive(bytes32)` is component lifecycle semantics.
- Governance-only `registerComponent` records implementation, runtime code hash, semantic version and lifecycle.
- Governance-only `setComponentLifecycle` changes only the current component lifecycle.
- Component registrations append an independent provenance revision and expose `currentComponentRevision` / `getComponentRevision`.
- Unknown/inactive components fail closed through `resolve`.
- `supportsVersion` requires ACTIVE lifecycle, exact major compatibility, registered minor >= requested minor, and registered patch >= requested patch when minors match.
- Existing service publication/history/profile state and APIs are retained except for the selector split required by the frozen interface collision.

## Gap analysis and disposition

| Canonical requirement | Pre-step state | REG-AUDIT-2 disposition |
|---|---|---|
| direct frozen interface implementation | missing | implemented |
| compile-time interface compatibility | missing | `ProtocolRegistry is ... IProtocolRegistry420` + Foundry build |
| runtime interface dispatch | missing | focused real-contract test |
| runtime code-hash commitment | service-only | component registration derives deployed `.codehash` |
| runtime code-hash validation by residents | consumer existed, real Registry incompatible | real `GenesisResidentAccess420` integration test |
| lifecycle mapping | absent | `Types420.Lifecycle` stored directly |
| inactive/deprecated fail closed | impossible through real Registry | focused real resident tests |
| semantic version compatibility | absent | implemented and boundary-tested |
| service/component namespace separation | unresolved | enforced by separate mappings and regression test |
| service revision / SemVer separation | unresolved | independent state and regression test |
| service history preservation | existing | retained and tested after reconciliation |
| component provenance | absent | append-only Registry component revision history |
| governance authorization | service-only | component mutation `onlyGovernance`, negative-tested |
| EOA/no-code registration | not applicable | component registration rejects no-code implementations |
| address reconciliation | out of scope | remains REG-AUDIT-4 |
| remaining REG-INV coverage | out of scope | remains REG-AUDIT-3 |
| generated address/artifact references | out of scope | remains REG-AUDIT-6 |

## Tests and verification

Focused source/test verifier:

- `scripts/verify-reg-audit-2-api-reconciliation.py`

Dedicated exact-head workflow:

- `.github/workflows/registry-reg-audit-2.yml`

Focused Foundry test:

- `contracts/test/RegistryApiReconciliation420.t.sol`

Coverage includes:

- frozen interface dispatch through an `IProtocolRegistry420` cast;
- runtime code hash;
- service/component namespace non-aliasing;
- SemVer exact/older/newer-major/minor/patch boundaries;
- unknown and deprecated resolution failure;
- no-code rejection;
- unauthorized registration/lifecycle mutation;
- component provenance across replacement;
- existing service history across reconciliation;
- real `GenesisResidentAccess420` self/dependency resolution;
- lifecycle deprecation fail-closed;
- adversarial deployed-code drift via `vm.etch`.

Retained Registry regression suites:

- `RegistryGenesis420.t.sol`
- `RegistryIdentityNames420.t.sol`

Repository-wide required gates on final exact head:

- Solidity Contracts;
- 420Registry REG-AUDIT-1;
- 420Registry REG-AUDIT-2;
- 420 Integrated Qualification;
- 420Docs Qualification;
- any additional PR workflow triggered by the final changed paths must complete successfully or be explicitly classified as non-required.

## Security and integration assessment

The reconciliation introduces no external calls in Registry mutation paths and no custody/value flow. Reentrancy/accounting/refund/replay/expiry concerns are not applicable to this Registry state mutation itself. Relevant security properties are governance-only mutation, no-code rejection, code-hash binding, namespace separation, fail-closed lifecycle/version resolution, and preservation of historical provenance.

`GenesisResidentAccess420` remains unchanged and continues to verify actual deployed code against the Registry commitment before use.

## Remaining blockers outside REG-AUDIT-2

REG-AUDIT-2 does not close:

- incomplete REG-INV-005/006/007/009/010/011/012 direct evidence — REG-AUDIT-3;
- global Genesis address reconciliation — REG-AUDIT-4;
- final artifact/runtime hash/predeploy evidence — REG-AUDIT-5;
- generated reference/catalogue cleanup — REG-AUDIT-6;
- broader derived-consumer/rebuild integration — REG-AUDIT-7;
- live testnet deployment — REG-AUDIT-8;
- final all-gates closeout — REG-AUDIT-9;
- Genesis acceptance — REG-AUDIT-10.

## Final qualification ledger

This section must be filled with the exact **final evidence-recording SHA** and successful workflow run IDs after reconciliation with current `main`. A previous SHA may not qualify a later evidence commit.

- Exact qualified SHA: **PENDING**
- Main/base SHA: **PENDING**
- Solidity Contracts: **PENDING**
- 420Registry REG-AUDIT-1: **PENDING**
- 420Registry REG-AUDIT-2: **PENDING**
- 420 Integrated Qualification: **PENDING**
- 420Docs Qualification: **PENDING**

## Next canonical roadmap step

**REG-AUDIT-3 — complete REG invariant coverage**

Add focused negative/integration tests for the currently partial guarantees:

- zero manifest/interface rejection independently;
- profile immutability;
- unauthorized extension approval;
- unauthorized deprecation;
- canonical-ID descriptor collision attempts;
- registration non-authority across at least one real resident authorization seam.

**Exit:** every REG-INV-001..012 has named executable evidence.
