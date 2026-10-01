# 420 Identity architecture

`Identity420` canonically stores profile control/activity, issuer configuration and credential lifecycle. The application may use Names, Registry, Indexer and Search for presentation, but those services do not replace canonical Identity state.

Profile control transfer is two-step. Issuers are governance-curated and assigned trust classes. Credential validity is computed from current lifecycle and issuer/profile state.

## Frozen Genesis credential compatibility

`Identity420` directly implements frozen `IIdentityCredential420` v1. There is no canonical adapter.

`hasValidCredential(subjectId, credentialType)` means **any currently valid canonical credential** for the exact subject/type pair. Multiple issuers and multiple credential IDs may coexist; no newest/highest-trust/issuer precedence is invented.

The compatibility candidate set is bounded to 32 live candidates per subject/type so on-chain reads remain bounded. Revoked, subject-rejected and expired credentials may be removed from this lookup set without deleting canonical credential history. Reversible issuer/profile deactivation remains dynamically rechecked and does not remove the candidate.

Frozen `CredentialView.revoked` represents explicit issuer/governance revocation only. Expiry, subject rejection and inactive issuer/profile state remain separate validity conditions.

The conservative compatibility mapping is:

- `NONE -> NONE`
- `COMMUNITY -> SELF_ASSERTED`
- `VERIFIED -> ATTESTED`
- `INSTITUTIONAL -> CREDENTIALED`
- `SYSTEM -> CREDENTIALED`

No current TrustClass maps to `REGULATED`; system-class issuance is not legal/regulatory status.

The authoritative decision is recorded in `docs/audit/ID-AUDIT-1-AUTHORITATIVE-IDENTITY-API-DECISION.md`.

Identity remains optional and domain-bounded.

## Shared dependency boundary

The canonical required runtime/authority dependency set for `Identity420` is deliberately narrow.

- **GovernanceAuthority — REQUIRED.** Issuer configuration remains bound to the immutable GovernanceTimelock through `SystemAccess.onlyGovernance`.
- **ProtocolRegistry — OPTIONAL.** Registry publication, discovery, runtime-code provenance and later version history are external integration/deployment concerns; Registry is not consulted to determine canonical Identity profile, issuer or credential state.
- **Migration — OPTIONAL.** A future version may compose with the shared migration/provenance layer, but the current contract has no proxy or migration execution path.
- **MetadataCommitment — OPTIONAL.** `metadataHash` and `claimHash` are canonical opaque commitments. External schema/reference validation may enrich them without becoming Identity authority.
- **PauseRegistry, CapabilityRegistry, SystemSafety, GenesisInitialization, SignedEnvelope, ReplayProtection and ChainContext — NOT APPLICABLE to the current Identity v3 runtime.** The contract defines no pause/action-class dependency, no capability-based mutation authority, no signed-envelope/meta-transaction path, and no cross-chain message acceptance. Genesis runtime/storage materialization remains mandatory in the predeploy pipeline even though `IGenesisInitializable420` is not a runtime dependency.

This classification does not remove the frozen shared interfaces from the Genesis interface layer. It only prevents the Identity dependency matrix from claiming interfaces that the current canonical contract neither consumes nor semantically requires.

Identity credentials never imply `CapabilityRegistry` permission. Profile, credential or trust metadata also never becomes a substitute for GovernanceTimelock authority, Wallet ownership, or application-specific authorization.

The machine-readable authority is `contracts/config/interfaces/identity-dependency-reconciliation.json`; ID-AUDIT-3 qualification verifies that it agrees with `contracts/config/interfaces/dependency-matrix.json` and the actual Solidity source.

