---
title: Registry and publishing
audience:
  - developer
category: developer
status: development
version: current
---

# Registry and publishing

Deployment and verification do not make an application canonical in the 420 Integrated ecosystem. Canonical service/application registration is created through 420 Registry / `ProtocolRegistry`; AppStore publication is a separate discovery/catalogue layer.

## Release manifest

A publishable application release should bind at least:

- stable application ID;
- exact chain ID/environment;
- canonical bytes32 service ID;
- intended sequential Registry version;
- deployed implementation address;
- expected deployed runtime code hash;
- metadata hash;
- registration profile with `componentType: APPLICATION`, manifest hash, dependency root and interface hash;
- public publisher identity/address;
- requested Wallet capability scopes as declarations only;
- public AppStore presentation metadata.

Fail closed on unknown authority fields or embedded signing secrets.

## Registry preflight

Before preparing a canonical registration action, confirm from canonical sources:

1. the selected network/environment matches the release;
2. deployed implementation code exists;
3. the runtime code hash matches the release evidence;
4. the service ID is Genesis-canonical or has already been approved through Registry governance;
5. the proposed version is exactly `currentVersion(serviceId) + 1`;
6. the registration profile matches the intended component type/interface/dependencies;
7. governance authorization is available for the Registry publication action.

Derived Indexer state, AppStore listings or local UI flags cannot satisfy these conditions by themselves.

## Canonical publication

The logical Registry call is:

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

`publishRegisteredService()` is governance-authorized. `ProtocolRegistry` derives the runtime code hash from deployed chain code; a Developer Hub-provided expected hash is preflight evidence only.

Canonical registration exists only after the governance-authorized transaction is confirmed in canonical Registry state.

## AppStore handoff

After Registry confirmation, 420AppStore may publish discovery metadata such as title, summary, launch URL, categories, screenshots, publisher provenance, requested Wallet scopes, Registry identity/version/implementation provenance and verification evidence.

At Genesis, AppStore is contract-free presentation/catalogue state. Ranking, featuring, review state or delisting cannot create, revoke or rewrite `ProtocolRegistry` registration.

## Wallet scopes

Requested Wallet scopes are declarations of what an application may ask for. They grant nothing. The 420 Wallet / Smart Account capability system still performs the actual account/session authorization when a user interacts with the application.

## Safe release order

Use this order:

`DEPLOY` -> `CONFIRM CODE` -> `VERIFY` -> `REGISTRY PREFLIGHT` -> `GOVERNANCE REGISTRATION` -> `CONFIRM REGISTRY STATE` -> `APPSTORE PUBLICATION`

Do not publish AppStore presentation as if the application were canonically registered before the Registry transaction is confirmed.

## Upgrade releases

Treat every registered upgrade as a new sequential version with fresh implementation/code-hash and profile evidence. Preserve historical Registry versions and historical verification evidence. Clients should resolve the current active version for new work while retaining exact version provenance for historical transactions/events.