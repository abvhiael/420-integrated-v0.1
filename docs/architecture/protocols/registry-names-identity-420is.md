---
title: Registry, Names, Identity and 420-IS
audience:
  - developer
  - architect
  - operator
category: architecture
status: development
version: current
---

# Registry, Names, Identity and 420-IS

DOC-7.2 documents the discovery, naming, identity, and interoperability protocols that let applications find canonical services, refer to users and protocol objects consistently, and map external systems into 420 Integrated without granting external providers ambient authority.

These protocols are related, but they do not collapse into one trust system. 420 Registry answers which implementation/version is canonical for a service identity. 420 Names provides human-readable `.420` presentation names and resolution. 420 Identity anchors optional pseudonymous profiles and credentials. 420-IS standardizes provider adapters, namespaces, external-ID mappings, and checkpoints. None of them alone proves that an application, person, external fact, or provider is universally trustworthy.

## Authority map

| Protocol | Canonical authority | Explicit non-authority |
| --- | --- | --- |
| 420 Registry / `ProtocolRegistry` | service IDs, current implementation/version, immutable version history, registration-profile commitments, activation/deprecation state | custody, execution permission, wallet signing, governance power merely because a service is registered |
| 420 Names / `Names420` | `.420` name ownership, expiry, forward/reverse resolution, optional profile/service references | identity proof, universal reputation, protocol legitimacy beyond the referenced canonical service state |
| 420 Identity / `Identity420` | profile controller, profile metadata commitment, governed issuer registry/trust class, credential lifecycle | wallet ownership, legal identity by default, universal trust score, automatic dApp authorization |
| 420-IS | approved provider adapters, namespaces, revisioned external mappings, provider/domain checkpoints | authority over the external system itself, automatic truth of external claims, authority outside the mapped namespace/domain |

## 420 Registry

`ProtocolRegistry` is the canonical discovery and version registry for protocol services. It stores a current `Service` record per service ID and immutable historical records by version.

A service record includes:

- implementation address;
- runtime/code hash commitment;
- metadata hash;
- monotonically increasing version;
- activation time;
- active/inactive state.

Genesis canonical service IDs are frozen through `ServiceIds420`. Extension service IDs require explicit governance approval and a descriptor hash before publication.

### Registration profiles

The genesis-grade publication path records a `RegistrationProfile` containing:

- component type;
- manifest hash;
- dependency root;
- interface hash.

Before publication, the implementation must contain code and its runtime code hash is read from the deployed contract. This means discovery can be tied to the implementation actually present at the registered address rather than a caller-supplied code claim.

### Versioning and deprecation

Versions are append-only and strictly sequential for each service ID. Publishing version `n+1` does not erase version `n`; historical records remain queryable.

Deprecation marks the current version inactive. Consumers that require an operational service should resolve the active service rather than blindly reusing a cached address.

Registry publication does **not** grant the registered implementation new protocol privileges. Authorization remains defined by the protocol being called, its capabilities, governance rules, or other explicit authority.

## 420 Names

`Names420` is the canonical `.420` presentation-name registry and resolver.

A name record contains:

- owner;
- pending owner during transfer;
- resolved address;
- optional Identity profile ID;
- optional protocol service ID;
- expiry;
- label length.

### Registration safety

Name registration uses commit/reveal with a domain-separated commitment:

`420/NAMES/COMMITMENT/V1`

The current protocol enforces:

- minimum commitment age: 60 seconds;
- maximum commitment age: 24 hours;
- registration period: 30 to 365 days;
- maximum label length: 63 bytes/characters as represented by the protocol input.

Commitments are consumed on registration. An existing unexpired name cannot be overwritten.

### Expiry and renewal

Name ownership is lease-based, not perpetual by default. Resolution is valid only while the record is unexpired. Renewal requires the current owner and a valid extension duration.

Consumers must therefore treat an expired name as non-authoritative even if an indexer or cache still displays an older record.

### Forward and reverse resolution

Forward resolution may point to an address and may also include an Identity profile ID and Registry service ID.

Reverse resolution is address-controlled. An address may set a primary reverse name only when that address is also the current forward resolution target. `reverseResolve` rechecks the forward record and expiry before returning the label.

This prevents reverse display state from remaining valid after forward resolution changes.

### Transfers

Name transfer is two-step: the current owner nominates a pending owner, and the pending owner accepts. On acceptance, resolution resets to the new owner address and profile/service links are cleared. Applications must not carry old identity or service associations across a name transfer without fresh binding.

## 420 Identity

`Identity420` is an optional pseudonymous profile and credential anchor. It is not mandatory KYC and does not convert every profile into a real-world identity claim.

### Profiles

A profile contains:

- controller and optional pending controller;
- metadata hash;
- optional primary `.420` name hash;
- creation/update timestamps;
- active flag.

Profile IDs are chosen identifiers subject to uniqueness. The controller may update metadata/activity state and can transfer control through a two-step nominate/accept flow.

### Names ↔ Identity binding

Names and Identity deliberately require **bilateral agreement** for a strong binding.

A consumer should require both:

1. `Names420` says the active name record claims `profileId`; and
2. `Identity420` says that profile's `primaryName` equals the name's label hash.

A one-sided pointer is insufficient. This prevents either protocol from unilaterally manufacturing the full relationship.

### Issuers and trust classes

Credential issuers are governance-curated and assigned a trust class:

- `COMMUNITY`
- `VERIFIED`
- `INSTITUTIONAL`
- `SYSTEM`

`NONE` is not a valid active issuer trust class.

Trust class is an ecosystem policy classification for the issuer, not an assertion that every credential is correct or that the credential subject is universally trustworthy.

### Credentials

A credential records:

- issuer ID;
- subject profile ID;
- credential type;
- claim hash;
- issue time;
- optional expiry;
- revocation time;
- subject-rejected state.

Only the active issuer controller may issue. The issuer controller or governance may revoke. The subject profile controller may explicitly reject a credential.

A credential is valid only while all of the following hold:

- credential exists;
- not revoked;
- not subject-rejected;
- not expired;
- issuer remains active;
- subject profile remains active.

Applications that require a minimum issuer class should check both validity and the current trust class rather than caching an earlier result.

## 420 Interoperability Standard (420-IS)

420-IS provides a common boundary for integrating external providers and identifiers without making provider-specific implementations part of every consuming protocol.

The genesis package contains:

- `I420IS.sol` — adapter interface contract;
- `InteropIds420.sol` — standard/version/domain identifiers;
- `InteropProviderRegistry420` — governed adapter registry;
- `InteropNamespaceRegistry420` — namespaces and external-ID mappings;
- `InteropCheckpointRegistry420` — provider/domain checkpoint chains;
- `InteropRouter420` — read-oriented resolution/support facade.

## Provider adapters

Providers are registered by governance using a provider ID, adapter contract, adapter type, manifest hash, and the current 420-IS standard version.

Registration/revision validates that:

- the adapter address contains code;
- the adapter reports the expected 420-IS standard version;
- its adapter type matches the governed provider type;
- its adapter manifest hash matches the committed manifest.

Provider revisions increment a revision counter. Providers can be deactivated without deleting their history.

A registered provider gains no authority outside the adapter type/domains and registries that explicitly recognize it.

## Namespaces and external mappings

A namespace binds an external identifier schema to one registered provider. Governance registers the namespace and its schema hash.

Only the currently active adapter for that namespace's provider may publish mappings.

A mapping binds:

- namespace ID + external identifier hash + revision;
- canonical 420 Integrated ID;
- attestation hash;
- optional superseded mapping key;
- lifecycle state.

Mapping keys are domain separated with:

`420/IS/MAPPING/V1`

Mappings move through explicit states: `ACTIVE`, `SUPERSEDED`, or `REVOKED`.

Supersession creates a new revision and preserves the previous key. It does not mutate history into a different claim. Governance can revoke an active mapping.

## Checkpoints

Providers may publish ordered checkpoints per provider/domain pair. A checkpoint contains:

- sequence;
- state hash;
- previous checkpoint hash;
- computed checkpoint hash;
- publication time.

Only the active provider adapter can publish. Sequences must increment by exactly one and every checkpoint after the first must reference the previous checkpoint hash.

Checkpoint hashes are domain separated and chain-bound:

`420/IS/CHECKPOINT/V1`, chain ID, provider ID, domain ID, sequence, state hash, previous checkpoint hash.

This produces an append-only commitment chain for the provider/domain state presented through 420-IS. It does not independently prove that the external source was honest; consuming protocols must still apply any required verification, finality, quorum, challenge, or dispute policy.

## Interop router

`InteropRouter420` composes provider, namespace, and checkpoint registries into a simpler read surface.

It can:

- resolve an exact namespace/external-ID/revision mapping;
- report whether an active provider adapter claims support for a domain;
- expose the 420-IS standard version.

The router is a convenience integration surface. Canonical state remains in the underlying registries, and consumers that require stronger policy should validate mapping status, provider activation, checkpoint requirements, and protocol-specific evidence directly.

## Typical discovery flow

A protocol-aware client should generally:

1. determine the canonical service ID;
2. resolve its current active implementation from 420 Registry;
3. validate the expected interface/manifest/dependency commitments required by the client;
4. use 420 Names only as a presentation/resolution layer, never as a substitute for canonical service resolution;
5. use Identity credentials only when the application's policy explicitly requires them;
6. use 420-IS only for external/provider namespaces and validate mapping/checkpoint status required by the consuming protocol;
7. treat indexer/search results as derived views and recheck canonical state before a security-sensitive action.

## Failure and recovery behavior

### Registry service is deprecated

Stop resolving it as active. Use a later approved version if one exists. Do not silently fall back to an arbitrary address supplied by RPC, UI, or a third party.

### Name expires or transfers

Stop treating old resolution/profile/service associations as authoritative. Re-resolve canonical state. After transfer, require new Identity/service bindings.

### Identity issuer is deactivated or credential is revoked/rejected/expired

The credential fails validity immediately under the canonical contract rules. Applications must not continue accepting a cached earlier-valid result for security-sensitive decisions.

### 420-IS provider is deactivated

Its adapter is no longer authorized to publish mappings/checkpoints. Consumers should stop relying on new provider output and apply their protocol-specific fallback or fail-closed behavior.

### Mapping is superseded or revoked

Do not continue treating the older mapping as active. Historical mappings remain useful for audit/replay, but current integration must follow the explicit lifecycle state.

### Derived services disagree

Prefer chain-authoritative Registry/Names/Identity/420-IS state. Indexer, Explorer, Search, caches, or external provider UIs can be rebuilt or replaced and must not override canonical records.

## DOC-7.2 invariants

- **DISC-001** — Registry service identity/version state is canonical discovery metadata, not ambient execution, custody, signing, or governance authority.
- **DISC-002** — Registry versions advance monotonically and historical versions remain inspectable.
- **DISC-003** — security-sensitive consumers must not treat an inactive/deprecated Registry service as active merely because an address is cached.
- **DISC-004** — `.420` ownership/resolution is valid only while the name record is unexpired.
- **DISC-005** — reverse name resolution is valid only while current forward resolution still points to the requesting address.
- **DISC-006** — a strong Names↔Identity association requires bilateral agreement from both canonical protocols.
- **DISC-007** — name transfer must not silently transfer prior Identity profile or Registry service associations.
- **DISC-008** — Identity profiles are optional protocol identities; they do not automatically establish legal identity or wallet ownership.
- **DISC-009** — credential validity is dynamic and depends on credential lifecycle, issuer activation, expiry, subject rejection, and subject-profile activation.
- **DISC-010** — issuer trust class is bounded policy metadata and must not be interpreted as a universal trust/reputation score.
- **DISC-011** — only the active governed 420-IS adapter for a provider/namespace may publish canonical interoperability mappings/checkpoints.
- **DISC-012** — 420-IS mappings are revisioned; supersession/revocation must remain explicit and auditable rather than overwriting history.
- **DISC-013** — 420-IS checkpoints must form a strictly ordered hash chain per provider/domain.
- **DISC-014** — a registered provider, name, profile, or service reference gains authority only in the domain explicitly granted by its owning protocol.
- **DISC-015** — external provider claims entering through 420-IS remain subject to the verification/finality/dispute rules of the consuming protocol.
- **DISC-016** — derived discovery/indexing/search services must remain subordinate to canonical Registry, Names, Identity, and 420-IS state.

## Related documentation

- [Core protocol architecture](index.md)
- [Protocol integration model](protocol-integration-model.md)
- [System dependency map](../dependency-map.md)
- [Trust-boundary model](../trust-boundary-model.md)
- [Chain accounts](../chain/accounts.md)
