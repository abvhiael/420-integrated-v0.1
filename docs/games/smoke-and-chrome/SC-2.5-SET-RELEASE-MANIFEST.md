# Smoke & Chrome — SC-2.5 Canonical Set / Release Manifest and Asset Registry Model

Status: frozen for SC-2 V1

## Purpose

SC-2.5 defines the canonical release-manifest and registry model that binds gameplay definitions and collectible editions into versioned, hash-addressed release units without allowing release metadata to alter competitive gameplay.

A release manifest is content-addressed, immutable once published, and suitable for client pinning, deck validation, replay verification, tournament qualification, and asset discovery.

## 1. Canonical hierarchy

The authoritative hierarchy is:

`RulesetVersion -> SetManifest -> CardDefinitionRef -> EditionManifest -> Printing`

RulesetVersion, CardDefinition, AbilityDefinition, EffectDefinition, and runtime gameplay objects remain competitive authorities according to SC-1 and SC-2.1 through SC-2.3.

Edition and Printing data remain collectible-only according to SC-2.4.

## 2. SetManifest

A SetManifest MUST contain at least:

```ts
interface SetManifest {
  schemaVersion: string;
  setId: string;
  setCode: string;
  name: string;
  releaseId: string;
  releaseVersion: number;
  rulesetVersion: string;
  cardRegistryVersion: string;
  abilityRegistryVersion: string;
  effectRegistryVersion: string;
  cardDefinitions: CardDefinitionRef[];
  editions: EditionManifestRef[];
  legality: SetLegalityPolicy;
  releaseWindow: ReleaseWindow;
  dependencies: ManifestDependency[];
  contentRoot: string;
  manifestHash: string;
}
```

`setId` and `releaseId` are stable logical identifiers. `releaseVersion` identifies an immutable published release revision.

## 3. CardDefinition references

Each card entry MUST bind the exact gameplay definition used by the release:

```ts
interface CardDefinitionRef {
  cardDefinitionId: string;
  revision: number;
  definitionHash: string;
  collectorNumber?: string;
}
```

Collector numbering is presentation/catalogue metadata. It MUST NOT affect gameplay identity, deck-copy limits, legality, RNG, or runtime ordering.

## 4. Edition references

Each collectible edition referenced by a set MUST bind:

```ts
interface EditionManifestRef {
  editionId: string;
  cardDefinitionId: string;
  editionHash: string;
  rarity: string;
  finishPolicyRef?: string;
  supplyCeiling?: number;
}
```

Edition metadata is excluded from competitive state and match hashes except where an external ownership proof is explicitly required for a non-competitive collectible action.

## 5. Release windows

A release manifest MUST define its publication window independently from competitive legality:

```ts
interface ReleaseWindow {
  announcedAt?: string;
  publishedAt: string;
  saleStartAt?: string;
  saleEndAt?: string;
}
```

Wall-clock release metadata MUST NOT itself determine in-match behavior.

## 6. Legality policy

Competitive legality is explicit, versioned data:

```ts
interface SetLegalityPolicy {
  formats: Record<string, {
    legalFrom?: string;
    legalUntil?: string;
    status: 'LEGAL' | 'NOT_LEGAL' | 'SUSPENDED';
  }>;
}
```

Deck validators MUST validate against a pinned legality snapshot or tournament manifest. Live network time MUST NOT silently alter a match already admitted.

## 7. Registry snapshot

A competitive match manifest MUST pin the exact registry snapshot required to reproduce the match:

```ts
interface CompetitiveRegistrySnapshot {
  rulesetVersion: string;
  setManifestHashes: string[];
  cardDefinitionHashes: string[];
  abilityRegistryHash: string;
  effectRegistryHash: string;
  legalitySnapshotHash: string;
}
```

Every list MUST use canonical ordering before hashing.

## 8. Asset registry

The asset registry MAY index artwork, card frames, audio, localization, animations, previews, and other client-facing files.

```ts
interface AssetDescriptor {
  assetId: string;
  kind: string;
  contentHash: string;
  mediaType: string;
  byteLength?: number;
  locale?: string;
  uriHints?: string[];
}
```

`uriHints` are retrieval hints only. The canonical asset identity is `assetId + contentHash`, not the mutable URI.

Missing cosmetic assets MUST NOT alter gameplay resolution.

## 9. Content roots

A SetManifest MUST expose a deterministic `contentRoot` computed from canonically ordered child hashes. Implementations MAY use a Merkle root or equivalent deterministic commitment.

At minimum the content root MUST commit to:

- the manifest schema/version;
- CardDefinition references;
- Edition references;
- legality policy;
- dependency manifests;
- registry-version references.

The final `manifestHash` MUST commit to the complete canonical SetManifest excluding the self-referential `manifestHash` field.

## 10. Dependencies

A release MAY depend on prior manifests or shared registries, but dependencies MUST be explicit and hash-pinned:

```ts
interface ManifestDependency {
  kind: 'SET' | 'RULESET' | 'CARD_REGISTRY' | 'ABILITY_REGISTRY' | 'EFFECT_REGISTRY' | 'ASSET_REGISTRY';
  id: string;
  hash: string;
}
```

Unpinned "latest" dependencies are prohibited in competitive validation.

## 11. Publication and mutation rules

Published release manifests are immutable.

Corrections require a new `releaseVersion` and new `manifestHash`.

A new revision MUST NOT overwrite the historical content required to replay or audit prior matches.

Clients MAY mark older releases superseded for discovery UX, but prior content MUST remain addressable for replay and tournament audit.

## 12. Competitive manifest admission

Before a competitive match begins, the validator MUST resolve and pin:

1. ruleset version;
2. allowed SetManifest hashes;
3. exact CardDefinition revisions/hashes in both decks;
4. ability/effect registry hashes;
5. legality snapshot;
6. RNG algorithm/version from SC-1.11;
7. deck hashes from SC-1.10.

After match start, no release publication, banlist update, asset change, edition transfer, or registry update may mutate the admitted competitive snapshot.

## 13. Pack / collectible release metadata

A release manifest MAY reference pack collation tables, rarity distributions, promotional schedules, and mint policies.

Those tables belong to the collectible/economic layer and MUST use randomness isolated from SC-1.11 match RNG.

Owning a scarce release, serialized printing, foil/chrome variant, promotional printing, or expensive asset MUST NOT improve competitive deck legality or card behavior beyond access to the same CardDefinition available under the applicable format rules.

## 14. Registry discovery vs authority

Search indexes, CDN catalogues, marketplace indexes, explorer metadata, and client caches are discovery layers only.

Authoritative identity comes from versioned IDs and content hashes.

A stale or malicious index MUST NOT be able to substitute a different CardDefinition, Edition, or asset under an existing hash-pinned manifest.

## 15. Failure behavior

Competitive validation MUST fail closed when:

- a referenced manifest is missing;
- a content hash does not match;
- a dependency is unresolved;
- a CardDefinition revision differs from the pinned reference;
- registry hashes mismatch;
- canonical ordering/serialization cannot be reproduced;
- legality snapshot cannot be verified.

Cosmetic asset retrieval failure MAY fail open visually, but MUST NOT alter authoritative gameplay state.

## 16. SC-2.5 invariants

**SC-2.5-INV-001 — Immutable publication**  
A published SetManifest hash always resolves to the same canonical content.

**SC-2.5-INV-002 — Definition pinning**  
Every competitive card reference pins a CardDefinition ID, revision, and definition hash.

**SC-2.5-INV-003 — No mutable latest**  
Competitive validation never relies on an unpinned `latest` registry or release dependency.

**SC-2.5-INV-004 — Canonical ordering**  
All manifest lists used for hashing have one canonical deterministic order.

**SC-2.5-INV-005 — Legality pinning**  
A match uses the legality snapshot admitted before match start for its entire lifetime.

**SC-2.5-INV-006 — Collectible neutrality**  
Edition, Printing, rarity, finish, serial, provenance, supply, ownership, and marketplace metadata cannot modify competitive rules or hashes.

**SC-2.5-INV-007 — Asset neutrality**  
Missing or substituted cosmetic assets cannot change authoritative gameplay outcomes.

**SC-2.5-INV-008 — Hash-addressed authority**  
Mutable URIs and indexes are never authoritative substitutes for hash-pinned content.

**SC-2.5-INV-009 — Historical replay**  
Superseding a release never destroys the content required to replay a prior valid match.

**SC-2.5-INV-010 — Dependency closure**  
Every competitive manifest dependency is explicit and hash-pinned.

**SC-2.5-INV-011 — Registry consistency**  
The ruleset, card, ability, effect, and legality registries used by a match are mutually version-compatible and pinned in the match manifest.

**SC-2.5-INV-012 — RNG separation**  
Collectible pack/mint randomness cannot consume or influence the competitive match RNG stream.

**SC-2.5-INV-013 — Fail closed**  
Unverifiable competitive manifests or dependencies cannot be admitted to a competitive match.

**SC-2.5-INV-014 — Wallet neutrality**  
Wallet state and ownership metadata cannot modify the competitive registry snapshot.

**SC-2.5-INV-015 — Content-root integrity**  
Any authoritative child-content mutation necessarily changes the applicable content root and manifest hash.

## 17. SC-2.5 closeout

SC-2.5 establishes the release-level trust boundary required for deterministic client synchronization, deck validation, tournaments, historical replay, and future on-chain provenance without moving blockchain or marketplace state into the match hot loop.

The canonical model is therefore:

`versioned rules + hash-pinned set manifests + immutable CardDefinitions + collectible-only Editions/Printings + content-addressed client assets`.

This completes SC-2.5.
