# 420Registry complete repository-grounded audit — 2026-09-28

## Audit basis

Repository: `abvhiael/420-integrated-v0.1`  
Audit baseline: `main` at `ac1b9c5a5d7e1b031ea63c210b8c38ac3abee6df`  
Historical Registry implementation PR: #31 (`feat(registry): harden 420Registry for Genesis`)  
PR #31 head: `94255bebd8b639c4cb4edaf8caa8a976e170bf85`  
PR #31 merge commit: `a54ebdb4b6e80352cf901d146d5dd7d198a0d783`

This audit treats current repository evidence as authoritative. Historical green CI is retained as provenance only; it is not exact-head qualification evidence for the current baseline.

## Final determination

420Registry is **not Genesis-ready and not production-ready** on the audited baseline.

The core `ProtocolRegistry` implementation is materially present and historically passed the project Solidity/Genesis/hardening workflows at PR #31 head. Current repository evidence, however, contains three release-blocking consistency failures:

1. the frozen Genesis interface `IProtocolRegistry420` is not implemented by `ProtocolRegistry` and exposes a materially different ABI/state model;
2. canonical deployment/artifact evidence is incomplete, while examples and generated references still contain non-canonical/stale Registry address/interface hints;
3. the repository explicitly records a global Genesis address rebase/reconciliation blocker that includes ProtocolRegistry.

Because Genesis-resident contracts call `IProtocolRegistry420(registry).component(...)` and `supportsVersion(...)`, this is not a documentation-only mismatch. A deployed `ProtocolRegistry` with its current ABI cannot satisfy those calls unless a canonical adapter or compatible implementation exists. No such adapter was found in current `main`.

The smallest defensible action is therefore to fail closed and require architectural reconciliation before changing the frozen v1 interface or the Registry implementation.

## Canonical definition discovered

### Purpose

`contracts/config/420registry-genesis.json` defines 420Registry as the canonical discovery, version-history and compatibility-commitment registry for Genesis services.

### Canonical implementation

- `contracts/src/apps/ProtocolRegistry.sol`
- `contracts/src/libraries/ServiceIds420.sol`
- governance boundary inherited from `contracts/src/system/SystemAccess.sol`

### Canonical authority and trust model

- publisher: GovernanceTimelock
- default-deny for non-canonical extension IDs
- registration does not grant custody, execution, governance, bridge, validator or token-transfer authority
- derived Indexer/Explorer/Search/UI projections remain non-canonical

### Canonical registration model

`ProtocolRegistry` stores:

- current `Service` record
- historical `Service` by version
- historical `RegistrationProfile` by version
- extension service-ID approvals and descriptor commitments

Genesis-grade publication:

- rejects implementation addresses with no runtime code
- derives runtime code hash from deployed code
- commits metadata hash, manifest hash, dependency root, interface hash and component type
- enforces strictly sequential per-service versions

### Canonical consumers

Repository architecture makes Registry an authoritative dependency for Genesis-resident protocols and a canonical source for Developer Hub, Wallet/application discovery, Indexer decoding, Explorer, Search, Verify and AppStore.

## Repository state

| Item | Audited state |
|---|---|
| Repository | `abvhiael/420-integrated-v0.1` |
| Baseline branch | `main` |
| Baseline SHA | `ac1b9c5a5d7e1b031ea63c210b8c38ac3abee6df` |
| Registry feature PR | #31, merged |
| Open Registry-specific remediation PR | none found |
| Historical PR #31 exact-head CI | PASS at `94255beb...` |
| Current baseline exact-head Registry CI evidence | not found |
| Working audit branch | `audit/420registry-complete-20260928` |

## File inventory

| Component | Evidence | Status | Notes |
|---|---|---|---|
| Registry implementation | `contracts/src/apps/ProtocolRegistry.sol` | COMPLETE | Core current/history/profile implementation present |
| Genesis service IDs | `contracts/src/libraries/ServiceIds420.sol` | COMPLETE | Canonical Genesis catalogue present |
| Governance access base | `contracts/src/system/SystemAccess.sol` | COMPLETE | Immutable timelock authority; no hidden owner |
| Registry Genesis profile | `contracts/config/420registry-genesis.json` | COMPLETE | 12 explicit REG invariants |
| Focused Registry tests | `contracts/test/RegistryGenesis420.t.sol` | PARTIAL | Covers core publication, EOA rejection, governance, version history, deprecation and extension approval |
| Cross Registry/Identity/Names tests | `contracts/test/RegistryIdentityNames420.t.sol` | PARTIAL | Covers legacy publication/version behavior and adjacent integrations |
| Frozen shared Registry interface | `contracts/src/interfaces/genesis/IProtocolRegistry420.sol` | BROKEN | ABI/state model does not match ProtocolRegistry |
| Shared Genesis resident resolver | `contracts/src/system/GenesisResidentAccess420.sol` | BROKEN | Calls frozen interface methods absent from ProtocolRegistry |
| Registry architecture docs | `docs/apps/registry/architecture.md` | COMPLETE | Correct high-level authority boundary |
| Registry user guide | `docs/apps/registry/user-guide.md` | COMPLETE | Read/deprecation semantics documented |
| Registry developer docs | `docs/apps/registry/developer/*` and `docs/developers/registry-and-publishing.md` | PARTIAL | Useful integration guidance but frozen-interface conflict not resolved |
| Cross-protocol architecture | `docs/architecture/protocols/registry-names-identity-420is.md` | COMPLETE | Correct canonical/non-authority separation |
| Frozen address map | `config/system-addresses.json`, `contracts/config/system-addresses.json` | COMPLETE but BLOCKED globally | Both assign ProtocolRegistry to `0x...0434` |
| Deployment manifest | `contracts/config/deployment-manifest.json` | PARTIAL | Declares predeploy identity, not release artifact proof |
| Predeploy plan | `contracts/config/predeploy/predeploy-plan.json` | PARTIAL | Registry artifact is `SOURCE_READY`; release artifact/code hash still pending |
| Compiled Registry artifact | expected `contracts/artifacts/ProtocolRegistry.json` or declared Foundry output | MISSING | No checked-in canonical artifact found |
| Generated deployment reference | `docs/reference/generated/deployments.md` | PARTIAL | Correctly refuses canonical deployment publication |
| Developer Hub catalogue example | `developer-hub/catalogue/local.example.json` | STALE | Uses `0x...0420` as ProtocolRegistry example |
| Developer Hub local manifest example | `developer-hub/manifests/local.example.json` | STALE | Uses `0x...0420` Registry hint |
| Generated contracts reference | `docs/reference/generated/contracts.md` | STALE | Records local example `0x...0420` and missing interface/artifact paths |
| Registry-specific final qualification/closeout record | none found | MISSING | Historical PR evidence is not a current exact-head closeout |

## Smart-contract audit

### ProtocolRegistry

Verified behavior:

- immutable GovernanceTimelock authorization through `SystemAccess`
- canonical Genesis service-ID allowlist via `ServiceIds420`
- explicit governance approval for extension IDs
- sequential version enforcement
- current plus historical records
- immutable registration profile per published version
- fail-closed active resolution
- current-version deprecation preserves history
- strict path checks runtime code existence
- strict path derives runtime `extcodehash`
- strict path rejects unset component type
- strict path rejects zero manifest/interface commitments
- publication itself grants no downstream authority

Risks / gaps:

1. **Frozen interface incompatibility — unresolved vulnerability/integration blocker.**  
   `IProtocolRegistry420` requires:
   - `component(bytes32)`
   - `resolve(bytes32)`
   - `runtimeCodeHash(bytes32)`
   - `supportsVersion(bytes32, Types420.Version)`
   - `ComponentRegistered` and `ComponentLifecycleChanged`

   `ProtocolRegistry` instead provides:
   - `getService(bytes32)`
   - `getServiceVersion(bytes32,uint32)`
   - `getRegistrationProfile(bytes32,uint32)`
   - `currentVersion(bytes32)`
   - `isActive(bytes32)`
   - `resolveActive(bytes32)`
   - different publication/deprecation events

   No canonical adapter implementing `IProtocolRegistry420` over `ProtocolRegistry` was found.

2. **Legacy publication APIs — accepted only if explicitly bounded.**  
   `publishService` and `setService` are governance-only but do not enforce deployed code or registration-profile commitments. PR #31 explicitly retained them for backwards compatibility. They must not be used as the Genesis-grade publication path. A closeout should either prove every Genesis publication uses `publishRegisteredService` or formally deprecate/contain the legacy paths.

3. **No upgrade mechanism in ProtocolRegistry itself.**  
   This is not automatically a defect: the current implementation is non-proxy and governance controls publications, not self-upgrade. The deployment/migration strategy must therefore define how Registry implementation evolution occurs without corrupting canonical history.

4. **Timestamp semantics.**  
   `activatedAt` uses `block.timestamp`. This is acceptable for discovery metadata if not interpreted as high-precision wall-clock truth; no evidence was found that security-critical authorization depends on it.

5. **No funds/token custody.**  
   Reentrancy, approval and refund risks are not applicable to ProtocolRegistry's present state model.

## Canonical invariant matrix

| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| REG-INV-001 canonical ID or approved extension | 420registry-genesis.json | implemented | covered | documented | COMPLETE | none |
| REG-INV-002 sequential versions/history | same | implemented | covered | documented | COMPLETE | add exact-head retained proof |
| REG-INV-003 strict publication rejects no-code implementation | same | implemented | covered | documented | COMPLETE | none |
| REG-INV-004 runtime hash derived from deployed code | same | implemented | covered | documented | COMPLETE | none |
| REG-INV-005 nonzero manifest/interface | same | implemented | named independent zero-manifest and zero-interface negatives added in REG-AUDIT-3 | documented | COMPLETE | exact-head retained proof |
| REG-INV-006 immutable profile commitments per version | same | implemented by write-once sequential version model | named replacement-at-same-version immutability regression added in REG-AUDIT-3 | documented | COMPLETE | exact-head retained proof |
| REG-INV-007 GovernanceTimelock only | same | implemented | named unauthorized approval, publication and deprecation negatives added in REG-AUDIT-3 | documented | COMPLETE | exact-head retained proof |
| REG-INV-008 deprecation fails closed while preserving history | same | implemented | covered | documented | COMPLETE | none |
| REG-INV-009 registration grants no ambient authority | same | implementation has no authority-grant path | real MerchantRegistry420 governance seam negative added in REG-AUDIT-3 | documented | COMPLETE | exact-head retained proof |
| REG-INV-010 projections reconstructable/non-canonical | same | Indexer/Explorer docs/code model this boundary | direct Registry event + canonical-read reconstruction evidence added in REG-AUDIT-3 | documented | COMPLETE | exact-head retained proof; broader reorg/rebuild remains REG-AUDIT-7 |
| REG-INV-011 Registry metadata cannot overwrite domain canonical state | same | Registry stores only Registry fields | direct Identity420 domain-state isolation regression added in REG-AUDIT-3 | documented | COMPLETE | exact-head retained proof |
| REG-INV-012 extension approval cannot alter canonical Genesis ID identity | same | canonical IDs are pure library constants and canonical IDs are rejected by extension approval | named canonical-ID descriptor collision negative added in REG-AUDIT-3 | documented | COMPLETE | exact-head retained proof |
| Frozen interface compatibility | interface-layer freeze | incompatible | no implementation compatibility test found | freeze docs exist | BROKEN | choose/implement canonical adapter or compatible Registry implementation without mutating v1 semantics |
| Canonical Registry address | system-addresses v4 | `0x...0434` in frozen map | repository consistency evidence exists | conflicting examples exist | BLOCKED | resolve namespace-wide Genesis address rebase before final freeze |
| Compiled runtime artifact/code hash | predeploy plan | source ready only | historical compile CI exists | release proof missing | MISSING | generate/pin exact artifact and runtime hash from final candidate |
| Genesis storage initialization | predeploy plan | constructor strategy requires genesis storage materialization | exact Registry storage proof not identified | global tooling exists | PARTIAL | verify Registry constructor/immutable handling in predeploy generation |
| Canonical deployment evidence | deployment/reference docs | no canonical live deployment published | none current | explicitly withheld | BLOCKED | deploy production-equivalent testnet candidate and record receipt/code hash |
| Current exact-head qualification | audit requirement | historical PR #31 only | PR #31 was green | no current closeout | MISSING | rerun retained suites on final reconciled SHA |
| Registry-specific closeout | audit requirement | absent | n/a | absent | MISSING | commit exact-head audit/qualification ledger |

## Integration audit

### Frozen Genesis resident interface — BROKEN

`GenesisResidentAccess420` explicitly states that dependency addresses are resolved through the frozen ProtocolRegistry and code-hash checked. It directly casts the configured Registry address to `IProtocolRegistry420`.

Because the implementation ABI does not satisfy that interface, Genesis residents using this guard cannot be considered integrated with the current `ProtocolRegistry` implementation.

This must be resolved before 420Registry can qualify for Genesis.

### Indexer / Explorer / Search

Repository evidence correctly treats these as derived projections. ProtocolRegistry events are referenced by Indexer decoder code and Explorer/Search consumers. Their existence does not repair the frozen on-chain interface mismatch and does not establish a live Registry deployment.

### Developer Hub / SDK

Developer Hub release planning targets `publishRegisteredService`, which aligns with the strict Registry path. However, local example catalogues contain stale/example Registry address/interface declarations. They are currently prevented from becoming canonical by generated-doc fail-closed rules, but should be regenerated only after address/interface reconciliation.

### Wallet / Pay / Swap / Bridge / other Genesis residents

The shared `GenesisResidentAccess420` dependency makes Registry interface compatibility a transitive blocker for residents that rely on it.

## Address and deployment audit

Current frozen system maps assign:

`ProtocolRegistry = 0x0000000000000000000000000000000000000434`

REG-AUDIT-4 adopts the repository's later mainline authority decision to preserve the frozen Step 6.2 predeploy map and registry-resolve non-predeploy services. The complete active namespace is recorded in:

`contracts/config/genesis-address-namespace.json`

The historical Wallet/W14.7 records that proposed moving ProtocolRegistry to `0x0448` are preserved as explicit **SUPERSEDED** evidence and are not active address authority. Both system mirrors, the predeploy plan, deployment manifest, canonical discovery map, Wallet resident configuration and Developer Hub examples now agree on Registry `0x0434`.

This address reconciliation does not claim deployed runtime bytecode, storage initialization or live-chain verification; those remain later roadmap gates.

## Test audit

Historical exact PR #31 head `94255bebd8b639c4cb4edaf8caa8a976e170bf85` has successful workflow runs for:

- 420 Genesis Contract Verification
- 420 Genesis Contract Hardening
- 420 Integrated Qualification
- Solidity Contracts

Those results validate that historical Registry feature head only.

No current exact-head workflow evidence was found for baseline `ac1b9c5a5d7e1b031ea63c210b8c38ac3abee6df`.

Current focused Registry test coverage is useful but does not independently prove all 12 `REG-INV` requirements, frozen interface compatibility, final predeploy artifact correctness or production-equivalent deployment.

## Security classification

| Finding | Classification |
|---|---|
| Governance-only mutation path | verified safe behavior within current contract scope |
| Sequential history and fail-closed active resolution | verified safe behavior |
| Strict runtime code-hash derivation | verified safe behavior |
| Registration grants no direct custody/execution authority | verified safe behavior |
| Legacy publication path lacks strict code/profile checks | accepted design risk only if Genesis flow is proven to exclude it |
| Frozen `IProtocolRegistry420` / `ProtocolRegistry` mismatch | unresolved vulnerability / release blocker |
| Global address map conflict/rebase | unresolved integration/deployment blocker |
| No canonical final artifact/runtime hash | unresolved deployment blocker |
| No live production-equivalent deployment evidence | unresolved deployment blocker |
| Missing exact-current-head Registry closeout | unresolved qualification blocker |

## Documentation audit

Present:

- app architecture
- user guide
- developer integration guidance
- developer contract semantics
- cross-protocol Registry/Names/Identity/420-IS architecture
- general dependency map
- generated contract/deployment references

Incomplete or stale:

- no dedicated Registry remediation/qualification closeout
- generated reference still exposes stale local-example address/interface metadata
- docs do not clearly surface the frozen-interface incompatibility as a Registry release blocker
- deployment references correctly fail closed, but no canonical live deployment exists

## Readiness state

- CODE COMPLETE: **NO** — frozen interface compatibility is unresolved.
- BUILD COMPLETE: **NO** — historical build success exists, but no exact-final-head Registry build evidence or pinned final artifact is available.
- CONTRACT COMPLETE: **NO** — core contract exists, but it does not satisfy the frozen Genesis Registry interface consumed by residents.
- TEST COMPLETE: **NO** — several REG invariants and the interface seam lack direct qualification; no final exact-head run exists.
- DOCUMENTATION COMPLETE: **NO** — closeout/remediation record is missing and generated examples remain stale.
- INTEGRATION COMPLETE: **NO** — frozen resident Registry interface mismatch blocks canonical integration.
- SECURITY QUALIFIED: **NO** — unresolved interface/address/deployment blockers remain.
- TESTNET READY: **NO** — no canonical production-equivalent Registry deployment/code-hash evidence.
- GENESIS READY: **NO** — interface and address namespace reconciliation are unresolved.
- PRODUCTION READY: **NO** — testnet/Genesis prerequisites are not met.

## Dependency-ordered remediation roadmap

### REG-AUDIT-1 — freeze the authoritative Registry API decision

Resolve the contradiction between:

- `ProtocolRegistry.sol`
- frozen `IProtocolRegistry420.sol`
- `GenesisResidentAccess420.sol`
- generated ABI/reference expectations

Do not edit the frozen v1 interface casually. Decide whether the canonical answer is:

A. make ProtocolRegistry implement frozen v1 semantics while preserving existing service/history behavior;  
B. introduce a canonical adapter at the Registry authority address; or  
C. explicitly version/migrate the frozen interface under the repository's major-version governance rules.

Exit: one authoritative ABI/state model with no ambiguous adapter ownership.

### REG-AUDIT-2 — implement and test the API reconciliation

**Repository status:** COMPLETE via PR #393; final evidence head `a63023f47c992661b22b344e051455a330722e97`, merged as `6c0a70ae020bfa911c57f6148fd585c9036c5f78`.

After REG-AUDIT-1:

- implement the chosen compatibility layer;
- add direct compile-time/runtime interface tests;
- verify code-hash/lifecycle/version mapping;
- prove inactive/deprecated dependencies fail closed;
- prove historical provenance survives the reconciliation.

Exit: all Genesis residents can resolve Registry dependencies through the frozen/approved interface.

### REG-AUDIT-3 — complete REG invariant coverage

**Repository status:** COMPLETE on PR #399. Final reconciled qualified head: `942d2ac7f2cc3f37262147b105812db02965f296`; retained REG-AUDIT-1/2/3, Solidity Contracts, Integrated, Docs and Indexer gates all passed.

Add focused negative/integration tests for the currently partial guarantees:

- zero manifest/interface rejection independently;
- profile immutability;
- unauthorized extension approval;
- unauthorized deprecation;
- canonical-ID descriptor collision attempts;
- registration non-authority across at least one real resident authorization seam.

Exit: every REG-INV-001..012 has named executable evidence.

### REG-AUDIT-4 — reconcile the Genesis address namespace

**Repository status:** COMPLETE. Canonical Registry address is `0x0000000000000000000000000000000000000434`; historical `0x0448` relocation proposals are superseded. Reconciled exact head `9baaa5c6e89cf08bf152d36c83477890a41ae727`, based on `main` `76e7f5732247efc091c8842efaecce2b11c6fc61`, passed REG-AUDIT-4, Genesis Address Authority, all Solidity PR shards, Integrated, Docs, Developer Hub, Indexer, Wallet Web, and retained Registry gates under PR #402.

Use the existing global address-reconciliation work; do not solve Registry in isolation.

- approve one collision-free namespace-wide map;
- update mirrors, predeploy plan, deployment manifest, resident configuration and examples atomically;
- preserve explicit supersession history;
- run collision and frozen-range checks.

Exit: one canonical Registry address, with no contradictory authoritative assignment.

### REG-AUDIT-5 — generate final Registry artifact and predeploy state

From the exact candidate:

- compile Solidity 0.8.24/Cancun with pinned settings;
- retain `ProtocolRegistry` runtime artifact;
- record runtime code hash;
- materialize immutable/constructor effects correctly for direct Genesis predeploy;
- record storage/root evidence where applicable.

Exit: reproducible Registry predeploy artifact tied to exact source SHA.

### REG-AUDIT-6 — repair generated catalogue/reference metadata

After REG-AUDIT-4/5 only:

- regenerate Developer Hub catalogue/manifests;
- regenerate generated contracts/deployment references;
- remove missing-interface references;
- ensure examples are visibly non-canonical unless backed by approved deployment evidence.

Exit: no stale Registry address/interface/artifact metadata remains.

### REG-AUDIT-7 — integration/rebuild qualification

Qualify:

- Registry -> GenesisResidentAccess resolution;
- Registry -> Indexer event ingestion and historical reconstruction;
- bounded reorg/replay behavior;
- Explorer/Search/AppStore/Verify projections remain non-canonical;
- Developer Hub publication uses strict registered-service publication;
- direct chain reads disagreeing with projections fail closed appropriately.

Exit: integration evidence tied to exact candidate SHA.

### REG-AUDIT-8 — production-equivalent testnet deployment

Deploy the reconciled Registry candidate and record:

- chain ID/environment
- exact source/release SHA
- final Registry address
- deployment/predeploy proof
- runtime code hash
- initialized governance authority
- smoke reads and strict publication
- deprecation/history behavior
- recovery/restart observations for derived consumers

Exit: testnet evidence is immutable and reproducible.

### REG-AUDIT-9 — exact-head requalification and closeout

On the final evidence-recording SHA rerun:

- Solidity build
- focused Registry tests
- full contracts suite
- fuzz/invariant/hardening gates applicable to Registry
- Genesis contract verification
- 420 Integrated qualification
- interface/freeze verifiers
- integration/derived-consumer tests
- documentation/reference generators and consistency checks

Record workflow run IDs and artifact digests against that exact SHA.

Exit: no later commit invalidates the evidence.

### REG-AUDIT-10 — Genesis acceptance

Only after REG-AUDIT-1 through 9:

- close every blocker;
- publish final requirement matrix;
- publish exact deployment identity and hashes;
- record explicit Registry Genesis go/no-go.

Until then, status remains **NO-GO**.
