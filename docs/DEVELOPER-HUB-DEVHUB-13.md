# 420 Developer Hub — DEVHUB-13 Application Registration and Publishing

## Status

DEVHUB-13 adds the Developer Hub control surface for application release validation, canonical 420Registry registration planning and non-canonical 420AppStore publication metadata. It deliberately does not create a second application registry or allow a hosted catalogue to manufacture protocol legitimacy.

## Canonical boundary

`ProtocolRegistry.publishRegisteredService()` is governance-only. The contract records the canonical service/application identity, sequential version, implementation, runtime code hash derived from deployed bytecode, metadata hash and registration profile. Extension service IDs must already be approved by Registry governance.

420AppStore remains contract-free at Genesis. Its listing, ranking, categories, screenshots, descriptions, reviews and featured placement are presentation/catalogue state. AppStore does not create or revoke Registry registration.

Developer Hub therefore performs only validation, preflight planning and handoff orchestration.

## Application release manifest

DEVHUB-13 uses `schemaVersion: 1.0.0` and requires:

- stable `applicationId`;
- explicit decimal `chainId`;
- canonical bytes32 `serviceId`;
- sequential uint32 release `version` intended for Registry;
- deployed `implementation` address;
- expected deployed `runtimeCodeHash`;
- `metadataHash`;
- `registrationProfile` with `componentType: APPLICATION`, `manifestHash`, `dependencyRoot` and `interfaceHash`;
- public publisher address and optional public identity label;
- declared wallet capability scopes requested by the application;
- AppStore presentation metadata with HTTPS launch URL and categories.

Unsupported root fields fail closed. In particular, `privateKey`, `mnemonic`, arbitrary `registered` flags or alternate authority markers cannot be smuggled into the release object.

## Registry preflight

A valid release produces `READY_FOR_CANONICAL_PREFLIGHT`, not `REGISTERED`.

Before governance submission, tooling must confirm from canonical sources:

1. selected network chain ID matches the release;
2. implementation exists on the selected chain;
3. deployed runtime code hash equals the release `runtimeCodeHash`;
4. the service ID is Genesis-canonical or already approved by 420Registry;
5. Registry `currentVersion(serviceId) + 1` equals the proposed release version;
6. governance authorization is available for the Registry call.

Developer Hub cannot satisfy these conditions by trusting Indexer, AppStore or local UI state alone.

## Canonical Registry call

DEVHUB-13 prepares the exact logical call to:

```text
ProtocolRegistry.publishRegisteredService(
  serviceId,
  implementation,
  metadataHash,
  version,
  true,
  APPLICATION,
  manifestHash,
  dependencyRoot,
  interfaceHash
)
```

The Registry contract derives the runtime code hash from `extcodehash(implementation)` and enforces governance authorization, service-ID approval and sequential versions. The expected runtime hash in the Developer Hub plan is a preflight assertion; it is not substituted for the contract's chain-derived code hash.

## AppStore handoff

After canonical Registry confirmation, AppStore may project the registered application into catalogue/discovery UX together with:

- title and summary;
- HTTPS launch URL;
- categories;
- publisher provenance;
- requested wallet scopes;
- Registry identity/version/implementation provenance;
- verification and security evidence where available.

`appStoreListingCanonical` is always false. Delisting, ranking or featuring cannot mutate Registry state.

## Wallet safety

Declared `walletScopes` describe what the application may request. They do not grant those permissions. 420 Wallet / Smart Account capability checks and explicit user/account authorization remain the execution boundary.

## CLI

DEVHUB-13 adds:

```text
420 app plan RELEASE_JSON [--manifest PATH] [--catalogue PATH]
420 app view RELEASE_JSON [--manifest PATH] [--catalogue PATH]
```

`app plan` validates the release and emits the Registry governance handoff/stages.

`app view` emits the compact lifecycle view and makes the canonical/non-canonical boundaries explicit.

Neither command signs, submits governance actions, writes Registry state or publishes AppStore catalogue records.

## Invariants

- **DEVHUB-INV-094** — application release manifests are explicitly versioned and unsupported schemas/fields fail closed.
- **DEVHUB-INV-095** — release chain ID must exactly match the selected discovered network before Registry planning.
- **DEVHUB-INV-096** — application registration profiles use `ComponentType.APPLICATION`; Developer Hub cannot reclassify an app as a protocol or other Registry component.
- **DEVHUB-INV-097** — critical Registry identity/provenance hashes and implementation address are validated and cannot be zero, except `dependencyRoot` which may explicitly be zero when there are no committed dependencies.
- **DEVHUB-INV-098** — expected runtime code hash is preflight evidence only; canonical deployed code is established from chain state and ProtocolRegistry derives the code hash itself.
- **DEVHUB-INV-099** — `publishRegisteredService` remains governance-authorized; Developer Hub cannot bypass or impersonate Registry governance.
- **DEVHUB-INV-100** — local/UI/AppStore flags cannot manufacture canonical registration. Canonical registration exists only after confirmed 420Registry chain state.
- **DEVHUB-INV-101** — AppStore catalogue state remains non-canonical and cannot create, revoke or rewrite Registry registration/version history.
- **DEVHUB-INV-102** — wallet scopes in an app release are declarations only and never grant Smart Account/Wallet capabilities.
- **DEVHUB-INV-103** — application launch URLs must use HTTPS and may not embed endpoint credentials.

## Exit criteria

DEVHUB-13 is complete when:

1. application release manifests validate fail-closed;
2. release identity, chain, implementation and Registry registration-profile evidence are explicit;
3. Registry preflight clearly requires canonical code hash, service-ID approval and sequential-version checks;
4. a governance-only `publishRegisteredService` plan is generated without signing or submission;
5. AppStore presentation metadata is validated while remaining non-canonical;
6. wallet requested scopes are surfaced without being treated as permissions;
7. CLI plan/view commands expose the same lifecycle semantics;
8. tests enforce authority separation and hostile-state rejection.

## Next

DEVHUB-14 builds the Developer Hub dashboard over the existing network, contract, wallet, deployment, verification, Indexer, guide and application-publishing control surfaces without changing their underlying authority boundaries.
