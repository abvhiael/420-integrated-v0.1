---
title: CI-SOL-02 dependency-aware Solidity qualification
audience:
  - developer
  - operator
category: contributing
status: current
version: current
---

# CI-SOL-02 — Dependency-aware Solidity qualification

## Stack and rollout
This change is stacked on CI PR #884 and must not be merged before its base is reconciled. `Solidity Qualification Summary` is an **experimental candidate check** until end-to-end Level 1, Level 2 and Level 3 complete on exact commits. Do not change protected branch required checks or waive `Solidity Contracts` from this change alone.

## Partition contract
`contracts/config/sol02-groups.json` owns stable explicit module boundaries: High Country competition, land, cultivation, economy, treasury, remaining High Country, 420BET, protocol treasury, compute, identity, DeFi, creative, services, infrastructure, residual protocol ownership and integration. The longest specific path prefix wins; fallback general protocol tests remain in the protocols group. Every primary source, test and script appears in exactly one partition, including legacy unit and script inventory. Shared imports remain accessible in the same working tree and must be compiled through import closure in each affected module. An unknown, mixed-domain, shared-security or workflow-policy edit expands to full group qualification; no exclusion by default.

## Qualification
`sol02-plan.py` emits an exact commit, profile, module list and SHA256 digest of the full inventory; the Level 1 suite verifies exhaustive assignment and adversarial selector behavior. Module jobs run targeted `forge build` on their own assigned primary targets followed by `forge test --no-compile` for each retained test. Each module caches its isolated Foundry output using OS, toolchain, module, profile, configuration and exact SHA.

`Solidity Qualification Summary` rejects missing, duplicate, stale-SHA, mixed-profile, wrong-target, failed and mismatched-inventory group artifacts; this is an evidence-gathering CI check, not an override for protected branch rules.

## Level 3 coverage limitation
The deterministic full-inventory partition includes all `src/`, `test/` and `script/` Solidity entries, but **full coverage instrumentation and the canonical Decision #10 fixture are still owned by the legacy Level 3 qualifier**. Do not treat successful inventory reconciliation as equivalent to proven runtime coverage. Until a Level 3 per-group coverage and aggregation implementation is shown equal to the legacy coverage baseline, the original Level 3 is mandatory for release approval.

## Runner shutdowns
SIGTERM / exit 143 does not prove memory exhaustion. Preserve log timestamps, cancellation state and runner telemetry. Do not rerun the same four large shards blindly.

## Branch protection
After new Level 1 selector, Level 2 cross-module tests and all Level 3 coverage/fixture equivalence checks succeed against audited SHAs, propose a separate authorized branch protection migration. The existing required checks remain unchanged in this phase.

## Protocol split evidence (2026-10-27)
The former `420protocols` catch-all hit a GitHub runner termination (exit 143) on PR #888 run `40571561243`. This changes only primary assignment, not the full canonical inventory: separate identity, DeFi, creative, services and infrastructure groups are checked alongside a conservative protocol-misc remainder. Level 1 regression fixtures ensure distinct source/test ownership and no file loss. Passing groups on the prior SHA `ce8111f7009804b1f3548b8010c20b2a380d63c1` remain historical evidence and do not qualify this changed SHA. The separate 420BET bounded job also failed, but its job log endpoint returned a GitHub artifact 404 (`BlobNotFound`) when investigated; without those logs its exact cause is unconfirmed, and no 420BET assertions were modified.

## Candidate runtime evidence and Decision #10 parity (pending qualification)
The isolated acceptance implementation records individual Foundry-discovered and executed test identifiers for every selected test file. The evidence aggregator rejects missing, failed, duplicated, or mismatched runtime identities and preserves source-only partition records without inventing test passes. Target-count-only declarations are no longer sufficient.

The Level 2 runner executes the original four cross-module Solidity test files under a pinned SHA, captures their real Foundry results and records the independent Solidity source-family import closures. A source import alone is not proof that every interaction occurred; runtime test success remains mandatory.

The Decision #10 parity step reuses the **same** `Decision10DeploySeed420` harness and the canonical fixture assertions from the legacy `contracts-foundry.yml` workflow, and saves the fixture and source hashes. This checks canonical harness/semantic equivalence; it does not assert byte-identical outputs against an unrelated legacy commit. The original mandatory Level 3 coverage instrumentation and branch protection remain unchanged until exact-SHA group coverage is qualified and reconciled to the canonical legacy coverage baseline.

Use the branch-specific isolated acceptance workflow for Level 1 and the affected Level 2/Decision #10 qualification. Do not infer release qualification from a passing helper-unit-test run.
