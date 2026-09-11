# 420 Developer Hub — DEVHUB-16 Off-chain Application Identity & API Credentials

## Status

DEVHUB-16 establishes the identity and credential model used by off-chain Developer Hub services. These identities and API credentials authenticate requests to service APIs only. They are not 420 Identity credentials, wallet capabilities, Registry registrations, governance roles, protocol permissions, or canonical chain state.

The current implementation now includes strict application identity and issuance planning plus bounded credential rotation, revocation, expiry evaluation, redacted lifecycle views, and a dedicated `420-auth` CLI surface.

## Objects

### Service application identity

A service application identity is public metadata describing an application that may call qualified off-chain services. It binds:

- `applicationId`;
- selected `chainId` and environment;
- display name and owner reference;
- allowed API audiences;
- maximum allowed off-chain scopes;
- an optional registration reference used only for correlation.

A registration reference may point toward an application known elsewhere in the ecosystem, but the reference does not prove registration or inherit any Registry authority.

### API credential issuance plan

A credential request binds:

- stable `credentialId`;
- one allowed audience;
- a subset of the application's allowed scopes;
- issue and expiry timestamps;
- a lowercase SHA-256 digest of the secret.

Developer Hub validates and plans issuance. The raw API secret is generated, delivered, stored, rotated, and revoked by an off-chain credential service. Git-tracked manifests and Developer Hub control views never contain the bearer secret.

### Credential lifecycle record

A redacted lifecycle record binds the application, credential identity, chain/environment, audience/scopes, issue/expiry timestamps, secret digest, revision, optional predecessor link, and bounded lifecycle state.

The executable states are `ACTIVE`, `ROTATED`, and `REVOKED`. `EXPIRED` is derived from an active record plus evaluation time rather than mutating stored authority. Terminal credentials remain terminal.

## Secret boundary

`secretSha256` is metadata for identifying/confirming a credential without persisting the secret. It is not itself an authentication secret and cannot be used as a bearer token.

DEVHUB-16 deliberately rejects arbitrary extra fields so `apiKey`, `secret`, token material, private keys, mnemonics, or similar values cannot silently enter the tracked descriptor format.

Lifecycle views expose only `secretDigestPresent: true`; they do not return the digest value or bearer material. Future service implementations may use a dedicated secret manager, HSM, KMS, encrypted credential database, or equivalent backend. That storage mechanism remains outside canonical protocol state.

## Authorization semantics

An API key may authorize only the off-chain audience and scopes explicitly present in its credential record. Scope evaluation is fail-closed and cannot broaden the application's declared maximum scope set.

Examples include read access to a hosted Indexer API or submission to an off-chain verification service. Even a service-admin API scope would remain authority over that service only; it cannot create wallet signing rights, Registry legitimacy, governance votes, protocol roles, or an on-chain Identity credential.

## Chain and environment binding

Application descriptors bind to a selected network environment and decimal chain ID so a credential intended for a local/test service cannot be silently reused as production identity metadata. This is correlation and deployment hygiene, not consensus authorization.

## Rotation

Rotation is a replacement operation, not mutation of the bearer secret in place. A valid rotation requires:

- an `ACTIVE` current credential;
- a different replacement credential ID;
- a new secret digest;
- the same application, chain, environment, and audience;
- a revision increment of exactly one;
- `supersedesCredentialId` equal to the current credential ID;
- replacement scopes that preserve or narrow the current scope set.

The old credential transitions to `ROTATED` at the replacement issue time. Rotation cannot broaden scopes or change audience. A broader permission set requires a separately authorized issuance path against the application's declared maximums.

## Revocation

Only an `ACTIVE` credential may be revoked. Revocation records a terminal timestamp and reason and produces an off-chain revocation plan for the owning credential service. A revoked or rotated credential cannot be revived, rotated again, or revoked again through DEVHUB-16 lifecycle planning.

## CLI surface

The `@420/cli` package now also exposes `420-auth`:

```text
420-auth identity APPLICATION_JSON
420-auth issue APPLICATION_JSON REQUEST_JSON [MANIFEST_JSON]
420-auth credential CREDENTIAL_JSON [AT_ISO]
420-auth rotate CURRENT_JSON REPLACEMENT_JSON
420-auth revoke CURRENT_JSON REVOKED_AT_ISO REASON
```

The CLI prints public identity data, issuance/lifecycle plans, and redacted credential views only. It intentionally has no command to display, export, recover, or persist bearer secrets.

## Authority model

| Object/evidence | Authority |
| --- | --- |
| service application descriptor | off-chain service-auth metadata only |
| API credential | owning off-chain service only, within declared scopes |
| lifecycle rotation/revocation plan | off-chain credential-service instruction only |
| optional registration reference | correlation only |
| 420 Identity credential | separate on-chain 420 Identity authority |
| wallet/smart-account capability | separate Wallet/CapabilityRegistry authority |
| application legitimacy/version | 420Registry/ProtocolRegistry governance + chain state |
| protocol role/state | owning protocol contract |

## Invariants

- **DEVHUB-INV-126** — DEVHUB-16 service identities have `canonicalProtocolAuthority: false`.
- **DEVHUB-INV-127** — off-chain service identities are explicitly not 420 Identity credentials.
- **DEVHUB-INV-128** — off-chain API credentials never grant wallet or smart-account capabilities.
- **DEVHUB-INV-129** — off-chain API credentials never establish Registry legitimacy, application registration, governance authority, or protocol roles.
- **DEVHUB-INV-130** — application identity is bound to the selected chain ID and environment before issuance can be planned.
- **DEVHUB-INV-131** — credential audiences must be members of the application's declared audience set.
- **DEVHUB-INV-132** — credential scopes must be a subset of the application's declared maximum scope set.
- **DEVHUB-INV-133** — raw bearer secrets are not accepted in tracked application or credential-request objects.
- **DEVHUB-INV-134** — tracked credential metadata may contain a SHA-256 secret digest but Developer Hub reports `secretMaterialManaged: false` and `secretMaterialPersisted: false`.
- **DEVHUB-INV-135** — credential expiry must be strictly later than issuance and malformed or escalated requests fail closed.
- **DEVHUB-INV-136** — only `ACTIVE` credentials may enter rotation or revocation planning.
- **DEVHUB-INV-137** — rotation creates a distinct credential ID and distinct secret digest rather than changing bearer identity in place.
- **DEVHUB-INV-138** — rotation preserves application, chain, environment, and audience binding.
- **DEVHUB-INV-139** — rotation may preserve or narrow scopes but cannot broaden the current credential's scopes.
- **DEVHUB-INV-140** — replacement revisions increment exactly once and explicitly reference the credential they supersede.
- **DEVHUB-INV-141** — `ROTATED` and `REVOKED` credentials are terminal and cannot regain API authority through lifecycle planning.
- **DEVHUB-INV-142** — expiry is derived fail-closed from an active credential and evaluation time; it never revives a terminal credential.
- **DEVHUB-INV-143** — CLI lifecycle views and plans never return bearer secret material and redacted views do not return the secret digest value.

## Remaining DEVHUB-16 work

The next slice is dashboard/service integration: expose redacted service-auth status and credential lifecycle metadata through the local Developer Hub dashboard without adding a secret-retrieval route or turning the dashboard into a credential authority. A production credential backend remains deployment infrastructure and must implement the same lifecycle contract externally.

## Next after DEVHUB-16

DEVHUB-17 adds Developer Hub status and service-health aggregation while preserving the same canonical-versus-operational authority boundary.
