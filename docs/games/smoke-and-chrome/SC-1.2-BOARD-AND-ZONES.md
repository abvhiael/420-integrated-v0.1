# Smoke & Chrome — SC-1.2 Board Layout & Zones

Status: FROZEN FOR V1
Phase: SC-1.2
Depends on: SC-1.1 Victory Conditions & Match Objective Model

## 1. Purpose
SC-1.2 defines the canonical V1 battlefield topology and zone model used by the deterministic match engine. It intentionally defines spaces and visibility without locking card taxonomy beyond what is necessary for spatial legality.

## 2. Battlefield topology
A standard 1v1 match contains:

- three shared Districts arranged left / center / right;
- one Street lane associated with each District;
- one private Operation zone per player;
- one Cultivation row per player;
- one Leader zone per player;
- one shared Stack;
- one Deck, Hand, Discard and Exile zone per player.

Canonical logical topology:

PLAYER A
Leader | Operation | Cultivation
         \    |    /
Street L — District L
Street C — District C
Street R — District R
         /    |    \
Leader | Operation | Cultivation
PLAYER B

The visual client may render this differently, but logical adjacency and ownership must remain equivalent.

## 3. Districts
Districts are the canonical shared territorial objectives for SC-1.1 Dominance.

V1 rules:
- exactly 3 active Districts in a standard match;
- each District has a stable District ID;
- each District tracks contested-control state and Influence totals separately from card occupancy;
- District control is derived by rules, never directly assigned by the UI;
- Districts are public information;
- District identity may alter rules, rewards or resource behavior in later phases, but SC-1.2 only freezes their spatial role.

A player achieving the SC-1.1 Dominance threshold must do so through canonical District-control state.

## 4. Streets
Each District has one associated Street lane.

Streets are the primary contested deployment/combat space for mobile battlefield entities.

V1 rules:
- exactly 3 Street lanes, each bound one-to-one to a District;
- entities on a Street are public;
- Street occupancy and lane position are deterministic state;
- movement between Streets is illegal unless an effect explicitly permits it;
- attacks and contests against a District originate through that District's associated Street unless a rule explicitly overrides this;
- no implicit adjacency exists between left/center/right Streets.

This avoids hidden geometric assumptions in the client.

## 5. Operation zone
Each player has one Operation zone.

Purpose:
- represents that player's persistent home-base infrastructure and support area;
- is owned by exactly one player;
- is not itself a District and does not count toward Dominance;
- is public unless an individual effect explicitly creates concealed state;
- may contain persistent assets that are legal for the zone under later card-taxonomy rules.

The Operation zone cannot be directly occupied by opposing battlefield entities unless a later explicit rule introduces such an effect.

## 6. Cultivation row
Each player has one Cultivation row containing a fixed set of cultivation slots.

V1 slot count: 3 cultivation slots per player.

Rules:
- each slot has a stable slot index 0..2;
- each slot contains at most one active cultivation object unless a future explicit ruleset version changes capacity;
- cultivation state is public once planted unless an effect explicitly marks information concealed;
- cultivation stages and production rules are deferred to SC-1.8;
- empty slots are canonical state, not inferred from UI rendering;
- opposing objects may not occupy a cultivation slot.

## 7. Leader zone
Each player has one Leader zone.

Rules:
- the player-designated Leader begins here;
- the Leader zone is public;
- the Leader is logically distinct from Street occupancy unless a later rule explicitly deploys or transforms it;
- Leader state may affect Collapse or other victory semantics in later phases, but SC-1.2 does not redefine SC-1.1 terminal conditions.

## 8. Deck
Each player has exactly one ordered Deck zone.

Visibility:
- card count: public;
- card identities/order: hidden from the opponent unless an effect reveals them;
- owner may not inspect arbitrary order unless an effect permits it.

The deterministic engine must track full order even when clients receive redacted views.

## 9. Hand
Each player has exactly one Hand zone.

Visibility:
- hand size: public;
- card identities: private to owner unless revealed by effect;
- ordering in the visual hand has no gameplay meaning unless a later rule explicitly defines it.

## 10. Discard
Each player has one Discard zone.

V1:
- public information;
- ordered by entry sequence for deterministic replay;
- top/bottom semantics may be referenced by rules later;
- cards in Discard are not considered in play unless an effect explicitly references them.

## 11. Exile
Each player has one Exile zone.

V1:
- public by default;
- ordered deterministically;
- represents objects removed from ordinary recursive reuse;
- effects may define face-down exile later, but that requires explicit hidden-state metadata.

## 12. Shared Stack
The Stack is one shared ordered resolution zone.

V1:
- public;
- last-in, first-out unless a later SC-1.6 rule explicitly defines exceptions;
- contains pending actions/effects, not physical battlefield occupancy;
- priority and response windows are deferred to SC-1.6;
- terminal-state evaluation must not partially resolve a Stack item.

## 13. Zone transitions
Every stateful object transition must identify:

- object ID;
- source zone;
- destination zone;
- source slot/lane if applicable;
- destination slot/lane if applicable;
- transition cause/action ID;
- deterministic ordering index.

No client may directly mutate occupancy.

Illegal transitions fail closed.

## 14. Visibility classes
SC-1.2 defines three visibility classes:

PUBLIC
- Districts
- Streets
- Operation zones
- Cultivation rows/slots after placement
- Leader zones
- Discard
- default Exile
- Stack
- deck/hand counts

OWNER_PRIVATE
- own Hand identities
- own hidden information explicitly granted by rules

ENGINE_SECRET
- Deck order and other hidden deterministic state not exposed to either player absent a rules effect.

Clients must receive scoped projections rather than full authoritative state.

## 15. Object identity and occupancy
Every in-match object has a stable match-local object ID.

An object may occupy exactly one canonical zone at a time unless it is represented as a non-card rules object explicitly designed to have references elsewhere.

Aliases, UI clones and animations cannot create additional authoritative occupancy.

## 16. Zone capacity
Frozen V1 capacities where needed for engine construction:

- Districts: 3 shared objectives
- Streets: 3 lanes
- Cultivation slots: 3 per player
- Leader slots: 1 per player
- Deck: unbounded by zone, deck-size limits deferred to SC-1.10
- Hand: no SC-1.2 hard cap; hand-size rules deferred
- Operation: capacity deferred to card/rules phases
- Discard: unbounded
- Exile: unbounded
- Stack: unbounded logically, guarded by engine recursion/complexity limits later

## 17. Match-state projection
Authoritative state stores all zones.

Player/client views are derived projections:

AuthoritativeState -> PlayerAView
                   -> PlayerBView
                   -> SpectatorView
                   -> ReplayView

No hidden information may be reconstructed from identifiers, ordering metadata, serialization shape or deterministic hashes exposed to unauthorized viewers.

## 18. SC-1.2 invariants
SC-INV-ZONE-001: Every authoritative match object occupies at most one canonical zone at a time.

SC-INV-ZONE-002: A standard V1 match exposes exactly three Districts and three one-to-one associated Streets.

SC-INV-ZONE-003: District control used for Dominance is derived from canonical District state, never client presentation state.

SC-INV-ZONE-004: Hidden Deck/Hand information is absent from unauthorized player and spectator projections.

SC-INV-ZONE-005: Every zone transition is deterministic, attributable to an action/effect and replayable.

SC-INV-ZONE-006: Opposing entities cannot occupy another player's Operation, Cultivation or Leader zone absent an explicit rules override.

SC-INV-ZONE-007: Cultivation slot occupancy is at most one active cultivation object per slot in V1.

SC-INV-ZONE-008: Stack contents are public and totally ordered for deterministic resolution.

SC-INV-ZONE-009: UI layout cannot create, remove or redefine logical adjacency between canonical zones.

SC-INV-ZONE-010: Terminal evaluation never observes a partially applied zone transition or partially resolved Stack item.

## 19. Non-goals
SC-1.2 does not yet freeze:
- turn order;
- resource generation;
- card taxonomy;
- priority windows;
- combat damage;
- cultivation stage timing;
- exact District-control math;
- deckbuilding constraints;
- starting hand size;
- maximum hand size.

Those remain in later SC-1 slices.

## 20. Exit criteria
SC-1.2 is complete when:
- board topology is explicit and implementation-safe;
- every canonical zone has ownership and visibility semantics;
- District/Street relations support SC-1.1 Dominance;
- hidden information boundaries are defined;
- transitions are deterministic and replayable;
- V1 spatial invariants are enumerated;
- later rules phases can reference stable zone IDs without redesigning topology.
