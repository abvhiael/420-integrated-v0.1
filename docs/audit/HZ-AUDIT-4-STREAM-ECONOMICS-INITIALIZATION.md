# HZ-AUDIT-4 — STREAM economics initialization

Status: COMPLETE — Level 1 qualified on exact implementation SHA `4fbf1070c6f297735985cb150cadeb4ead463a23`.

## Canonical purpose

HZ-AUDIT-4 closes the STREAM royalty-schedule initialization gap deliberately handed off by HZ-AUDIT-2 and HZ-AUDIT-3.

The canonical HZ-4 settlement architecture already routes allocated streaming revenue through:

`StreamingRoyaltySettlement420 -> RoyaltyRouter420 -> RoyaltyVault420`

PR #105 states that HZ-4.3 preserves the existing canonical work/source/current/protocol split rather than creating a second royalty system.

HZ-AUDIT-4 therefore defines and qualifies the versioned `RevenueType.STREAM` schedules required by `RoyaltyRouter420`.

## Repository-grounded economic basis

The audited Decision #10 kernel contains explicit canonical split terms for two RecordingClass values:

- `ORIGINAL`: 1,250 bps Work / 0 bps Source / 8,500 bps Current Recording / 250 bps Protocol.
- `REMIX`: 1,000 bps Work / 1,500 bps immediate Source Recording / 7,250 bps Current Recording / 250 bps Protocol.

Those exact splits are already retained for Decision #10 direct-sale/remix-license economics.

No repository authority defines economic splits for the other RecordingClass values. HZ-AUDIT-4 therefore treats **ORIGINAL and REMIX as the only currently supported STREAM classes**. It does not silently clone, infer, or invent economic terms for COVER, STEM_REMIX, SAMPLE_DERIVATIVE, AI_DERIVATIVE, LIVE, ACOUSTIC, REMASTER, RADIO_EDIT, CLEAN_EDIT, SPATIAL, RESTORATION, or OTHER.

Unsupported classes fail closed because no version-1 STREAM schedule exists for them.

## Canonical STREAM v1 schedules

### ORIGINAL / STREAM / v1

- Work: 1,250 bps
- Source: 0 bps
- Current Recording: 8,500 bps
- Protocol: 250 bps
- Total: 10,000 bps
- Version: 1
- Effective at: 0
- Revenue type: `STREAM`

### REMIX / STREAM / v1

- Work: 1,000 bps
- Immediate Source Recording: 1,500 bps
- Current Recording: 7,250 bps
- Protocol: 250 bps
- Total: 10,000 bps
- Version: 1
- Effective at: 0
- Revenue type: `STREAM`

The 250-bps protocol share remains below the kernel's 500-bps protocol-fee cap.

The REMIX source share preserves the existing one-hop immediate-source model. No recursive royalty routing is introduced.

## Effective-at policy

STREAM schedule version 1 uses the explicit deterministic value:

`effectiveAt = 0`

This is not an unknown or placeholder live timestamp. It means the version-1 schedule is immediately effective once governance successfully registers it. Using a deterministic zero value avoids environment-clock-dependent repository configuration while preserving the router's existing `block.timestamp >= effectiveAt` rule.

Any later schedule version may adopt a nonzero governance-selected activation time, but that would be a distinct version and requires its own retained terms/evidence.

## Terms-hash commitment

Each schedule commits the complete economic identity:

`keccak256(abi.encode("420.hz.stream.schedule.v1", RecordingClass, RevenueType.STREAM, workBps, sourceBps, currentRecordingBps, protocolBps, version, effectiveAt))`

This binds:

- domain/version family;
- RecordingClass;
- STREAM revenue type;
- every basis-point field;
- schedule version;
- exact effective-at value.

Changing any economic or identity field changes the terms hash.

## Retained implementation

- `contracts/src/creative/economics/HzStreamEconomicsPlan420.sol`
  - canonical ORIGINAL and REMIX STREAM v1 schedules;
  - exact deterministic effective-at values;
  - exact full-field terms-hash commitments;
  - explicit supported-class predicate;
  - fail-closed schedule lookup for unsupported classes.

- `contracts/config/creative/420hz-stream-economics-bundle.json`
  - machine-readable supported/unsupported class inventory;
  - exact split terms;
  - exact version/effective-at policy;
  - terms-hash formula/preimages;
  - governance initialization sequence;
  - routing preconditions and safety invariants;
  - empty live/testnet evidence fields.

- `contracts/test/HzStreamEconomics420.t.sol`
  - exact schedule term/hash assertions;
  - governance-only registration;
  - duplicate/version replay rejection;
  - invalid 10,000-bps total rejection;
  - protocol-fee-cap rejection;
  - unsupported-class schedule absence;
  - real `RoyaltyRouter420` STREAM routing for ORIGINAL and REMIX;
  - exact Work/Source/Current/Protocol amounts;
  - exact 200-native-420 aggregate gross conservation across the two focused routes.

- `scripts/verify-420hz-audit-4-stream-economics.py`
  - checks the retained bundle against Decision #10 canonical splits;
  - validates supported and unsupported RecordingClass inventory;
  - validates version/effective-at/hash policies;
  - checks Registry/Router/Streaming adapter safety dependencies;
  - checks focused-test coverage markers;
  - rejects fabricated live evidence.

- `.github/workflows/420hz-audit.yml`
  - runs the HZ-AUDIT-4 verifier;
  - formats/builds the affected economics plan;
  - retains HZ-AUDIT-2 and HZ-AUDIT-3 regressions;
  - runs `HzStreamEconomics420Test` on the exact qualification head.

## Governance initialization sequence

Governance must register exactly:

1. `RoyaltyScheduleRegistry420.registerSchedule(RecordingClass.ORIGINAL, RevenueType.STREAM, HzStreamEconomicsPlan420.originalSchedule())`
2. `RoyaltyScheduleRegistry420.registerSchedule(RecordingClass.REMIX, RevenueType.STREAM, HzStreamEconomicsPlan420.remixSchedule())`

The Registry is immutable by schedule key/version: attempting to register the same class/revenue/version twice must fail.

HZ-AUDIT-3 already retains the separate required Router authority action:

`RoyaltyRouter420.setSettlementSource(StreamingRoyaltySettlement420, true)`

HZ-AUDIT-4 does not duplicate ownership of that authority wiring.

## Safety and accounting invariants

- each supported schedule totals exactly 10,000 bps;
- protocol fee is 250 bps and remains <= 500 bps;
- ORIGINAL has zero source share;
- REMIX has the canonical 1,500-bps immediate-source share;
- schedule v1 is immutable/replay protected by schedule key;
- unsupported classes have no STREAM schedule;
- `RoyaltyRouter420` resolves the schedule using RecordingClass + STREAM + Recording royaltyScheduleVersion;
- exact gross input is conserved across Work, immediate Source, Current Recording and Protocol destinations;
- no second streaming royalty ledger or payout system is introduced;
- no test/local result is promoted to live transaction evidence.

## Live evidence boundary

Repository initialization is qualified here. Actual public-testnet execution evidence remains HZ-AUDIT-7.

Until that step, the retained bundle keeps empty/null:

- live network/chain ID;
- deployed RoyaltyScheduleRegistry address;
- schedule-registration transactions;
- live schedule reads;
- STREAM routing transactions;
- live RoyaltyVault balance evidence.

## Level 1 exit criteria

HZ-AUDIT-4 is COMPLETE only when one exact implementation SHA passes:

- `scripts/verify-420hz-audit-4-stream-economics.py`;
- affected Solidity format/build;
- retained HZ-AUDIT-2 deployment regression;
- retained HZ-AUDIT-3 authority/Registry regression;
- `HzStreamEconomics420Test`;
- directly applicable canonical Solidity contract CI triggered by the PR shape.

## Milestone status

Level 2 is not required for HZ-AUDIT-4 by itself. The more useful integration boundary is after HZ-AUDIT-5, when consolidated deployment, authority wiring, STREAM economics and deployment-smoke behavior have converged.

Level 3 remains deferred to the single complete 420Hz audit-phase closeout.

## Next canonical roadmap step

**HZ-AUDIT-5 — Deployment smoke qualification.**


## Durable qualification evidence

- Roadmap step: `HZ-AUDIT-4 — STREAM economics initialization`
- Status: **COMPLETE**
- Qualification level: **Level 1**
- Qualified implementation SHA: `4fbf1070c6f297735985cb150cadeb4ead463a23`
- Audit branch: `feature/420hz-remediation-20261006`
- Pull request: **#556**
- Qualification merge-base/base SHA: `ff4440bfd7b69c0712ee3dd7c4b417cb049ae76d`
- Current `main` observed at closeout: `5273dd9330c889c16327fb4f4be6e07bc02ce2bd`
- Current branch/main state at closeout: diverged; branch is 46 commits ahead and 85 commits behind current `main`.
- PR #556 is currently reported non-mergeable against the advanced base. This does not invalidate exact-head HZ-AUDIT-4 qualification; reconciliation remains deferred to the applicable later integration/Level-3 merge-candidate qualification unless HZ-AUDIT-5 materially requires earlier convergence.

### Level 1 results

Exact-head qualification on `4fbf1070c6f297735985cb150cadeb4ead463a23` completed successfully:

- 420Hz Audit Qualification — run `37578726980`, job `112653340231` (`hz-audit-fast`) — **PASS**
  - exact qualification-head checkout — PASS
  - exact-head verification — PASS
  - HZ-AUDIT-2 deployment-package verifier — PASS
  - HZ-AUDIT-3 authority/Registry verifier — PASS
  - HZ-AUDIT-4 STREAM-economics verifier — PASS
  - affected Solidity format check — PASS
  - consolidated deployment/economics build — PASS
  - retained `HzDeploymentGraph420Test` regression — PASS
  - retained `HzRegistryAuthority420Test` regression — PASS
  - focused `HzStreamEconomics420Test` — PASS
- Solidity Contracts — run `37578727087` — **PASS**
  - classification `112653560223` — PASS
  - shard 0 `112653607309` — PASS
  - shard 1 `112653607344` — PASS
  - shard 2 `112653607415` — PASS
  - shard 3 `112653607371` — PASS
  - monolithic `foundry` `112653561092` — expected SKIP under PR shard routing
  - `compute-fast` `112653608926` — expected SKIP as irrelevant to this PR shape
- Supplementary same-SHA workflows also passed:
  - Genesis Address Authority `37578727045`
  - 420Docs Qualification `37578727013`
  - 420Registry REG-AUDIT-4 `37578726958`
  - 420Indexer `37578727029`
  - Creative Reference Indexer `37578727012`
  - 420Oracle audit qualification `37578727001`

The supplementary workflows are retained as corroborating evidence only and are not promoted into mandatory ordinary-step exit criteria beyond their actual changed-dependency relevance.

### Exit criteria satisfied

HZ-AUDIT-4 now has durable repository evidence that:

1. the supported STREAM RecordingClass inventory is explicit and repository-grounded;
2. ORIGINAL and REMIX STREAM version-1 schedules preserve the canonical Decision #10 split terms;
3. each supported schedule totals exactly 10,000 bps and the protocol fee remains within the 500-bps kernel cap;
4. `effectiveAt = 0` is retained as an explicit deterministic v1 activation rule rather than an unknown live placeholder;
5. terms hashes commit the class, STREAM revenue type, all split fields, version and effective-at value;
6. governance-only registration is enforced and duplicate schedule/version registration fails closed;
7. unsupported RecordingClass values receive no invented STREAM economics and fail closed;
8. real `RoyaltyRouter420` STREAM routing preserves the canonical Work/Source/Current/Protocol split;
9. focused routing proves exact gross-value conservation and the REMIX one-hop source share;
10. no local test result or repository configuration is promoted to live/testnet schedule-registration or payout evidence;
11. the exact implementation SHA passed the HZ verifier/format/build/regression/focused-test gate and canonical Solidity PR shards.

### Milestone and phase qualification status

Level 2: **not required for this ordinary roadmap step**. The next meaningful retained app-integration boundary remains after HZ-AUDIT-5, when consolidated deployment, authority wiring, STREAM economics and deployment-smoke behavior have converged.

Level 3: **intentionally deferred** to the single complete 420Hz audit-phase closeout.

Live schedule-registration transactions, deployed Registry addresses, live schedule reads, STREAM routing receipts and RoyaltyVault balance evidence remain **HZ-AUDIT-7** obligations and are not claimed complete here.

### Evidence-only closeout rule

This COMPLETE bookkeeping changes documentation/evidence only. It does not modify executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive requirements. Therefore the qualified implementation SHA remains `4fbf1070c6f297735985cb150cadeb4ead463a23`; no recursive substantive test run is required for these evidence-only closeout commits.

## Next canonical roadmap step

**HZ-AUDIT-5 — Deployment smoke qualification.**
