---
title: Solidity qualification boundaries
audience:
  - developer
  - operator
category: contributing
status: current
version: current
---

# Solidity qualification architecture — bounded PR selection (October 2026)

## Root cause and observed evidence
In HC-NEXT-7.3 PR #875 at exact SHA `9ac6dcc27e15cad6f69640d3d394ab326bc1eeb0`, the R04.12, HC-NEXT-7.1, HC-NEXT-7.3 Level 1, HC-NEXT-7.3 bounded Level 2 and R04 Level 2 workflows passed. Solidity Contracts workflow run 40459429060 failed in all four shards with runner SIGTERM / exit 143. Prior shards attempted roughly 770 Solidity compilations each, with distinct runner shutdowns. SIGTERM alone does not prove resource exhaustion, OOM or user cancellation.

The existing `contracts-foundry.yml` had `competition-fast`, but its hard-coded scope allowance only covered HC-NEXT-7.1 workflow and docs. Adding the HC-NEXT-7.3 dedicated workflow and documentation caused `competition_only=false` and entered repository-wide `pr-shards`.

## Change-aware qualification
`contracts/config/solidity-qualification-scopes.json` is a versioned allowlist with allowed changed paths, required source/test changes, shared dependencies and full-Level-3 closeout markers. The selection script is fail closed: unrecognized, cross-domain, shared-security, policy, CI-infrastructure and release-marker changes use the full inventory, not a pass-through. The canonical old classifications remain while the new map explicitly restores HC-NEXT-7.3 competition-only qualification.

A bounded competition job retains formatting, lint, source compilation, all competition adversarial tests and exact-head validation. `actions/cache` keys compile artifacts by OS, Foundry profile and exact SHA (not shared across different SHA inputs); all tests within this job reuse the same build output. No test exclusions or assertions are introduced.

## Runner failure diagnostics
Four-shard jobs now capture last-known memory, disk, ulimits, runner identification and SHA on failure. Such postmortem metrics cannot by themselves diagnose a runner already terminated; use GitHub runner telemetry and job log timestamps to distinguish termination from timeout, concurrency cancellation and resource pressure. Do not blindly rerun jobs that were terminated by GitHub runner shutdown.

## Full Level 3 remains mandatory
`workflow_dispatch`, deliberately named Level 3 audit branches and release/closeout markers keep the complete four-shard mandatory inventory and coverage aggregation. This CI refactor does not assert that the separate Level 3 resource problem has been solved. Its next infrastructure milestone is to refactor canonical Level 3 partitions by import closure (not merely number of entrypoint files), prove every primary source/test appears exactly once and prove shared imports compile correctly with smaller build graphs, then qualify coverage and the release fixture against exact SHA. Until then, full Level 3 may still need runner infrastructure attention.

## Retained historical evidence
PR #875 run 40459428931: HC-NEXT-7.3 Level 1 PASS.
Run 40459429120: HC-NEXT-7.3 bounded Level 2 PASS.
Run 40459429082: R04.12 PASS.
Run 40459428933: HC-NEXT-7.1 PASS.
Run 40459428930: R04 Level 2 PASS.
Run 40459429060: four large shard runs failed due to runner shutdown (exit 143).
These attest the earlier SHA only. Future CI refactor qualification uses its own exact head.
