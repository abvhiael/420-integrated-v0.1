# 420 Integrated Architecture Documentation

This directory is the canonical home for system-level architecture documentation for 420 Integrated.

## Start here

- [System overview](system-overview.md) — top-level system layers, authority model, trust boundaries, invariants, normal transaction flow, and genesis status.
- [System design principles](design-principles.md) — canonical architectural rules for authority, composability, provider neutrality, failure behavior, compatibility, recovery, and bounded privilege.
- [Genesis architecture](genesis-architecture.md) — launch-time composition, canonical genesis services, frozen assumptions, replaceable providers, startup dependencies, and genesis invariants.
- [System dependency map](dependency-map.md) — authoritative, derived, replaceable, and external dependencies; failure containment; dependency direction; and recovery ordering.
- [Trust-boundary model](trust-boundary-model.md) — custody, protocol, governance, provider, external-system, operator, and application trust crossings plus validation and compromise-containment rules.
- [Chain architecture](chain/index.md) — execution, accounts, transactions, blocks/state, gas/fees, native `$420`, and network configuration.
- [Consensus architecture](consensus/index.md) — validators, committees/cohorts, proposer scheduling, epochs, QCs/finality, rewards, slashing, failure, and recovery.
- [Architecture Decision Records](decisions/README.md) — accepted, proposed, superseded, and deprecated architectural decisions.

## Purpose

Architecture documentation explains how the system is designed, how components relate, where authority and trust boundaries live, and why important design choices were made. It is distinct from user guides, operator runbooks, and generated API/reference material.

## Canonical taxonomy

New architecture documentation should be placed under the following areas as they are populated:

- `chain/` — execution, accounts, transactions, blocks, state, fees, and native $420 behavior.
- `consensus/` — validators, proposer selection, epochs, rewards, finality, slashing, and consensus failure behavior.
- `protocols/` — protocol architecture such as Registry, Identity, Names, Randomness, Pay, Rights, Storage Proof, Resource Protocol, Verify, Arbitration, and Oracle Interface.
- `infrastructure/` — node software, indexing, gateways, storage, AI compute, and operator-facing network services.
- `applications/` — application-level architecture for genesis and ecosystem applications.
- `cross-cutting/` — authorization, security, governance, upgrades, emergency controls, observability, and versioning.
- `decisions/` — Architecture Decision Records (ADRs).

## Migration rule

Existing documents in `docs/` remain valid and should not be moved solely for taxonomy cleanup. They may be migrated into this hierarchy when they are materially revised and references can be updated safely. New architecture work should use this structure immediately.

## Architecture page requirements

Every architecture page should identify:

1. scope and intended audience;
2. component responsibilities and non-responsibilities;
3. dependencies and external interfaces;
4. authority and trust boundaries;
5. important invariants;
6. normal data/transaction flows;
7. failure and recovery behavior;
8. security assumptions;
9. version/genesis status where relevant;
10. links to applicable ADRs, user guides, operator guides, and reference documentation.

## Relationship to 420Docs

The Markdown source in this repository is canonical. 420Docs renders and indexes these files, but publication tooling does not become the authoritative source of architectural truth.
