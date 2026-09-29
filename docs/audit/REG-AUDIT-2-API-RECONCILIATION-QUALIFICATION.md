# REG-AUDIT-2 — implement and test the API reconciliation

**Canonical roadmap source:** `docs/audit/420REGISTRY-COMPLETE-AUDIT-20260928.md`  
**Status:** EVIDENCE RECORDED — final evidence-head requalification pending  
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

Candidate exact-head evidence recorded before the evidence-recording commit:

- Candidate qualified SHA: `e7977f52ace126a66624a01ca29c5768252cdc83`
- Main/base SHA at candidate qualification: `a29fa8bc920ae6cddd1b10be1a2a32dfe8f70bb2`
- Solidity Contracts: **PASS** — run `36516604212`
- 420Registry REG-AUDIT-1: **PASS** — run `36516604155`
- 420Registry REG-AUDIT-2: **PASS** — run `36516604147`
- 420 Integrated Qualification: **PASS** — run `36516604207`
- 420Docs Qualification: **PASS** — run `36516604362`
- 420Indexer: **PASS** — run `36516604159`

Because recording this evidence creates a new commit, the resulting evidence-recording SHA must itself pass the retained qualification suite before REG-AUDIT-2 is marked COMPLETE. Final evidence-head workflow IDs are recorded durably in PR #393 after that exact head completes, avoiding recursive mutation of the qualified commit.

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
