---
title: Consensus architecture
component: consensus
audience:
  - developer
  - operator
  - architect
category: architecture
status: development
version: current
---

# Consensus architecture

This section documents the canonical consensus model for 420 Integrated: validator lifecycle, committees and cohorts, proposer scheduling, slots and epochs, quorum certificates, fork choice and finality, rewards, slashing, failure handling, and recovery.

Consensus is implemented by `fourtwentyd` as a process separate from the `node420` EVM execution client. Consensus decides which execution payload becomes canonical and finalized; execution determines the EVM state transition produced by an accepted payload.

## DOC-4 phase map

- **DOC-4.1 — [Consensus overview](consensus-overview.md)** — authority boundaries, process model, slot/QC/finality flow, committee/rotation shape, execution relationship, persistence, and consensus-wide invariants.
- **DOC-4.2 — [Validator lifecycle](validator-lifecycle.md)** — registration/eligibility, bonding, activation, three-rotation tenure, exits, cooldown, validator keys, post-duty slashability hold, and lifecycle state transitions.
- **DOC-4.3 — [Proposer selection, cohorts, and rotation](proposer-selection-cohorts-rotation.md)** — equal-weight proposer/fallback schedules, deterministic permutations, committee tiers, age cohorts, rotation migration, and anti-flapping.
- **DOC-4.4 — [Epochs, fork choice, QCs, and finality](epochs-fork-choice-qcs-finality.md)** — slots/epochs, attestations, quorum thresholds, chained finality, head/safe/finalized mapping, and reorganization rules.
- **DOC-4.5 — [Rewards and issuance](rewards-and-issuance.md)** — gross issuance curve, dynamic Security allocation, proposer/participant accounting, missed-participation non-issuance, deterministic arithmetic, and execution settlement.
- **DOC-4.6 — [Slashing and safety](slashing-and-safety.md)** — availability versus safety faults, cryptographic evidence, correlation tiers, constitutional slash ceilings, collateral routing, suspension/ejection, local slashing protection, and consensus/execution safety boundaries.
- **DOC-4.7 — [Failure, recovery, and operator safety](failure-recovery-operator-safety.md)** — quorum loss, partitions, restarts, persistent state, Engine outages, safety halt, remote signing, recovery ordering, and consensus readiness gates.

## Current frozen/testnet anchors

The current protocol configuration establishes these high-level anchors:

- 12-second slots;
- primary plus two deterministic fallback proposer windows;
- 420-block consensus epochs;
- 42 epochs per rotation (`17,640` blocks at uninterrupted target production);
- active committee tiers of 15, 18, 21, 24, 27, and 30 validators;
- exactly three age cohorts in each stable committee;
- one oldest cohort rotates out per rotation;
- validator tenure of three rotations;
- equal proposer weighting per active validator rather than stake-weighted proposer selection;
- quorum threshold `floor(2N/3)+1`;
- one-block chained finality in the current consensus core;
- separate consensus and execution processes joined through the private JWT-authenticated Engine API.

Detailed lifecycle, selection, finality, reward, slashing, and recovery rules are documented in the later DOC-4 pages rather than duplicated here.

## Authority boundary

Consensus is authoritative for:

- the active validator committee and consensus eligibility;
- authorized proposer/fallback identity for a slot;
- attestations and quorum certificates;
- consensus head/safe/finalized decisions;
- consensus-side validator rotation, lifecycle, reward, and slashing outcomes;
- consensus safety-halt/recovery state;
- deterministic consensus-system-call inputs that communicate qualified outcomes to execution.

Execution remains authoritative for EVM-visible balances, contract code/storage, receipts/logs, transaction validity/execution, native `$420` state transitions, and execution state roots.

Neither side may silently substitute for the other.

## Implementation anchors

Important current implementation/reference surfaces include:

- `fourtwentyd` — consensus daemon;
- `node420` — execution client wrapper/integration surface;
- `config/protocol.json` — current protocol configuration and frozen testnet decisions;
- `consensus/` — consensus implementation;
- `consensus/recovery/` — `SAFETY_HALT` and recovery-state-machine surface;
- `docs/VALIDATOR-LIFECYCLE-SLASHING-v1.md` — frozen validator lifecycle, custody, and slashing specification;
- `docs/STEP-3-DECISION-03-PROPOSER-SELECTION.md` — frozen proposer scheduling rules;
- `docs/STEP-4.4-COMMITTEE-SIMULATION.md` — deterministic committee/scheduling implementation notes;
- `docs/STEP-4.3-CONSENSUS-CERTIFICATION.md` — canonical consensus objects, BLS/QC and chained-finality implementation notes;
- `contracts/src/system/RewardController.sol` — execution-side native issuance receiver/accounting surface;
- `docs/CONSENSUS-SYSTEM-CALL-v1.md` — frozen consensus-to-execution state-transition path;
- `consensus/engine/` — private Engine API integration;
- `consensus/storage/` — dedicated consensus persistence;
- `testnet/runbooks/` — operational monitoring, canary, launch, and incident procedures.

## Related documentation

- [Chain architecture](../chain/index.md)
- [Execution layer](../chain/execution-layer.md)
- [System dependency map](../dependency-map.md)
- [Trust-boundary model](../trust-boundary-model.md)
- [Genesis architecture](../genesis-architecture.md)
