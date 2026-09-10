# SC-2.7 — Asset-Model Cross-Invariants and Formal SC-2 Closeout

Status: frozen
Branch: `feature/420-gaming-smoke-chrome`

## Purpose

SC-2.7 closes the canonical card and asset model by binding SC-2.1 through SC-2.6 into one deterministic, versioned contract. It establishes the non-negotiable boundaries between competitive gameplay data, mutable runtime state, collectible/provenance metadata, release manifests, and pre-match admission packages.

SC-3 may rely on these rules as fixed architecture and must not reintroduce parallel identity, mutable-latest resolution, wallet-dependent gameplay authority, or collectible metadata into the hot match loop.

## Canonical object chain

The canonical asset hierarchy is:

`CardDefinition -> Edition -> Printing`

The competitive execution hierarchy is:

`CardDefinition -> AbilityDefinition / EffectDefinition -> RuntimeObject`

The release/admission hierarchy is:

`SetManifest -> DeckManifest -> MatchAdmissionPackage`

Each hierarchy has a distinct responsibility and no layer may assume authority belonging to another.

## Frozen responsibilities

### CardDefinition

`CardDefinition` is the sole canonical source of intrinsic competitive card identity and rules-facing properties, including type, faction, subtypes, costs, base statistics, deck-construction attributes, ability references, uniqueness, and legality-relevant metadata.

Collectible or ownership data is forbidden from changing a `CardDefinition`'s competitive meaning.

### AbilityDefinition / EffectDefinition

Abilities and effects are deterministic, registry-addressed, versioned data. They define triggers, costs, targets, conditions, effect opcodes, ordering, replacement semantics, and resolution behavior.

Arbitrary client code, external calls, wallet reads, chain reads, or unregistered executable payloads are not valid rules authority.

### RuntimeObject

A `RuntimeObject` is the match-scoped mutable realization of immutable rules content. Runtime state may include controller, zone, damage, counters, attachments, temporary modifiers, status flags, generated-object metadata, and other deterministic match state.

Runtime state must never import Edition/Printing economics or provenance into competitive state.

### Edition / Printing

`Edition` and `Printing` represent collectible release and ownership concerns: art/frame variants, rarity, finish, supply ceiling, serial identity, mint provenance, ownership reference, and lifecycle status.

These properties are economically and cosmetically meaningful but competitively inert.

### SetManifest

A `SetManifest` is an immutable, hash-addressed release snapshot that pins the exact CardDefinitions, definition revisions, ruleset version, ability/effect registry versions, legality snapshot, dependency roots, and asset references used by a release.

Competitive systems must resolve against an explicit manifest hash, never an unqualified mutable `latest` release.

### DeckManifest

A `DeckManifest` is the canonical normalized competitive loadout representation. It pins the Leader, Main Deck contents, CardDefinition revisions/hashes, format/ruleset identity, release manifest, legality snapshot, and deterministic deck hash.

Printing IDs, wallet addresses, marketplace prices, foil variants, serials, and similar collectible metadata are excluded from competitive deck identity.

### MatchAdmissionPackage

A `MatchAdmissionPackage` is the complete immutable pre-match authority bundle. It proves that both players' submitted loadouts were validated against a specific ruleset, release manifest, legality snapshot, registry set, and admission policy.

Once a match is admitted, that package is immutable for the lifetime of the match.

## Cross-layer invariants

### SC2-INV-001 — Single competitive identity authority

Competitive card identity is always derived from `CardDefinition` identity and its pinned revision/hash. Edition IDs, Printing IDs, wallet ownership, serial numbers, and provenance may never substitute for competitive card identity.

### SC2-INV-002 — Definition / collectible separation

No field that exists only because a card is collectible may modify costs, statistics, abilities, targeting, deck legality, RNG probability, zone permissions, resource generation, combat behavior, progression rate, matchmaking, ranking weight, or any other competitive outcome.

### SC2-INV-003 — Registry-pinned executable semantics

Every executable ability/effect reference used by a match must resolve through the exact ability/effect registry versions pinned by that match's admission package.

### SC2-INV-004 — No arbitrary executable card payloads

Cards cannot introduce arbitrary JavaScript, Solidity, shell commands, network callbacks, wallet calls, chain lookups, or unregistered executable code into the rules engine.

### SC2-INV-005 — Runtime state derives from frozen content

Every runtime object must be reconstructible from its originating definition/generated-object authority plus the deterministic ordered match event stream.

### SC2-INV-006 — Runtime / provenance firewall

Edition and Printing metadata cannot enter authoritative runtime state, match state hashes, combat calculations, draw odds, random-selection candidate weights, or terminal-result evaluation.

### SC2-INV-007 — Ownership does not mutate admitted matches

Wallet disconnection, token transfer, marketplace sale, entitlement revocation, ownership change, or chain reorganization after admission cannot alter the already-admitted deck, runtime objects, rules semantics, or match result.

### SC2-INV-008 — Guest-play independence

Core gameplay may be provided without requiring wallet ownership or collectible possession. System/starter decks may use canonical CardDefinitions without any Printing object.

### SC2-INV-009 — Definition-based copy limits

Deck size, faction rules, uniqueness, banned/restricted status, and copy limits are evaluated by CardDefinition identity, never by Edition or Printing identity.

### SC2-INV-010 — Immutable historical resolution

Historical matches and replays must resolve against their pinned ruleset, definition hashes, registry hashes, release manifest, legality snapshot, and admission package rather than current repository or live-service state.

### SC2-INV-011 — No mutable-latest competitive dependency

A competitive match may never depend on resolving `latest` for card definitions, registries, release manifests, legality state, or ruleset semantics after admission.

### SC2-INV-012 — Canonical serialization

All gameplay-significant definitions, manifests, registry entries, deck manifests, and admission packages must use canonical serialization before hashing. Equivalent logical content must produce identical hashes across conforming implementations.

### SC2-INV-013 — Hash mismatch is fail-closed

If any pinned CardDefinition, registry entry, SetManifest, DeckManifest, legality snapshot, or admission-package dependency cannot be resolved to its expected hash, admission or replay reconstruction fails closed.

### SC2-INV-014 — Generated objects have no economic authority

Generated/token/runtime-only objects may participate in gameplay but do not automatically create transferable collectible assets, mint rights, ownership claims, marketplace value, or tokenized supply.

### SC2-INV-015 — Printing uniqueness without gameplay distinction

Printing serials and provenance must be unique where required by collectible policy, but two valid Printings of the same CardDefinition are competitively interchangeable unless an explicitly separate cosmetic-only presentation layer is being rendered.

### SC2-INV-016 — Pack RNG / match RNG separation

Pack opening, mint selection, rarity rolls, cosmetic assignment, or other collectible randomness must not consume, seed, bias, reveal, or otherwise affect match RNG state.

### SC2-INV-017 — Match RNG / ownership separation

Match RNG probabilities and candidate ordering may not depend on wallet state, collectible rarity, Edition, Printing serial, provenance, account age, marketplace value, or amount of `$420` held.

### SC2-INV-018 — Release manifest immutability

Once published as a canonical release snapshot, a SetManifest identified by a content hash is immutable. Corrections require a new manifest/version/hash rather than mutation in place.

### SC2-INV-019 — Admission snapshot immutability

Once a match begins, its `MatchAdmissionPackage` is immutable. Reconnect, spectator join, host migration, retry, or server recovery must resume from the same package.

### SC2-INV-020 — Legality snapshot pinning

Banlist, restricted-list, format, and construction-policy changes made after admission cannot retroactively alter the legality of an in-progress match.

### SC2-INV-021 — Deterministic normalization

Deck entries, manifest dependencies, registry references, tags, and other unordered logical sets must use canonical ordering before serialization or hashing.

### SC2-INV-022 — No wallet pay-to-win bridge

Wallet linkage may unlock persistence, cosmetics, collectible ownership display, marketplace operations, tournament reward claims, or other explicit entitlements, but it may never increase combat stats, draw odds, match speed, ranking weight, progression rate, matchmaking priority, deck size, resource generation, or another competitive statistic.

### SC2-INV-023 — Chain reads stay outside the hot loop

Blockchain ownership/provenance may be verified before admission or for post-match economic operations, but hot gameplay resolution cannot require chain reads or chain finality.

### SC2-INV-024 — Asset presentation is non-authoritative

Missing, stale, or unavailable art/audio/UI assets must not change gameplay semantics. A conforming fallback representation must still resolve from CardDefinition and registry data.

### SC2-INV-025 — One object, one authority path

No client, wallet adapter, marketplace service, tournament service, or blockchain contract may maintain a parallel gameplay definition or runtime authority that can disagree with the canonical game engine.

### SC2-INV-026 — Copy / transform semantics remain definition-based

Runtime copy or transformation effects may reference another CardDefinition according to the rules engine, but they may not copy or transform into another player's Edition/Printing ownership, provenance, serial, or collectible entitlement.

### SC2-INV-027 — Hidden information excludes collectible leakage

Hidden gameplay information must be projected according to game-state visibility rules. Collectible ownership/provenance data must not accidentally reveal hidden card identity through APIs, event payloads, asset lookups, or wallet metadata.

### SC2-INV-028 — Competitive hashes exclude cosmetic variance

Competitive state, deck, replay, and result hashes exclude purely cosmetic Edition/Printing fields unless a separate non-authoritative presentation hash is intentionally committed alongside them.

### SC2-INV-029 — Replay completeness

A valid replay package must contain or resolve every pinned competitive dependency required to reproduce the match from its initial admitted state and ordered action/RNG history.

### SC2-INV-030 — Asset-model changes require version boundaries

Any future change that modifies gameplay-significant CardDefinition schema, ability/effect semantics, runtime-object semantics, release-manifest interpretation, deck-manifest interpretation, or admission-package validation requires an explicit new schema/ruleset/registry version boundary rather than silent reinterpretation.

## SC-2 exit criteria

SC-2 is complete when all of the following are true:

1. CardDefinition identity and gameplay fields are frozen.
2. Ability/effect representation is deterministic and registry-backed.
3. Runtime object identity and mutable match state are defined.
4. Edition and Printing collectible/provenance models are separated from gameplay.
5. Set/release manifests are immutable and hash-pinned.
6. Deck manifests and match admission packages are deterministic and immutable after admission.
7. Cross-layer invariants prohibit wallet, chain, marketplace, rarity, provenance, or mutable-latest state from altering competitive gameplay.
8. Historical replay can resolve from pinned content and registry hashes.
9. Unknown or mismatched authoritative content fails closed.
10. SC-3 can implement a deterministic match engine without redefining any asset identity, provenance, or admission semantics.

## Deferred to SC-3+

SC-2 deliberately does not implement the full deterministic match state machine, command reducer, event log, rollback/replay executor, networking, authoritative host, matchmaking, AI, card content, marketplace settlement, pack-opening services, tournament orchestration, wallet claim flows, or user-interface rendering.

Those systems must consume the frozen SC-1 and SC-2 contracts rather than redefine them.

## Closeout

SC-2 — Canonical Card & Asset Model is formally frozen at SC-2.7.

The next major phase is SC-3 — Deterministic Match Engine Foundation.

Recommended first step: **SC-3.1 — canonical MatchState, command envelope, event envelope, and pure reducer contract.**
