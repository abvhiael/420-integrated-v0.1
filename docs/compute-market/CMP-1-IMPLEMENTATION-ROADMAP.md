# CMP-1 — Core smart contracts

**Controlling scope: the original user-provided five-slice application roadmap, restored without renumbering.** Build the on-chain foundation. None of the five slices is complete solely because other ComputeMarket foundation contracts or generic repository CI passed.

## CMP-1.1 — ComputeJobRegistry

Responsibilities:

- create jobs
- update lifecycle state
- record manifest hash
- record workload type
- record input/output commitments
- associate job owner
- associate assigned workers
- record verifier decisions

## CMP-1.2 — ComputeEscrow

Job owners deposit $420 before work begins.

Implement:

```
deposit
reserve
release
refund
partial release
timeout refund
dispute freeze
slash redistribution
```

No worker should perform paid computation against an unfunded job.

**Architecture compatibility gate:** reconcile this originally named ComputeEscrow responsibility with the frozen V1 architecture and CMP-0.8's requirement to use the authorized registered 420Vault custody/accounting route, payer-isolated balances and real payer withdrawals. Do not create a second unrestricted escrow, silently alter the original functional requirements, or declare this slice complete without real deposit/reservation/settlement/refund evidence.

## CMP-1.3 — ComputeWorkerRegistry

Workers register:

```
worker address
node public key
supported architectures
CPU classes
GPU classes
VRAM
memory
storage
network capabilities
software capabilities
jurisdiction metadata (optional)
reputation
stake
status
```

Never trust the self-reported hardware alone. Capabilities must eventually be benchmarked or attested.

## CMP-1.4 — ComputeVerifierRegistry

Separate workers from verification authorities.

Verifier classes could include:

```
independent verifier
job-owner verifier
protocol verifier
oracle verifier
TEE verifier
committee verifier
```

## CMP-1.5 — ComputeStake

Require worker/verifier collateral.

Provide:

```
stake()
unstake()
requestExit()
slash()
reward()
```

Include an exit delay so bad workers cannot submit fraudulent work and immediately withdraw.

## Reconciliation of the unapproved replacement implementation

The prior version of this file incorrectly redefined CMP-1.1–1.5 as typed IDs, read-only authorization, policy revisions, provider/node/resource identity and foundation qualification. Subsequent work added CMP-1.6–1.8 identity snapshot, guard and history components. Those are **not** the five agreed CMP-1 deliverables and their passing tests cannot be used to mark the actual five slices complete. Prior sources, commits, CI evidence and closeout documents remain in the draft PR as historical, unapproved-scope work pending explicit disposition; do not silently relabel, delete, merge or promote them as replacements for the original five contracts.

**Current acceptance status for the five agreed CMP-1 slices in PR #369: NOT IMPLEMENTED/NOT QUALIFIED as those deliverables.** Inventory existing shared Vault, registry, staking and governance components before implementation to reuse authoritative systems without inventing new custody or privileges. Maintain the frozen system-address map, provider-neutral architecture and registry publication gates; reconcile any apparent conflict with the original roadmap explicitly instead of changing its goals or sequence. Keep PR #369 draft and unmerged, and qualify each actual contract and the exact final head before any closeout. No CMP-1.6 or later slices are authorized by this roadmap.
