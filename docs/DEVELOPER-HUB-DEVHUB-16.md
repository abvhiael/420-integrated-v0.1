# 420 Developer Hub — DEVHUB-16 Off-chain Application Identity & API Credentials

## Status

DEVHUB-16 establishes the identity and credential model used by off-chain Developer Hub services. These identities and API credentials authenticate requests to service APIs only. They are not 420 Identity credentials, wallet capabilities, Registry registrations, governance roles, protocol permissions, or canonical chain state.

The implementation includes strict application identity and issuance planning, bounded credential rotation/revocation, expiry evaluation, redacted lifecycle views, the dedicated `420-auth` CLI, and read-only dashboard integration.

## Objects

### Service application identity

A service application identity is public metadata describing an application that may call qualified off-chain services. It binds `applicationId`, selected `chainId` and environment, display name and owner reference, allowed API audiences, maximum off-chain scopes, and an optional registration reference used only for correlation. A registration reference does not prove registration or inherit Registry authority.

### API credential issuance plan

A credential request binds a stable `credentialId`, one allowed audience, a subset of the application's allowed scopes, issue/expiry timestamps, and a lowercase SHA-256 digest of the secret. Developer Hub validates and plans issuance. The raw API secret is generated, delivered, stored, rotated, and revoked by an off-chain credential service. Git-tracked manifests and Developer Hub control views never contain the bearer secret.

### Credential lifecycle record

A redacted lifecycle record binds application/credential identity, chain/environment, audience/scopes, issue/expiry timestamps, secret digest, revision, optional predecessor link, and bounded lifecycle state. Stored states are `ACTIVE`, `ROTATED`, and `REVOKED`; `EXPIRED` is derived from an active record plus evaluation time. Terminal credentials remain terminal.

## Secret boundary

`secretSha256` identifies/confirms a credential without persisting its bearer secret. It is not itself an authentication secret. Exact-field validation prevents arbitrary `apiKey`, `secret`, token, private-key, mnemonic, or similar material from entering tracked descriptors.

Lifecycle views expose only `secretDigestPresent: true`; they do not return the digest value or bearer material. A production service may use a secret manager, HSM, KMS, encrypted credential database, or equivalent backend, but that storage remains outside canonical protocol state and outside Developer Hub source-controlled metadata.

## Authorization semantics

An API key may authorize only the off-chain audience and scopes explicitly present in its credential record. Scope evaluation is fail-closed. Even a service-admin scope remains authority over that service only; it cannot create wallet signing rights, Registry legitimacy, governance votes, protocol roles, or an on-chain 420 Identity credential.

Application descriptors bind to network environment and decimal chain ID so local/test credentials cannot be silently reused as production identity metadata. This is deployment hygiene and service correlation, not consensus authorization.

## Rotation and revocation

Rotation is replacement, not mutation of bearer material in place. It requires an `ACTIVE` current credential, a different replacement credential ID and digest, the same application/chain/environment/audience, revision +1, an explicit `supersedesCredentialId`, and scopes that preserve or narrow the current scope set. The old credential becomes terminal `ROTATED` at replacement issuance.

Only an `ACTIVE` credential may be revoked. Revocation records a terminal timestamp/reason. `ROTATED` and `REVOKED` credentials cannot be revived or re-enter lifecycle planning.

## CLI surface

`@420/cli` exposes:

```text
420-auth identity APPLICATION_JSON
420-auth issue APPLICATION_JSON REQUEST_JSON [MANIFEST_JSON]
420-auth credential CREDENTIAL_JSON [AT_ISO]
420-auth rotate CURRENT_JSON REPLACEMENT_JSON
420-auth revoke CURRENT_JSON REVOKED_AT_ISO REASON
```

The CLI prints identity data, issuance/lifecycle plans, and redacted credential views only. There is no command to display, export, recover, or persist bearer secrets.

## Dashboard surface

The local Developer Hub dashboard exposes only:

```text
GET /api/service-auth/view
GET /api/service-auth/credential?at=...
```

These routes use the same DEVHUB-16 validation/view functions as the runtime and CLI. The browser renders application identity, audience/scope metadata, lifecycle status, revision, expiry, and the fact that a digest is recorded. It never receives the digest value or bearer secret.

The dashboard remains globally GET-only. It has no issuance, rotation, revocation, secret-retrieval, generic credential-service proxy, or mutation endpoint. Rotation/revocation remain explicit plans handed to the owning off-chain credential service.

## Authority model

| Object/evidence | Authority |
| --- | --- |
| service application descriptor | off-chain service-auth metadata only |
| API credential | owning off-chain service only, within declared scopes |
| lifecycle rotation/revocation plan | off-chain credential-service instruction only |
| dashboard service-auth view | read-only redacted projection only |
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
- **DEVHUB-INV-130** — application identity is bound to selected chain ID/environment before issuance planning.
- **DEVHUB-INV-131** — credential audiences must be members of the application's declared audience set.
- **DEVHUB-INV-132** — credential scopes must be a subset of the application's declared maximum scope set.
- **DEVHUB-INV-133** — raw bearer secrets are not accepted in tracked application or credential-request objects.
- **DEVHUB-INV-134** — tracked metadata may contain a SHA-256 secret digest while Developer Hub reports no secret custody/persistence.
- **DEVHUB-INV-135** — expiry must be later than issuance and malformed/escalated requests fail closed.
- **DEVHUB-INV-136** — only `ACTIVE` credentials may enter rotation or revocation planning.
- **DEVHUB-INV-137** — rotation creates a distinct credential ID and distinct secret digest.
- **DEVHUB-INV-138** — rotation preserves application, chain, environment, and audience binding.
- **DEVHUB-INV-139** — rotation may preserve/narrow scopes but cannot broaden them.
- **DEVHUB-INV-140** — replacement revisions increment exactly once and explicitly reference the superseded credential.
- **DEVHUB-INV-141** — `ROTATED` and `REVOKED` credentials are terminal.
- **DEVHUB-INV-142** — expiry is derived fail-closed and never revives terminal credentials.
- **DEVHUB-INV-143** — CLI lifecycle views/plans never return bearer secret material; redacted views do not return the digest value.
- **DEVHUB-INV-144** — dashboard service-auth APIs are GET-only read surfaces and cannot issue, rotate, revoke, or mutate credentials.
- **DEVHUB-INV-145** — dashboard/browser output never receives bearer secrets or the `secretSha256` value.
- **DEVHUB-INV-146** — dashboard service-auth views remain noncanonical and cannot grant wallet, Identity, Registry, governance, or protocol authority.
- **DEVHUB-INV-147** — local example credential status is demonstration/operational metadata only and does not prove production credential validity.

## Exit criteria

DEVHUB-16 is complete when off-chain application identity, issuance planning, bounded lifecycle semantics, CLI inspection/planning, and redacted dashboard views share the same fail-closed authority boundaries; bearer material remains outside tracked state and user-facing output; and qualification tests prevent the Developer Hub from becoming an on-chain identity, wallet, Registry, governance, protocol, or secret-custody authority.

## Next

DEVHUB-17 adds Developer Hub status and service-health aggregation while preserving the same canonical-versus-operational authority boundary.
