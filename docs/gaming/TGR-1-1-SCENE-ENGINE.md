# TGR-1.1 — reusable hidden-object scene/domain engine

Status: implementation started
Depends on: TGR-0 architecture freeze

## Scope

TGR-1.1 implements the first reusable game-domain slice for The Green Road. It deliberately stays below presentation, persistence/sync and 420 Gaming integration layers.

This slice provides:

- versioned scene definitions;
- normalized circle and rectangle hit regions;
- fail-closed scene validation;
- deterministic scene state creation;
- monotonic hidden-object discovery;
- clue unlocking from explicit object prerequisites;
- completion derived from required hidden-object progress;
- coordinate-driven object discovery that ignores already-found objects.

## Boundary

The scene engine has no wallet, entitlement, identity, chain or portable-reward dependency. Ordinary hidden-object completion is derived only from the scene definition and the player's ordinary game-domain progress.

Portable rewards remain outside this module and must be validated through the authority boundaries frozen in TGR-0.

## Scene contract

A TGR-1.1 scene supplies:

- `schemaVersion`;
- immutable `id`;
- `contentVersion`;
- `hiddenObjects` with immutable IDs and normalized hit regions;
- `clues` with optional `requiresObjectIds` prerequisites;
- an `all-required-objects` completion rule.

Supported normalized hit regions are:

- circle: `cx`, `cy`, `radius`;
- rectangle: `x`, `y`, `width`, `height`.

All coordinates are expressed in normalized scene space, not device pixels.

## Invariants

- **TGR-INV-1101** Scene definitions fail closed when malformed or when clue/completion references point to unknown objects.
- **TGR-INV-1102** Hit testing is performed in normalized scene coordinates.
- **TGR-INV-1103** Object discovery is monotonic and duplicate discoveries are idempotent.
- **TGR-INV-1104** Clues unlock only when all declared object prerequisites are satisfied.
- **TGR-INV-1105** Scene completion is derived from the declared required-object set.
- **TGR-INV-1106** Already-found objects are excluded from subsequent coordinate discovery.
- **TGR-INV-1107** Ordinary scene state contains no wallet, entitlement or portable-value authority.
- **TGR-INV-1108** Unknown object events fail closed.

## Completion gate

TGR-1.1 is complete when the scene engine and focused tests are green under the Green Road integration workflow and repository-wide qualification, and the public contract above is documented.

The next slice can add richer interactables, clue actions and scene-transition orchestration without changing the TGR-0 authority model.
