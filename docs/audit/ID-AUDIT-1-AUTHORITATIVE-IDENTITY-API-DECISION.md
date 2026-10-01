# ID-AUDIT-1 — authoritative Identity API and state-model decision

**Status:** IMPLEMENTED — Level 1 qualification pending exact-head CI  
**Repository:** `abvhiael/420-integrated-v0.1`  
**Working PR:** #438  
**Canonical roadmap:** `docs/audit/420IDENTITY-AUDIT-REMEDIATION-ROADMAP.md`

## Original step

ID-AUDIT-1 requires the repository to resolve the contradiction between the canonical `Identity420.sol` state model and frozen `IIdentityCredential420.sol`.

The step requires one authoritative decision, explicit subject/type lookup semantics when multiple credentials or issuers exist, an explicit TrustClass-to-IdentityAssurance policy if used, preserved credential history/lifecycle, no silent frozen-major mutation, and executable compatibility tests.

## Repository constraints

1. `IIdentityCredential420` is part of the frozen Genesis v1.0 interface layer.
2. No runtime consumer of `IIdentityCredential420` exists outside the shared interface/freeze verification layer on the audited baseline.
3. `Identity420` is already the canonical Identity state authority and frozen Genesis application owner at `0x0000000000000000000000000000000000000436`.
4. The canonical Identity model deliberately permits multiple issuers and multiple immutable credential IDs for one subject/type pair.
5. Credential validity is dynamic: revocation, subject rejection, expiry, issuer activity and subject-profile activity all matter at read time.
6. Issuer TrustClass is policy metadata and is not legal/regulatory status.

## Decision

**Choose direct implementation in `Identity420`.**

`Identity420` remains the single canonical state authority and directly implements frozen `IIdentityCredential420` v1 read semantics.

No canonical adapter is introduced. No v2 migration is required for this reconciliation. The frozen v1 interface remains unchanged.

This avoids a second authority/address, preserves the frozen Identity owner, and keeps compatibility reads subordinate to the same canonical state that already owns profile, issuer and credential lifecycle.

## Subject/type lookup semantics

`hasValidCredential(subjectId, credentialType)` means:

> true if and only if at least one canonical credential candidate for that exact subject profile and credential type is currently valid under `Identity420.credentialValid`.

There is no newest-wins, highest-trust-wins, first-issuer-wins or privileged-issuer precedence.

Multiple issuers and multiple credential IDs may coexist for one subject/type pair. An invalid credential does not mask another valid credential.

The candidate set is bounded to `MAX_CREDENTIAL_CANDIDATES = 32` to make the frozen read interface safe for on-chain consumers.

Permanently invalid candidates are removable from the bounded lookup set without deleting canonical history:
- explicitly revoked;
- subject rejected;
- expired.

Reversible invalidity does **not** remove a candidate:
- issuer deactivation;
- subject-profile deactivation.

That preserves correct reactivation behavior.

If 32 non-permanently-invalid candidates already exist for one subject/type pair, further issuance for that pair fails with `TooManyCredentialCandidates` until a slot becomes permanently invalid. The canonical credential records themselves remain immutable and queryable.

## Frozen credential view semantics

`credential(credentialId)` returns the frozen `CredentialView` derived from the canonical credential record.

Field mapping:

- `subjectId` = canonical `subjectProfileId`
- `credentialType` = canonical credential type
- `issuerId` = canonical issuer ID
- `issuedAt` = canonical issuance time
- `expiresAt` = canonical expiry
- `revoked` = explicit issuer/governance revocation only

Subject rejection is intentionally **not** rewritten as revocation. Expiry, subject rejection, inactive issuer and inactive profile are validity states, not issuer revocation.

Unknown credential IDs return the zero/default frozen view and fail `hasValidCredential`.

## TrustClass → IdentityAssurance compatibility mapping

The frozen interface requires `Types420.IdentityAssurance`, while canonical Identity state stores issuer `TrustClass`.

The compatibility mapping is deliberately conservative:

| TrustClass | IdentityAssurance |
| --- | --- |
| NONE | NONE |
| COMMUNITY | SELF_ASSERTED |
| VERIFIED | ATTESTED |
| INSTITUTIONAL | CREDENTIALED |
| SYSTEM | CREDENTIALED |

`REGULATED` is **not** inferred from any current TrustClass.

In particular, `SYSTEM` means a system-class issuer and does not prove legal or regulatory status. Returning `REGULATED` would invent a claim absent from canonical state.

Assurance is evaluated from the issuer's current TrustClass, matching the existing dynamic trust model.

## Historical identity and lifecycle preservation

This decision does not rewrite:
- profile IDs;
- issuer IDs;
- credential IDs;
- credential claim hashes;
- issuance timestamps;
- revocation timestamps;
- subject rejection history;
- existing trust-class semantics.

Candidate indexing is a compatibility read structure, not a second credential authority.

Removing a permanently invalid credential from the bounded subject/type candidate set does not delete or mutate the canonical credential record.

## Security properties

- No adapter authority split.
- No second Identity canonical address.
- No mutation of the frozen v1 interface.
- No arbitrary credential precedence.
- Subject/type reads are gas-bounded.
- Dynamic issuer/profile validity is rechecked at read time.
- Reversible deactivation cannot destroy credential eligibility history.
- No TrustClass is promoted into unsupported regulatory status.
- Existing governance and issuer-controller mutation boundaries remain unchanged.

## Executable qualification

`contracts/test/Identity420Compatibility.t.sol` covers:

- direct frozen-interface casting;
- exact credential view projection;
- unknown credential zero view;
- conservative assurance mapping;
- SYSTEM not mapping to REGULATED;
- multiple credentials/issuers for one subject/type;
- any-valid semantics;
- issuer deactivate/reactivate behavior;
- profile deactivate/reactivate behavior;
- exact expiry boundary;
- subject rejection distinct from revocation;
- bounded candidate overflow;
- slot reuse after revocation;
- pruning expired candidates before the capacity check.

Existing `Identity420Audit.t.sol` remains the broader negative/adversarial suite and is not replaced by this compatibility suite.

## Rejected alternatives

### Canonical adapter

Rejected because it would introduce a second contract at the canonical Identity interface boundary, create another address/ownership/deployment question, and still require a source of deterministic subject/type lookup. It provides no authority or security advantage over direct implementation by the existing canonical state owner.

### Versioned interface migration

Rejected for ID-AUDIT-1 because frozen v1 can be implemented without changing its ABI or semantic intent. A new major interface would require migration/review and would not remove the need to support the already-frozen Genesis contract.

## Exit criteria

ID-AUDIT-1 is COMPLETE only when:

1. this decision is committed;
2. `Identity420` directly implements the frozen interface;
3. frozen `IIdentityCredential420.sol` remains unchanged;
4. subject/type lookup semantics are deterministic and bounded;
5. multiple issuers/credentials cannot create arbitrary precedence;
6. TrustClass-to-IdentityAssurance mapping is explicit and conservative;
7. credential history/lifecycle remains canonical and intact;
8. executable compatibility tests pass;
9. directly applicable Solidity/interface CI passes on the exact implementation SHA;
10. durable qualification evidence records the implementation SHA and CI result.

Level 2 app integration qualification is not required by this decision step and remains deferred to a meaningful Identity integration milestone. Level 3 global reconciliation remains deferred to ID-AUDIT-10.
