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

**CMP-1.3.0 baseline:** `docs/compute-market/CMP-1.3.0-WORKER-REGISTRY-BASELINE-AND-INTEGRATION-DESIGN.md` reconciles this original requirement with the canonical provider/node/resource registries, 420Trust evidence and the future CMP-1.5 compute-stake source. It freezes the non-duplicative worker identity, execution-key, capability, attestation, reputation, stake-reference and status model before executable implementation. This design gate does not itself implement or deploy ComputeWorkerRegistry.

**CMP-1.3.1 worker identity/lifecycle core:** qualified at exact head `505851b33cf4ac3f81d030269c1bae16ac661f18`. It implements permanent provider/node/resource ancestry, execution-key possession proof, revisioned capability-profile commitments, exact resource-revision binding, fail-closed parent eligibility, key rotation, suspension, retirement and historical reconstruction.

**CMP-1.3.2 trusted capability attestation:** `docs/compute-market/CMP-1.3.2-WORKER-ATTESTATION-QUALIFICATION.md` adds a separate provider-neutral attestation authority and admission composition so self-reported worker capability cannot satisfy policies that require independent evidence. Evidence is exact-revision/profile/key/resource bound, expiry/revocation/policy guarded, replay resistant, and grants no unrelated authority.

**CMP-1.3.3 canonical capability detail:** `docs/compute-market/CMP-1.3.3-CAPABILITY-PROFILE-QUALIFICATION.md` binds the worker's capability commitment to bounded canonical architecture/CPU/GPU/software sets, VRAM/memory/storage/network scalars and storage/network/runtime commitments. New-admission matching is exact-revision and resource-bounded, and trusted-hardware policies compose the CMP-1.3.2 attestation gate. Candidate implementation is repository-qualified at exact head `4d0ccd94c7160cc40d5a737620c679c70da41c96`; final evidence-recording head `bed8e60287eee5403e023ab8dad30e4a6fa90b82` passed Solidity Contracts #3239 (16/16), 420 Integrated Qualification #5778, and 420Docs Qualification #3161. CMP-1.3.3 is COMPLETE.

**CMP-1.3.4 420Trust reputation references:** `docs/compute-market/CMP-1.3.4-WORKER-TRUST-QUALIFICATION.md` integrates policy-scoped canonical 420Trust metrics and immutable worker-revision reputation references without creating a universal score or granting correctness, settlement, stake, slashing, or lifecycle authority. Live Trust state remains authoritative for new admission. Candidate implementation is repository-qualified at exact head `67195b992f7793ac8012af130085bcf0902c23d4`; final evidence-recording-head closeout remains pending.

**CMP-1.3.5 compute-stake binding:** `docs/compute-market/CMP-1.3.5-WORKER-STAKE-BINDING-QUALIFICATION.md` adds a typed, versioned binding to the future CMP-1.5 compute-collateral source. Stake-required admission defaults deny while unbound, rejects validator-stake substitution, reads live worker/policy-specific collateral state, and preserves immutable historical stake references without owning custody or slash authority. Candidate implementation is repository-qualified at exact head `a8d54383da6f4da775fbed86c2c1d85597961791`; final evidence-recording-head closeout remains pending.

**CMP-1.3.6 accepted-job worker snapshot:** `docs/compute-market/CMP-1.3.6-WORKER-SNAPSHOT-QUALIFICATION.md` adds a strict job worker-evidence adapter that admits only an exact eligible worker revision against the accepted resource/operator and freezes worker execution identity, capability, Trust, and stake-reference context for the running job. Later worker/resource/policy changes block new admission but cannot rewrite the accepted historical snapshot. Candidate implementation is repository-qualified at exact head `ad5a411421b852ab1786a6ef9e0f646d9605082e`; final evidence-recording-head closeout remains pending.

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
