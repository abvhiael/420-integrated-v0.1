# ID-AUDIT-3 — dependency/interface reconciliation

**Status:** IMPLEMENTED — Level 1 qualification pending exact-head CI  
**Repository:** `abvhiael/420-integrated-v0.1`  
**Working PR:** #438  
**Canonical roadmap:** `docs/audit/420IDENTITY-AUDIT-REMEDIATION-ROADMAP.md`

## Original step

ID-AUDIT-3 requires reconciliation of
`contracts/config/interfaces/dependency-matrix.json` against the adopted
Identity architecture.

Each previously claimed 420Identity dependency must be classified
`REQUIRED`, `OPTIONAL`, or `NOT_APPLICABLE` and then either implemented,
bound through a canonical adapter, or removed from the required dependency
matrix through the correct configuration process.

The roadmap specifically calls out PauseRegistry, CapabilityRegistry,
SystemSafety, GenesisInitialization, Migration, SignedEnvelope,
ReplayProtection, ChainContext and MetadataCommitment.

**Exit criterion:** no declared mandatory Identity dependency is absent or fictitious.

## Repository facts

The canonical runtime is `contracts/src/apps/Identity420.sol`.

It:

- inherits `SystemAccess`;
- binds one immutable `governanceTimelock`;
- uses `onlyGovernance` for issuer mutation;
- directly implements frozen `IIdentityCredential420`;
- performs profile/controller/issuer/credential lifecycle internally;
- performs no arbitrary external calls;
- performs no custody, settlement or token movement;
- accepts no signed off-chain envelopes or meta-transactions;
- resolves no shared dependency through `ProtocolRegistry`;
- does not consume PauseRegistry, CapabilityRegistry, SystemSafety,
  GenesisInitialization, Migration, ReplayProtection, ChainContext or
  MetadataCommitment at runtime.

The frozen v1 interface catalogue remains unchanged. The dependency matrix is
a separate configuration file and is not hash-pinned by
`interface-layer-v1-freeze.json`.

Current `main` advanced from the audit merge-base only through unrelated
Compute Market files. No Identity/shared-interface/dependency-matrix file was
changed by that divergence.

## Authoritative classification

Machine-readable authority:
`contracts/config/interfaces/identity-dependency-reconciliation.json`.

| Dependency | Classification | Runtime disposition |
| --- | --- | --- |
| ProtocolRegistry | OPTIONAL | external discovery/deployment/provenance; removed from required row |
| GovernanceAuthority | REQUIRED | retained; direct immutable GovernanceTimelock binding through `SystemAccess` |
| PauseRegistry | NOT_APPLICABLE | no canonical Identity pause/action-class semantics |
| CapabilityRegistry | NOT_APPLICABLE | credentials do not grant ambient capabilities |
| SystemSafety | NOT_APPLICABLE | no current Identity action-class/custody/settlement safety dependency |
| GenesisInitialization | NOT_APPLICABLE | runtime interface not used; deterministic predeploy materialization remains ID-AUDIT-4/5 work |
| Migration | OPTIONAL | future version/provenance composition only |
| SignedEnvelope | NOT_APPLICABLE | direct `msg.sender` mutation model |
| ReplayProtection | NOT_APPLICABLE | no signed-envelope/message replay surface |
| ChainContext | NOT_APPLICABLE | no cross-chain signed-domain/message acceptance path |
| MetadataCommitment | OPTIONAL | canonical state stores opaque hashes; external schema/reference validation may enrich only |

Therefore the required `420Identity` row in
`contracts/config/interfaces/dependency-matrix.json` is now exactly:

`["GovernanceAuthority"]`

## Authority and security invariants

1. GovernanceTimelock remains the sole issuer-configuration governance
   authority.
2. No profile, credential or trust class implicitly grants
   CapabilityRegistry authority.
3. Optional Registry, migration and metadata services cannot replace canonical
   Identity state.
4. Profile/issuer active flags remain Identity lifecycle state and are not
   silently reinterpreted as PauseRegistry/SystemSafety state.
5. Direct-call Identity mutation paths do not claim SignedEnvelope or shared
   ReplayProtection guarantees.
6. Removing GenesisInitialization from the runtime dependency row does not
   waive deterministic Genesis construction: artifact/runtime/storage
   materialization remains mandatory under ID-AUDIT-4 and ID-AUDIT-5.
7. Frozen shared interfaces remain available for other components; this step
   narrows only the Identity dependency claim.

## Files changed

- `contracts/config/interfaces/dependency-matrix.json`
- `contracts/config/interfaces/identity-dependency-reconciliation.json`
- `scripts/verify-id-audit-3-dependencies.py`
- `.github/workflows/identity-id-audit-3.yml`
- `docs/apps/identity/architecture.md`
- this evidence record

No production Identity Solidity behavior is changed by ID-AUDIT-3.

## Level 1 qualification

Required exact-head checks:

1. `scripts/verify-id-audit-3-dependencies.py`;
2. retained frozen Genesis interface-layer verifier;
3. Identity contract compilation;
4. `Identity420Audit.t.sol`;
5. `Identity420Compatibility.t.sol`;
6. `RegistryIdentityNames420.t.sol`;
7. active Solidity Contracts CI triggered by the changed contracts configuration;
8. documentation qualification when triggered by the evidence/docs changes.

The focused workflow is `420Identity ID-AUDIT-3`.

## Level 2 disposition

No Level 2 milestone is required. This step removes stale dependency claims and
introduces no new runtime authority, lifecycle service, adapter or shared
component. The retained cross-Registry/Identity/Names regression remains part
of Level 1 because it directly validates the dependency/authority boundary.

## Level 3 disposition

Complete repository/Genesis/main reconciliation remains intentionally deferred
to **ID-AUDIT-10 — phase closeout, reconciliation and retained evidence**.

## Exact-head qualification evidence

Pending.

## Completion state

**PENDING LEVEL 1 EXACT-HEAD QUALIFICATION**

Next canonical step after successful closeout:

**ID-AUDIT-4 — generated ABI, artifact and reference metadata**
