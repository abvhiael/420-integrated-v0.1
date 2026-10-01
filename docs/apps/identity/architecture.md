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
