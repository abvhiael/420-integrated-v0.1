---
title: Phase 2 Foundry Qualification Owner
status: active
category: contributing
version: current
---

# Phase 2 — Solidity CI runner consolidation (#884, #888)

The historic **SOL-01 change-aware scope selector** (PR #884) and **CI-SOL-02 dependency-aware group planner** (PR #888) are incompatible older qualification approaches, not two independent mandatory CI runners. Their older exact-head CI had failures on the full Foundry or summary jobs. Neither implementation is to overwrite the later Foundry runner.

**Canonical source of truth on this main:** `.github/workflows/contracts-foundry.yml` owns explicit complete Level 3, with deterministic four-way `contracts/scripts/qualify-foundry-shard.sh`, one primary source/test/script assignment, import-dependency compiler cache snapshots, per-file executed tests, bytecode-size checks, mandatory inventory equality and coverage aggregation through `contracts/scripts/coverage-foundry-shard.py` and `merge-coverage.py`.

**Scoped ownership:** `.github/workflows/reusable-scoped-foundry.yml` owns independently reported, exact-commit, test-path-bounded PR suites. Each caller is responsible for exact scope and acceptance; the universal scoped policy forbids substituting skipped/cancelled jobs for success. Scope selection is conservative. There is **no second SOL-02 global summary owner** or competing standalone selector on main.

**New local qualification:** `scripts/ci/verify-phase2-foundry-coherence.py` and `.github/workflows/phase2-foundry-coherence.yml` check the actual canonical runner wiring, mandatory inventory and coverage hooks, no legacy parallel runners, scoped SHA pinning, and exercise current `coverage-foundry-shard.py` deterministic partition with positive and negative tests. This is local **structural** qualification; it is **not** a new full 1,000+ source Foundry run. The full exact-head Level 3 workflow remains mandatory when invoked for final whole-stack release claims, and old failed workflows are not relabelled green.

Frozen Genesis and protocol security controls remain unchanged. Never reduce test inventories to make CI green.
