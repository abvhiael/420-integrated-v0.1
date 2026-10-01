# Identity contracts

`Identity420` is the canonical profile/issuer/credential contract. Important integration concepts are profile controller/activity, issuer controller/trust class and credential lifecycle.

## Frozen shared read interface

The contract directly implements `IIdentityCredential420`.

Consumers may use:

- `credential(credentialId)` for the frozen compatibility view of one immutable credential;
- `hasValidCredential(subjectId, credentialType)` for bounded "any currently valid credential" lookup.

Do not infer credential selection precedence. Multiple issuers and credential IDs may coexist for one subject/type pair.

`CredentialView.revoked` means explicit issuer/governance revocation. A false value does not imply the credential is currently valid; expiry, subject rejection, issuer activity and profile activity must still be respected through canonical validity reads.

The compatibility assurance mapping is conservative and never reports `REGULATED` from the current TrustClass model.

Generated ABI/NatSpec belongs in DOC-10; this manual documents safety semantics and composition.
