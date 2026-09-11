# 420 Developer Hub — DEVHUB-16 Off-chain Application Identity & API Credentials

## Status

DEVHUB-16 establishes the identity and credential model used by off-chain Developer Hub services. These identities and API credentials authenticate requests to service APIs only. They are not 420 Identity credentials, wallet capabilities, Registry registrations, governance roles, protocol permissions, or canonical chain state.

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

## Secret boundary

`secretSha256` is metadata for identifying/confirming a credential without persisting the secret. It is not itself an authentication secret and cannot be used as a bearer token.

DEVHUB-16 deliberately rejects arbitrary extra fields so `apiKey`, `secret`, token material, private keys, mnemonics, or similar values cannot silently enter the tracked descriptor format.

Future service implementations may use a dedicated secret manager, HSM, KMS, encrypted credential database, or equivalent backend. That storage mechanism remains outside canonical protocol state.

## Authorization semantics

An API key may authorize only the off-chain audience and scopes explicitly present in its credential record. Scope evaluation is fail-closed and cannot broaden the application's declared maximum scope set.

Examples include read access to a hosted Indexer API or submission to an off-chain verification service. Even a service-admin API scope would remain authority over that service only; it cannot create wallet signing rights, Registry legitimacy, governance votes, protocol roles, or an on-chain Identity credential.

## Chain and environment binding

Application descriptors bind to a selected network environment and decimal chain ID so a credential intended for a local/test service cannot be silently reused as production identity metadata. This is correlation and deployment hygiene, not consensus authorization.

## Rotation and revocation direction

Credential implementations built on this model must support replacement and revocation by credential ID without changing the application identity. Old credentials must remain distinguishable from replacements and revoked credentials must fail closed at the owning service.

DEVHUB-16 foundation intentionally separates public metadata/validation from secret custody. Stateful issuance, rotation and revocation backends can implement this contract without putting secrets into Git, chain state, dashboards, logs, or CLI output.

## Authority model

| Object/evidence | Authority |
| --- | --- |
| service application descriptor | off-chain service-auth metadata only |
| API credential | owning off-chain service only, within declared scopes |
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

## Exit direction

The DEVHUB-16 foundation is ready when application descriptors and API credential requests are strictly validated, secret custody is isolated, authority boundaries are executable in tests, and later service backends can add rotation/revocation without altering on-chain identity or protocol authority.

## Next

DEVHUB-17 adds Developer Hub status and service-health aggregation while preserving the same canonical-versus-operational authority boundary.
