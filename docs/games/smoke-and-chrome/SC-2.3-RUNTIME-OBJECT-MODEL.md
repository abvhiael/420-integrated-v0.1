# SC-2.3 — Runtime Card / Object Instance Model

Status: FROZEN for Smoke & Chrome V1 asset/runtime foundation.

## Purpose

SC-2.3 defines the authoritative runtime object model that turns immutable CardDefinition content into mutable in-match entities without allowing collectible Edition/Printing metadata to contaminate competitive gameplay.

A runtime object is a match-scoped rules object. It is not a wallet asset, marketplace object, NFT, printing, or provenance record.

## Canonical boundary

The authoritative chain is:

CardDefinition -> RuntimeObject

Collectible metadata follows a separate path:

CardDefinition -> Edition -> Printing

A RuntimeObject MAY remember a non-authoritative cosmetic/reference handle for presentation outside the rules engine, but gameplay evaluation MUST depend only on CardDefinition data, match state, ruleset version, and deterministic effects.

## RuntimeObject identity

Every runtime object MUST have:

- objectId: stable match-scoped identifier
- definitionId: canonical CardDefinition id
- definitionRevision: pinned CardDefinition revision
- ownerPlayerId: immutable match owner except where a rule explicitly creates ownerless/system objects
- controllerPlayerId: mutable controller
- zone: canonical logical zone
- zoneIndex / lane / slot coordinates when applicable
- createdSequence: monotonic creation sequence
- generated: boolean
- sourceObjectId: optional source for generated/copied objects
- sourceAbilityId: optional originating ability

objectId MUST be unique within the match and MUST NOT derive from wallet address, printing serial, token id, marketplace id, or transaction hash.

## Mutable state

A RuntimeObject MAY contain the following mutable gameplay state:

- tapped/exhausted/readied state
- damageMarked
- counters keyed by canonical counter type
- temporary modifiers
- permanent-in-match modifiers created by rules
- attachment references
- attachedToObjectId
- face state where rules permit hidden/revealed transformations
- copiedDefinitionId / copiedDefinitionRevision where copy effects apply
- transformedDefinitionId / transformedDefinitionRevision where transform effects apply
- current controller
- lane/street position
- cultivation slot and cultivation stage
- attack/block participation flags
- once-per-turn / once-per-match usage markers
- effect-duration markers
- delayed trigger references

Fields not defined by the rules engine are non-authoritative.

## Owner vs controller

ownerPlayerId is immutable for ordinary deck-origin objects.

controllerPlayerId MAY change through explicit effects.

Changing controller MUST NOT mutate ownerPlayerId.

When an object changes zones, controller reset behavior MUST be deterministic and ruleset-defined. Unless an effect explicitly says otherwise, objects entering a player-owned hidden zone return to their owner’s control.

## Zone transitions

Every move MUST be represented as an explicit transition:

fromZone -> toZone

Each transition MUST record:

- objectId
- previous zone
- next zone
- reason code
- causing object/effect when applicable
- event sequence

Zone transitions MUST be deterministic and replayable.

An object cannot occupy two logical zones simultaneously.

## Zone-change identity semantics

V1 uses persistent match-scoped object identity across ordinary zone changes.

A move to another zone does NOT create a new objectId unless the rules explicitly say the old object ceases to exist and a generated/replacement object is created.

This allows replay, references, attachments, delayed effects, and audit logs to remain unambiguous.

## Damage and durability

Damage is runtime state and MUST NOT mutate the underlying CardDefinition.

For objects with DURABILITY:

- effective durability derives from CardDefinition plus deterministic modifiers
- damageMarked tracks damage received
- lethal evaluation occurs at defined state-based checkpoints
- damage cleanup timing follows the ruleset, not UI timing

For objects without durability, damageMarked MUST remain absent or zero unless an explicit rules effect permits otherwise.

## Counters

Counters MUST use canonical registry keys.

Each counter type MUST define:

- id
- stacking behavior
- visibility
- whether negative values are forbidden
- any special cleanup timing

Unknown counter types fail closed in competitive modes.

## Modifiers

Runtime modifiers MUST be explicit data objects, not opaque code.

Each modifier MUST include:

- modifierId
- sourceObjectId/sourceAbilityId when applicable
- affected object or scope
- characteristic/effect being modified
- operation/layer
- value or reference
- start sequence
- duration/end condition

Modifier application MUST follow the layer/order rules established by SC-2.2.

## Attachments

Attachments MUST be represented explicitly.

An attached object MUST reference its host through attachedToObjectId.

The host MAY maintain a deterministic ordered list of attachment objectIds for projection/performance, but attachedToObjectId is canonical.

If an attachment becomes illegal, cleanup MUST occur at the next defined state-based checkpoint.

Attachment legality MUST be determined by CardDefinition type/subtype plus explicit ability/effect rules.

## Generated objects and tokens

Generated objects MUST use canonical CardDefinition or GeneratedDefinition identities.

They MUST receive deterministic objectIds from match sequence, not random UUIDs.

Generated objects MUST identify their source and creation sequence.

Generated objects MUST NOT acquire blockchain ownership merely because they exist in a match.

By default, generated/token runtime objects cease to exist when they leave the battlefield-relevant zone specified by their definition, unless the rules explicitly permit persistence.

## Copies

Copy effects do not mutate the source definition.

A copying runtime object retains its own objectId and owner/controller state while deriving copied gameplay characteristics from a pinned canonical definition reference.

Copy effects MUST specify whether they copy:

- printed/base characteristics only
- base plus selected copiable values
- a named subset

Temporary modifiers, damage, counters, ownership, controller, printing metadata, and wallet metadata are NOT copied unless a rule explicitly and legally says so.

## Transformations

Transform effects MUST switch the runtime characteristic source to an allowed canonical definition/revision.

Transformation MUST NOT change objectId, ownerPlayerId, printing metadata, wallet ownership, or provenance.

Transform legality and reverse behavior MUST be deterministic.

## Hidden information projection

The authoritative engine may store hidden-zone objects, but client projections MUST respect SC-1.2 visibility rules.

Opponent projections MUST NOT leak hidden CardDefinition identity, printing identity, cosmetic metadata, random-order position, or other private state.

Object existence/count may be projected only where the rules permit it.

## Printing / edition isolation

The following MUST NOT exist in authoritative RuntimeObject gameplay state:

- rarity
- foil treatment
- serial number
- mint number
- NFT/token id
- wallet owner
- marketplace price
- sale history
- provenance chain
- edition supply
- signature/artist collectible metadata
- blockchain transaction data

Presentation layers may map a collection-owned Printing to a legal CardDefinition before match start, but once the match manifest is created, gameplay operates on CardDefinition/runtime identities only.

## Deterministic object creation

Runtime object creation MUST be a pure function of:

- pinned match manifest
- ordered action/event history
- deterministic RNG results when RNG is legitimately required
- monotonic creation sequence

No wall clock, UI event timing, wallet identity, network latency, or platform randomness may affect object identity or gameplay state.

## Runtime serialization

Authoritative runtime state MUST have canonical serialization for:

- replay snapshots
- desync detection
- state hashing
- reconnect recovery
- dispute/audit tooling

Map/object keys MUST be canonicalized and unordered collections MUST be sorted by documented stable keys before hashing.

## State hash scope

Competitive state hashes MUST include all authoritative gameplay state necessary to reproduce the match, including object runtime state.

They MUST exclude cosmetic/collectible metadata.

## Fail-closed behavior

Competitive matches MUST reject or halt on:

- unknown definition revision
- duplicate objectId
- illegal zone membership
- illegal attachment graph
- attachment cycles where forbidden
- unknown counter/modifier type
- invalid controller/owner reference
- non-canonical generated-object source
- malformed transform/copy reference
- impossible runtime state

## SC-2.3 invariants

SC-2.3-INV-001 — Runtime identity isolation: objectId MUST never depend on wallet, printing, token, serial, marketplace, or chain metadata.

SC-2.3-INV-002 — Definition immutability: runtime mutations MUST never alter CardDefinition data.

SC-2.3-INV-003 — Single-zone occupancy: an object MUST occupy exactly one canonical logical zone at a time.

SC-2.3-INV-004 — Owner stability: ordinary ownerPlayerId MUST remain immutable for the lifetime of a runtime object.

SC-2.3-INV-005 — Controller separation: control changes MUST NOT imply ownership changes.

SC-2.3-INV-006 — Deterministic creation: identical match inputs and ordered events MUST produce identical runtime objectIds and state.

SC-2.3-INV-007 — Replay completeness: every authoritative runtime mutation MUST be reconstructable from the event/action history or canonical snapshot.

SC-2.3-INV-008 — Printing neutrality: Edition/Printing metadata MUST NOT alter runtime stats, abilities, legality, targets, RNG, or sequencing.

SC-2.3-INV-009 — Attachment integrity: attachment relationships MUST be explicit, legal, and cleaned deterministically.

SC-2.3-INV-010 — Modifier explicitness: runtime modifiers MUST be structured, sourced, ordered, and duration-bounded where applicable.

SC-2.3-INV-011 — Hidden-state containment: projections MUST never expose hidden runtime identity beyond the rules-authorized viewer scope.

SC-2.3-INV-012 — Generated-object neutrality: generated match objects MUST NOT create ownership or economic rights outside the match.

SC-2.3-INV-013 — Canonical copy/transform: copy and transform operations MUST use pinned canonical definition references and deterministic semantics.

SC-2.3-INV-014 — Hash purity: gameplay state hashes MUST exclude cosmetic, wallet, marketplace, and provenance metadata.

SC-2.3-INV-015 — Fail closed: malformed or impossible runtime state MUST never be silently normalized in competitive execution.

## SC-2.3 closeout

SC-2.3 is complete when the engine/runtime implementation can instantiate, mutate, serialize, hash, replay, project, and validate RuntimeObjects according to this contract without introducing any dependency on Edition/Printing ownership metadata.
