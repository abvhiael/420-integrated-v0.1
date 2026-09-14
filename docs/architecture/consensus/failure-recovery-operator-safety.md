---
title: Failure, recovery, and operator safety
component: consensus-recovery
audience:
  - validator
  - operator
  - developer
  - architect
category: architecture
status: development
version: current
---

# Failure, recovery, and operator safety

This page documents how 420 Integrated fails closed and recovers when consensus cannot safely continue. It covers quorum loss, network partitions, consensus/execution divergence, Engine API failure, process restart, persistence failure, remote-signer uncertainty, `SAFETY_HALT`, and the operator ordering required before validator duties resume.

`fourtwentyd` owns consensus safety, fork choice, quorum certificates, finality, validator duties, and the `SAFETY_HALT`/recovery state machine. `node420` owns EVM execution and execution state. The two processes are separate and communicate through the private JWT-authenticated Engine API. Consensus P2P uses libp2p and consensus state uses its own persistent key-value database.

## Recovery principle

Recovery is never permission to weaken the protocol.

Operators must not restore liveness by:

- lowering the quorum threshold;
- signing from incomplete or uncertain slashing-protection history;
- choosing between conflicting finalized histories by local preference;
- inventing validator replacements from partition-local observations;
- bypassing Engine payload validation;
- applying consensus-system state transitions outside their canonical ordering;
- rewriting a live network's finalized history and calling it a rollback.

The recovery goal is to resume from a state that is demonstrably consistent with the last trusted finalized consensus/execution boundary.

## Normal degradation versus safety incident

Not every failure is a `SAFETY_HALT` condition.

Examples of ordinary degraded/liveness conditions include:

- isolated proposer failure handled by fallback #1 or fallback #2;
- temporary peer-count reduction;
- one validator process restart;
- short Engine/API interruption;
- reduced attestation participation that still satisfies quorum;
- temporary RPC, Explorer, Indexer, AI, gateway, or application outage that does not change consensus authority.

Safety incidents require stricter behavior. Examples include:

- conflicting valid quorum certificates;
- conflicting finalized-history evidence;
- consensus progression through a condition where the protocol requires `SAFETY_HALT`;
- unauthorized quorum-threshold reduction;
- consensus and execution disagreeing on the finalized execution payload/state;
- missing or inconsistent validator signing-protection state where continued signing could equivocate.

## Quorum loss

The protocol quorum remains `floor(2N/3)+1` for the active committee.

Quorum loss is a liveness failure, not authority to reduce the threshold. For example, with 15 active validators:

- 11 valid participants can certify;
- 10 cannot certify.

When quorum is unavailable:

1. no new QC may be fabricated;
2. no new block may be treated as certified/finalized without the normal threshold;
3. `head`, `safe`, and `finalized` must not be advanced optimistically;
4. validator operators should preserve current state and investigate connectivity/readiness;
5. ordinary inactivity remains distinct from principal-slashable safety evidence.

The monitoring baseline treats **42 consecutive slots without a certified block** as an alert condition. That is an operational threshold for investigation/escalation, not a substitute QC rule.

## Network partitions

During a partition, each validator must obey the same quorum and signing-safety rules it obeys on a healthy network.

A minority partition cannot become authoritative by declaring itself recovered. Operators must not:

- lower quorum to fit the locally visible validator count;
- eject validators merely because they are unreachable from one partition;
- sign conflicting duties on both sides of a partition;
- replace finalized state with the locally longest or most recent branch if that branch conflicts with canonical finality.

After connectivity returns, nodes reconcile using canonical consensus evidence and finalized state rather than wall-clock recency or operator preference.

## `SAFETY_HALT`

`SAFETY_HALT` is the fail-closed state for consensus-safety incidents.

When entered, validator signing and value-sensitive protocol progression must stop to the extent required by the recovery state machine. The purpose is to prevent uncertain state from accumulating additional signatures, rewards, slash effects, system calls, or finalized execution transitions.

During a live-network safety halt, operators should preserve at minimum:

- logs;
- QCs and attestations;
- slash/equivocation evidence;
- the last trusted finalized checkpoint;
- consensus database state;
- execution database state and finalized execution hash;
- node/client version hashes and configuration;
- signer/slashing-protection records.

Public distribution, gateway, treasury, or similarly value-sensitive operational actions should remain frozen when the incident procedure requires it.

## Conflicting QCs or finalized history

Conflicting valid QCs or incompatible finalized histories are not ordinary reorgs.

On detection:

1. stop unsafe signing;
2. preserve both evidence sets;
3. enter/maintain the required safety halt;
4. do not select a winner by local branch length, peer count, or operator vote;
5. validate signer sets, roots, committee context, and cryptographic evidence;
6. determine the last common trusted finalized boundary;
7. follow the canonical recovery mechanism before any validator resumes protected duties.

A validator must never produce a `RecoveryCertificate` or equivalent recovery signature that conflicts with a previously protected recovery decision for the same incident.

## Consensus persistence

Consensus state uses dedicated persistent storage separate from the execution client's database.

Persistent state that must survive restart includes, as applicable:

- canonical committee/lifecycle state;
- slot/epoch/rotation position;
- current consensus head/safe/finalized references;
- QC/finality data required for safe restart;
- proposer/fairness state required by the current rotation;
- slash/evidence consumption state;
- recovery-state-machine state;
- local slashing-protection history.

A restart is safe only when the node can prove that restored state is internally consistent and compatible with the network's trusted finalized checkpoint.

## Restart procedure

A normal validator/execution-pair restart should preserve consensus and execution databases and then re-establish the Engine boundary before duties resume.

The safe order is:

1. preserve/validate local consensus, execution, and slashing-protection data;
2. start/verify `node420` against the intended genesis/network identity;
3. verify Engine API JWT/authentication and execution readiness;
4. start/restore `fourtwentyd` consensus state;
5. reconcile consensus finalized execution hash with `node420`;
6. verify peer connectivity, committee identity, slot/epoch/rotation position, and clock health;
7. verify remote signer and slashing-protection state;
8. resume signing only after all protected-duty preconditions are green.

The canary plan explicitly requires validator/execution-pair restarts to demonstrate state recovery before promotion.

## Persistence failure

Disk/database corruption or missing protected state is not a normal restart.

If consensus persistence cannot be trusted:

- do not reconstruct canonical consensus authority from Explorer/Indexer/RPC projections;
- restore from a trusted backup/snapshot only when its finalized checkpoint can be validated;
- replay/reconcile forward from canonical network evidence as supported;
- keep the validator signer disabled until slashing-protection continuity is proven.

If the local slashing-protection database is missing or inconsistent, the operator must remain non-signing rather than risk double proposal, double vote, or conflicting recovery signatures.

## Remote signer failure

Production validator keys belong behind the remote-signer boundary.

Signer outage is a liveness issue; bypassing the signer with an unprotected local key is not an acceptable recovery shortcut.

On signer failure:

- stop duties that require signatures;
- restore signer connectivity/identity;
- verify signing domain and validator identity;
- verify the slashing-protection database and protected-duty history;
- reject queued requests whose slot/duty context is stale or no longer canonical;
- resume only after the consensus process and signer agree on current protected state.

Wallet/session/application keys must never substitute for the validator key.

## Engine API failure

The Engine API is the authority boundary between consensus and execution.

Sustained Engine errors are a hold condition in the canary runbook. If `fourtwentyd` cannot construct, validate, or reconcile execution payloads with `node420`, consensus must not pretend execution succeeded.

Operators should distinguish:

- connectivity/authentication failure;
- execution client lag or restart;
- payload validation rejection;
- fork-choice update failure;
- finalized-hash mismatch;
- consensus-system-call/state-transition failure.

Recovery requires restoring the Engine channel and reconciling the last trusted finalized consensus block with the execution state before new certified execution payloads are accepted.

## Consensus/execution divergence

If consensus says block `X` is finalized but `node420` cannot produce or validate the corresponding execution state, the node is not healthy even if either process is individually running.

Do not resolve divergence by:

- forcing execution to an arbitrary local head;
- changing consensus finalized references;
- replaying reward/slash/system calls manually;
- trusting Explorer/Indexer state over the two canonical processes.

The recovery boundary is the latest consensus-finalized execution payload whose execution state can be validated deterministically by both sides.

## Derived-service failures

Explorer, Indexer, Search, Analytics, RPC gateways, AI providers, storage providers, public website, and other derived/off-chain services may fail without changing canonical consensus authority.

Their recovery strategy is generally rebuild/replay/reconnect from canonical chain state.

A derived service outage must not cause validators to:

- change fork choice;
- lower quorum;
- change committee membership;
- sign based on derived cached state;
- fabricate reward/slash/identity outcomes.

## Operator monitoring baseline

Operators should alert on at least:

- no certified block for 42 consecutive slots;
- `SAFETY_HALT` trigger;
- conflicting valid QCs;
- active seats below 15;
- eligible validator pool below 60;
- Engine API errors;
- `node420` execution-head lag;
- peer-count collapse;
- randomness degradation;
- disk persistence failures;
- public RPC failure/latency.

Operational dashboards should make `head`, `safe`, `finalized`, slot, epoch, rotation, active/eligible counts, attestation participation, proposer rank/fallback usage, and client version hashes directly visible.

## Recovery ordering

For a consensus-affecting incident, use this ordering:

1. **Stop unsafe action** — disable signing or progression where required.
2. **Preserve evidence** — logs, QCs, finalized checkpoint, consensus/execution databases, signer protection state.
3. **Classify the incident** — liveness/degraded versus consensus-safety failure.
4. **Establish the trusted boundary** — last verifiable finalized consensus + execution state.
5. **Restore execution** — verify network identity, database, Engine API, and finalized execution state.
6. **Restore consensus** — recover persistent consensus state against the trusted boundary.
7. **Restore signing protection** — remote signer, keys, domains, and slashing/recovery-certificate protection.
8. **Restore connectivity/readiness** — peers, clock, committee state, eligible/active population.
9. **Reconcile value-sensitive state** — rewards, slashes, validator registry/system calls must match canonical finalized outcomes.
10. **Resume cautiously** — signing/progression only after safety checks pass.
11. **Rebuild projections** — Indexer/Explorer/Analytics and other derived systems last.

This ordering prevents a convenience layer or operator workaround from becoming consensus authority during an incident.

## Testnet rollback/relaunch boundary

For pre-public testnet defects, the environment may be stopped, restarted from the same finalized state, or explicitly abandoned and relaunched with a new genesis/network identity.

A live network's finalized history is not silently rewritten. If a testnet is abandoned:

- publish the retired genesis hash and final checkpoint;
- create a clearly distinct new genesis/network identity;
- require clients/operators to intentionally join the replacement network.

Never present a history rewrite as an ordinary rollback.

## Readiness gates

Consensus operation should remain blocked or degraded when any critical prerequisite is unknown, including:

- network/genesis identity mismatch;
- consensus/execution finalized-state mismatch;
- unresolved conflicting QC/finality evidence;
- required `SAFETY_HALT` still active;
- missing/corrupt slashing-protection state;
- remote signer identity/domain mismatch;
- Engine authentication/payload validation failure;
- insufficient validator quorum for certification;
- persistent-state corruption;
- unauthorized protocol configuration change.

Passing process-health checks alone is not enough; safety and authority continuity must be established.

## Failure/recovery invariants

- **REC-001** — loss of quorum must halt certification rather than lower the canonical quorum threshold.
- **REC-002** — conflicting valid QCs or finalized histories must be treated as safety incidents, not ordinary fork choice.
- **REC-003** — validator signing must remain disabled when slashing-protection or recovery-signature history is incomplete or inconsistent.
- **REC-004** — `fourtwentyd` and `node420` must agree on the trusted finalized execution boundary before duties resume after divergence.
- **REC-005** — Engine failure must fail closed for execution-dependent consensus progression.
- **REC-006** — derived services must never become recovery authority for consensus, execution, committee, reward, or slash state.
- **REC-007** — operators must preserve cryptographic evidence and finalized checkpoints before destructive repair actions.
- **REC-008** — recovery must not bypass constitutional quorum, finality, slashing, or issuance rules.
- **REC-009** — a live network's finalized history must not be silently rewritten under the label of rollback.
- **REC-010** — remote signer and local slashing protection must be revalidated before post-restart signing.
- **REC-011** — consensus persistence, execution persistence, and protected signing state are separate recovery domains and must all reconcile.
- **REC-012** — value-sensitive protocol/system actions must remain frozen whenever their canonical prerequisite state is uncertain.

## Implementation and operations references

- `docs/STEP-3-DECISION-18-IMPLEMENTATION-ARCHITECTURE.md`
- `consensus/recovery/`
- `consensus/storage/`
- `consensus/engine/`
- `docs/STEP-4.3-CONSENSUS-CERTIFICATION.md`
- `docs/STEP-4.4-COMMITTEE-SIMULATION.md`
- `docs/CONSENSUS-SYSTEM-CALL-v1.md`
- `testnet/runbooks/MONITORING.md`
- `testnet/runbooks/CANARY-OPERATIONS.md`
- `testnet/runbooks/ROLLBACK.md`
- `testnet/runbooks/PUBLIC-LAUNCH.md`

## Related DOC-4 pages

- [Consensus overview](consensus-overview.md)
- [Validator lifecycle](validator-lifecycle.md)
- [Proposer selection, cohorts, and rotation](proposer-selection-cohorts-rotation.md)
- [Epochs, fork choice, QCs, and finality](epochs-fork-choice-qcs-finality.md)
- [Rewards and issuance](rewards-and-issuance.md)
- [Slashing and safety](slashing-and-safety.md)
