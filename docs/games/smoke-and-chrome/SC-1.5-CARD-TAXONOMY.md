# Smoke & Chrome — SC-1.5 Canonical Card Taxonomy

Status: FROZEN FOR V1 RULESET
Branch: feature/420-gaming-smoke-chrome
Depends on: SC-0, SC-1.1, SC-1.2, SC-1.3, SC-1.4

## Purpose

SC-1.5 freezes the canonical V1 card classes and the minimum rules contract each class must obey. It also freezes the separation between gameplay definitions and collectible editions/printings so ownership can never alter competitive behavior.

## 1. Canonical gameplay object model

A playable card instance is derived from an immutable CardDefinition plus match-local state.

CardDefinition contains at minimum:
- cardDefinitionId
- rulesVersion
- name
- cardType
- faction identity and/or neutral identity
- printed costs
- base characteristics
- keyword set
- targeting restrictions
- timing permissions
- rules text / effect references

A match-local CardInstance contains at minimum:
- instanceId
- cardDefinitionId
- ownerPlayerId
- controllerPlayerId
- currentZone
- face/public state
- counters / temporary modifiers
- damage or other transient state where relevant
- attachments and relationships
- deterministic creation/transition metadata

No blockchain collectible identifier, edition, serial number, cosmetic treatment, provenance field, wallet identity, marketplace state, or token balance may modify CardDefinition gameplay semantics.

## 2. Canonical V1 card classes

V1 defines seven primary card types:

1. LEADER
2. OPERATIVE
3. INFRASTRUCTURE
4. GENETIC
5. OPERATION
6. GEAR
7. CONTRABAND

Chrome is a Gear subtype in V1, not an eighth primary card type.

Additional card types require a rules-version change and cannot be introduced ad hoc by card content.

## 3. LEADER

Leaders represent the player's factional command identity.

Rules:
- exactly one Leader is selected for each legal V1 deck unless a future format explicitly overrides this;
- a Leader begins in the player's Leader Zone and does not begin in the Deck;
- Leader identity may constrain legal factions/cards during deck construction;
- a Leader may provide static, triggered, and/or activated abilities;
- a Leader is public information for the entire match;
- Leader removal, replacement, transformation, or temporary suppression must be explicitly authorized by rules text;
- a Leader does not inherently constitute a separate loss condition unless SC-1.1 or later rules explicitly create one.

## 4. OPERATIVE

Operatives are persistent characters/units that contest Streets and District objectives.

Rules:
- Operatives enter play under a controller;
- Operatives may occupy only legal battlefield locations defined by SC-1.2 and later placement rules;
- Operatives may participate in combat only when timing, state, and location rules permit;
- base combat and influence characteristics are defined by CardDefinition;
- damage, exhaustion/readiness, counters, control changes, and temporary modifiers are match-local state;
- when an Operative leaves play, attachments and derived relationships resolve according to attachment rules rather than silently persisting;
- destroyed Operatives normally move to the owner's Discard unless an effect replaces that destination.

## 5. INFRASTRUCTURE

Infrastructure is a persistent installation in a player's Operation or another specifically legal location.

Rules:
- Infrastructure is persistent after resolution;
- Infrastructure may generate resources, modify zones, support cultivation, alter Heat exposure, or create strategic capabilities;
- an Infrastructure card may occupy only a location permitted by its definition and the board rules;
- Infrastructure does not attack or defend merely because it is a permanent;
- Infrastructure can be damaged, disabled, destroyed, seized, or relocated only where explicit rules provide those semantics;
- destroyed Infrastructure normally moves to its owner's Discard unless replaced by an effect.

## 6. GENETIC

Genetic cards represent strains, seeds, clones, genetic programs, or cultivation blueprints that participate in the cultivation system.

Rules:
- Genetic is the canonical primary type for cultivation-enabling plant/genetics cards in V1;
- Genetics may enter Cultivation slots only through legal cultivation actions/effects;
- cultivation stages and harvest behavior are defined in SC-1.8, not by implicit assumptions in SC-1.5;
- a Genetic CardDefinition may provide growth, yield, resilience, trait, harvest, or cross-system effects;
- a Genetic card in Cultivation is a public permanent unless later concealment rules explicitly state otherwise;
- harvested/destroyed Genetics leave or transform according to SC-1.8 and effect text;
- collectible scarcity or edition has no effect on genetic yield or competitive statistics.

## 7. OPERATION

Operations are non-permanent tactical cards resolved through the Stack.

Rules:
- Operations are cast/played only at timing windows permitted by SC-1.3 and their CardDefinition;
- an Operation enters the Stack after legal announcement and cost payment;
- targets and modes are locked according to Stack rules in SC-1.6;
- after resolving, an Operation normally moves to its owner's Discard;
- if countered, canceled, or otherwise prevented from resolving, its destination is determined by the effect/rules, defaulting to Discard;
- Operations cannot remain on the battlefield merely because their effect has duration; durations are represented by deterministic effects/state, not illegal zone residency.

## 8. GEAR

Gear is a persistent attachment, including V1 Chrome cybernetics.

Rules:
- Gear attaches only to legal hosts defined by the Gear CardDefinition;
- an attachment must maintain an explicit host relationship;
- unattached Gear cannot remain in an attached state;
- if a host becomes illegal or leaves play, attachment cleanup is deterministic;
- default cleanup sends Gear to its owner's Discard unless rules text provides another destination;
- Gear may modify characteristics, grant abilities, or create activated/triggered effects;
- Chrome is represented as `cardType=GEAR` plus a `CHROME` subtype/tag;
- wallet ownership cannot improve Gear statistics or granted abilities.

## 9. CONTRABAND

Contraband is a high-risk card class whose power is explicitly coupled to Heat/exposure mechanics.

Rules:
- Contraband may be permanent or non-permanent only where its CardDefinition explicitly declares the legal resolution behavior;
- Contraband must have an explicit Heat interaction: generation, threshold dependency, exposure risk, enforcement vulnerability, or another SC-1.4-compatible risk mechanic;
- Contraband cannot bypass Heat accounting through cosmetic/collectible metadata;
- permanent Contraband must declare its legal zone/host rules;
- non-permanent Contraband resolves through the Stack and normally moves to Discard;
- Contraband is not automatically stronger than other card classes; power remains a balance/content concern.

## 10. Subtypes and tags

Primary card type controls core engine behavior. Subtypes/tags refine content identity without silently overriding the primary type contract.

Examples:
- GEAR / CHROME
- OPERATIVE / HACKER
- OPERATIVE / GROWER
- INFRASTRUCTURE / LAB
- INFRASTRUCTURE / SAFEHOUSE
- GENETIC / SEED
- GENETIC / CLONE

A subtype cannot grant placement, timing, or persistence semantics unless those semantics are explicitly referenced by rules or effects.

## 11. Zone legality matrix

Baseline V1 legality:

- Leader: Leader Zone only by default.
- Operative: Deck, Hand, Stack while being played if required by implementation, legal battlefield/Street position, Discard, Exile.
- Infrastructure: Deck, Hand, Stack while being played if required, Operation or other explicitly legal permanent location, Discard, Exile.
- Genetic: Deck, Hand, Stack while being played if required, Cultivation slot, Discard, Exile.
- Operation: Deck, Hand, Stack, Discard, Exile; never a battlefield permanent by default.
- Gear: Deck, Hand, Stack while being played if required, attached-to-host state, Discard, Exile.
- Contraband: Deck, Hand, Stack, plus only its explicitly declared resolved zone/attachment state, Discard, Exile.

The engine MUST reject illegal type/zone combinations unless a resolving rule effect explicitly authorizes the transition.

## 12. Ownership vs control

Ownership is stable match identity derived from deck construction or deterministic card creation.
Control may change during a match.

Rules:
- zone destination rules that say "owner's" always resolve against ownerPlayerId, not controllerPlayerId;
- control changes do not rewrite ownership;
- control changes must be event-sourced and replayable;
- collection/NFT ownership outside the match is not consulted by the hot match engine once the legal deck snapshot has been admitted.

## 13. CardDefinition vs Edition vs Printing

The authoritative separation is:

CardDefinition -> gameplay semantics
Edition -> release/set/cosmetic metadata
Printing -> a collectible copy/serial/token representing an edition

Multiple editions/printings MAY map to one CardDefinition.

The following MUST be identical across all legal competitive printings of the same CardDefinition:
- costs
- base statistics
- targeting rules
- keywords
- effect semantics
- resource interactions
- deckbuilding identity
- RNG behavior

Cosmetic variation may include:
- artwork
- frame treatment
- foil/animation
- serial/provenance
- set symbol
- cosmetic audio/VFX

## 14. Tokens and generated objects

Rules/content may create deterministic non-deck CardInstances such as temporary Operatives or other tokens.

Generated objects:
- must reference an immutable generated-object definition;
- must have deterministic instance IDs or derivation inputs;
- cannot correspond to wallet/NFT ownership merely because they exist in a match;
- cease to exist or move to the appropriate terminal zone according to their definition when they leave valid play.

## 15. Copy and transformation semantics

Copying a card copies only the gameplay characteristics explicitly defined by the copy effect and rules engine.
It MUST NOT copy:
- wallet ownership
- edition/printing rarity
- provenance
- serial number
- marketplace metadata

Transformation changes match-local characteristics/state and does not mint or mutate collectible ownership.

## 16. Rules authority and content data

Card content MUST be declarative against versioned engine capabilities where practicable.
No card may execute arbitrary client-authoritative logic.

The server/authoritative rules engine validates:
- type legality
- timing
- targets
- zones
- costs
- effect capability
- state transitions

Unsupported effect primitives fail closed during content validation rather than behaving differently across clients.

## 17. SC-1.5 invariants

SC-INV-CARD-001 — Every playable card has exactly one canonical primary V1 card type.

SC-INV-CARD-002 — A CardInstance's gameplay behavior derives from CardDefinition and match-local state, never collectible metadata.

SC-INV-CARD-003 — Illegal type/zone combinations cannot persist in authoritative state unless explicitly authorized by an in-flight deterministic rule effect.

SC-INV-CARD-004 — Control changes never mutate ownerPlayerId.

SC-INV-CARD-005 — Every attachment has either one legal host or is deterministically cleaned up.

SC-INV-CARD-006 — Operations are non-permanent by default and cannot remain on the battlefield after resolution without an explicit different card type/state transition.

SC-INV-CARD-007 — Every V1 Contraband definition exposes a valid SC-1.4 Heat/risk interaction.

SC-INV-CARD-008 — Different editions/printings of the same CardDefinition are competitively identical.

SC-INV-CARD-009 — Generated/token objects are deterministic match objects and do not imply blockchain ownership.

SC-INV-CARD-010 — Card type, subtype, ownership, control, zone, attachment, copy, and transformation changes are replayable from the authoritative event log.

## 18. SC-1.5 acceptance criteria

SC-1.5 is complete when:
- the seven V1 primary card types are frozen;
- Chrome is frozen as a Gear subtype;
- baseline zone legality is explicit;
- ownership/control semantics are explicit;
- attachment cleanup semantics are explicit;
- CardDefinition/Edition/Printing separation is explicit;
- generated objects and copy/transformation boundaries are explicit;
- invariants SC-INV-CARD-001 through 010 are accepted as downstream engine requirements.

## Next

SC-1.6 — Stack / priority system.
