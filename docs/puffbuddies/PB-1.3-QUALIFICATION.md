# PB-1.3 qualification evidence

## Step
**PB-1.3 — Private Persistence Schema — COMPLETE**

## Qualification level
**Level 1 — per-roadmap-step fast qualification**

## Implementation summary
Defines the storage-neutral canonical private PuffBuddies schema for profile, minimum-disclosure eligibility projection, preferences, visibility, relationship, safety, lifecycle, location, cannabis, and matching inputs. The final correction adds a canonical `version` token to matching-input state so that the row itself, as well as its source component versions, supports stale-state invalidation.

## Files changed
- `puffbuddies/persistence/__init__.py`
- `puffbuddies/persistence/schema.py`
- `puffbuddies/tests/test_pb_1_3_persistence_schema.py`
- `.github/workflows/puffbuddies-pb1.yml`
- `docs/puffbuddies/PB-1.3-PRIVATE-PERSISTENCE-SCHEMA.md`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`

## Requirements satisfied
All canonical private state classes are represented; raw identity evidence, wallet secrets/linkage, public precise location, public relationship graphs and external/derived authority are excluded; ordinary state is deletion-classed; safety retention is purpose-limited; canonical rows carry version/invalidation material; no public table, contract, address, service ID, API, migration, deployment or live database integration is introduced.

## Failure diagnosis and correction
Initial exact-head run `37414592758` correctly found that `matching_input` lacked its own version token. SHA `8d65bf2be5ef4fe621a1813433943b6183b059ce` corrected that defect and all 29 retained tests passed, but run `37416124265` then exposed a CI harness false positive: the secret scanner interpreted forbidden schema field-name literals as actual secret material. The scanner was corrected to detect secret assignments/material and PEM private keys while preserving the explicit forbidden-field assertions. No product assertion was weakened or removed.

## Exact implementation evidence
- implementation SHA: `a9131d3810d23024de9e47e197707694da765c18`
- main SHA observed during final qualification: `f5fe16414893a1e4bd4f3db22eb36b685a2030f5`
- branch: `puffbuddies-pb1-domain-20261006`
- PR: #535
- current-main advancement contained no PuffBuddies implementation and no PB-1.3 live Search authority; no unrelated reconciliation was required for this Level-1 correction.

## Level 1 CI evidence
**PuffBuddies PB-1 Qualification**
- run: `37416181805` — SUCCESS
- job: `112115183368` (`pb1-fast`) — SUCCESS
- exact qualification head — PASS
- full PuffBuddies compile — PASS
- retained PB-1.1/PB-1.2 plus PB-1.3 tests — PASS (29 tests)
- public-chain/secret-material negative gate — PASS

## Security/adversarial/invariant results
PASS: private ownership, no public/external canonical tables, minimum-disclosure eligibility, wallet unlinkability, private relationship graph, no public precise coordinates/raw GPS history, purpose-limited safety retention, ordinary deletion classification, private cannabis state, version/invalidation coverage, and forbidden secret/public-identity material.

## Milestone status
PB-1.3 is not a Level 2 milestone. Level 2 remains deferred until the documented accumulated PB-1 domain/private-persistence milestone.

## Intentionally deferred Level 3 checks
Full Solidity inventory, Genesis/address authority, 420 Integrated/global, Geth/fault/soak, broad Docs/global reconciliation, unrelated apps, deployment and live/testnet qualification remain deferred because PB-1.3 introduces no applicable shared contract/address/deployment/live integration.

## Blockers
None for PB-1.3.

## Completion state
**COMPLETE** against implementation SHA `a9131d3810d23024de9e47e197707694da765c18`.
