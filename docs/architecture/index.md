# 420 Integrated Architecture Documentation

This directory is the canonical home for system-level architecture documentation for 420 Integrated.

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

The Markdown source in this repository is canonical. A future 420Docs site may render and index these files, but publication tooling must not become the authoritative source of architectural truth.