# PB-1.1 — Domain types & boundaries

## Purpose
Establish the first executable PuffBuddies domain vocabulary and authority/data boundaries without prematurely implementing persistence, APIs, integrations, matching algorithms, or deployment.

## Requirements
1. Domain types cover profile, eligibility projection, preferences, visibility, lifecycle, relationship, safety, matching inputs, and cannabis taxonomy.
2. Dating/Buddy/Both and the PB-0.15 visibility vocabulary remain canonical.
3. PuffBuddies remains canonical owner of application membership, eligibility decision, profile/preferences, relationship, lifecycle, and safety state.
4. Wallet/Identity/Names/Messenger/Notifications/Pay authority remains bounded to its native domain.
5. Indexer/Search/Explorer/Analytics/client/cache/projection state remains derived and non-authoritative.
6. Sensitive state is private/off-chain by default; no public membership or relationship enumeration is introduced.
7. Cannabis compatibility remains optional and is not public/tokenized identity, medical/legal proof, or marketplace entitlement.
8. No fixed address, service ID, contract, database schema, migration, API, deployment, or live integration is created by PB-1.1.

## Affected components
- `puffbuddies/domain/types.py`
- `puffbuddies/domain/boundaries.py`
- `puffbuddies/tests/test_pb_1_1_domain.py`
- `.github/workflows/puffbuddies-pb1.yml`
- PB-1.1 roadmap/evidence documentation

## Qualification
Level 1 app-specific fast qualification. Level 2 is deferred until the accumulated PB-1 domain/private-persistence boundary is complete. Repository-wide Level 3 remains deferred to app-phase closeout.
