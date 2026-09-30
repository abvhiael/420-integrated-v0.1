# CMP-1 — Core smart contracts

**Controlling scope: the original user-provided five-slice application roadmap, restored without renumbering.**

**Qualification evidence rule:** qualification attaches to the exact implementation SHA that changes qualification-relevant contracts, tests, configuration, workflows, dependencies, or substantive requirements. A later evidence-only commit may record that SHA, workflow run IDs, audit notes, and completion status without recursively rerunning the full suite; it must explicitly identify the qualified implementation SHA and must not imply CI ran on the evidence-only SHA. Any later commit capable of changing qualification results requires fresh exact-head qualification. Build the on-chain foundation. None of the five slices is complete solely because other ComputeMarket foundation contracts or generic repository CI passed.

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

**CMP-1.3 status: COMPLETE WITHIN REPOSITORY QUALIFICATION SCOPE as of CMP-1.3.16. Live deployment/publication remains blocked by the separately recorded CMP-1.5, public-testnet, runtime-evidence and ProtocolRegistry-publication prerequisites.**

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

**CMP-1.3.7 deployment/publication qualification:** `docs/compute-market/CMP-1.3.7-WORKER-DEPLOYMENT-QUALIFICATION.md` pins the exact WorkerRegistry job/admission graph, runtime code hashes, chain/governance bindings, and fail-closed live evidence required before ProtocolRegistry publication. Repository readiness is independently qualifiable; live qualification remains blocked until canonical testnet deployment and the CMP-1.5 compute-stake source exist.

### CMP-1.3.8 — Mutation-time capability authorization and delegated worker authority

Integrate WorkerRegistry register/activate/suspend/retire/profile-refresh/key-rotation mutations with the shared `ComputeAuthorization420` / Capability Registry model instead of relying only on direct operator identity.

Required:
- worker-scoped action IDs and object scopes;
- narrowly delegated operator/session authority only when explicitly granted;
- revision guards and revocation behavior;
- preserved provider/node/resource ancestry checks;
- no capability grant may imply Vault, governance, verifier, bridge, validator, settlement, or arbitrary wallet authority;
- negative tests for wrong action/scope/object, stale revision, revoked authority, governance substitution, and mutation atomicity.

Exit: every mutable WorkerRegistry action is both identity-safe and capability-scoped, with rejected actions leaving canonical state unchanged.

### CMP-1.3.9 — Independent execution-key authorization and replay-safe worker signing

Turn the execution key from registration/rotation possession evidence into an independently usable execution authority for policy-bound accepted work.

Required:
- chain/contract/job/worker/revision/attempt domain-separated digests;
- execution-key signatures for accepted-work and result/receipt actions where the bound policy requires them;
- preserved separation between operator account and execution key;
- safe rotation without rewriting accepted jobs;
- rejection of cross-chain, cross-job, cross-worker, stale-revision, duplicate-attempt, and retired-key replay;
- execution-key authority grants no custody, correctness, matching, settlement, governance, or lifecycle mutation authority.

Exit: accepted execution can be authenticated by the frozen execution key without conflating that key with the worker operator account.

### CMP-1.3.10 — Worker capacity reservation and concurrency semantics

Add a narrowly scoped capacity reservation layer over canonical worker/resource identity without replacing `ComputeResourceRegistry420` ownership or 420Vault custody.

Required:
- worker/resource capacity-unit semantics;
- reservation IDs bound to accepted jobs and exact worker/resource revisions;
- concurrency limits and fail-closed exhausted-capacity admission;
- reserve/release/expire/fail transitions;
- replay/duplicate reservation protection;
- isolation so one job/worker/resource cannot consume another party's capacity entitlement;
- reconstructable historical reservations.

Exit: accepted work cannot overbook canonical worker capacity and all capacity transitions are deterministic and replay-safe.

### CMP-1.3.11 — Hardware, benchmark, TEE, and inspection provenance hardening

Strengthen trusted capability evidence so off-chain provenance is explicit and independently reconstructable.

Required:
- bind evidence type/schema revision, issuer/attester identity, evidence/source commitment, worker/revision/resource/profile/key subject, issuance/expiry, revocation, and policy revision;
- distinguish benchmark, TEE, and inspection provenance;
- signed/versioned/content-addressed evidence semantics where eligibility depends on off-chain manifests;
- preserve the rule that capability attestation is not proof of job-result correctness;
- reject forged provenance, wrong schema/type, stale policy, revoked issuer, evidence substitution, cross-subject reuse, and replay.

Exit: trusted hardware admission can identify exactly what evidence was accepted, under which schema/policy, for which worker revision.

### CMP-1.3.12 — Accepted-job worker invariant hardening and attempt lifecycle

Extend the immutable worker snapshot into a complete accepted-attempt lifecycle.

Required:
- exact attempt identity and transition rules;
- frozen worker/resource/execution-key/capability/Trust/stake context;
- integration with capacity reservation consumption and release;
- deterministic retry/failure/cancellation/expiry behavior;
- no retry may broaden accepted match constraints;
- later worker/resource/key/policy changes may block new admission but cannot rewrite historical accepted work or confiscate valid earned settlement.

Exit: accepted work remains reconstructable across success, failure, retry, cancellation, and expiry without identity or authority drift.

### CMP-1.3.13 — Canonical read model, SDK/client consumption, and off-chain compatibility

Provide stable versioned consumption surfaces for replaceable off-chain clients.

Required:
- canonical reads/descriptors for worker identity, capability profile, eligibility, attestation/Trust/stake references, execution-key metadata, capacity, and accepted-job snapshots;
- repository client/SDK helpers or equivalent machine-consumable interfaces for matchers, worker agents, indexers, and applications;
- deterministic encoding/domain constants and negative/stale-revision fixtures;
- no privileged matcher/client assumptions;
- explicit non-AI workload coverage.

Exit: an external client can reconstruct and validate WorkerRegistry admission/execution state from public canonical interfaces.

### CMP-1.3.14 — Cross-component adversarial and invariant qualification

Create a consolidated qualification campaign spanning the entire hardened WorkerRegistry graph.

Required:
- provider/node/resource state;
- authorization/delegation;
- capability profiles;
- attestation provenance;
- Trust and compute-stake bindings;
- accepted match/job state;
- execution-key signatures;
- capacity reservations;
- historical reconstruction;
- failure atomicity and authority-separation tests;
- explicit review of every `CMP-INV-001`–`CMP-INV-030` invariant as directly exercised, transitively exercised by retained tests, or non-applicable;
- invariant/fuzz testing where practical.

Exit: all applicable frozen ComputeMarket invariants have traceable test evidence against the complete WorkerRegistry graph.

### CMP-1.3.15 — Release-candidate wiring, publication readiness, and dependency reconciliation

Reconcile the hardened post-1.3.7 graph with the deployment/publication package.

Required:
- refresh canonical wiring and runtime code-hash manifests for all changed components;
- refresh deployment descriptors and ProtocolRegistry publication requirements;
- reconcile dependency declarations with CMP-1.5 and canonical public-testnet availability;
- exact-head repository qualification;
- preserve truthful fail-closed blockers where live deployment prerequisites do not exist;
- never fabricate addresses, transactions, blocks, runtime hashes, or publication evidence.

This step refreshes the readiness contents affected by later code changes without erasing the historical CMP-1.3.7 qualification record.

Exit: the final WorkerRegistry release candidate is repository-qualified and has a truthful, dependency-aware deployment/publication package.

### CMP-1.3.16 — WorkerRegistry phase closeout, reconciliation, and retained evidence

Perform final CMP-1.3 reconciliation only after CMP-1.3.8–CMP-1.3.15 are qualified.

Required:
- inventory all WorkerRegistry source/tests/docs/configuration;
- reconcile historical evidence caveats;
- verify invariant coverage and authority boundaries;
- record exact final SHA and workflow run IDs;
- if evidence recording is documentation-only, record and inherit the already-qualified implementation SHA without a recursive rerun; if it changes qualification-relevant implementation, tests, configuration, workflows, dependencies, or substantive requirements, rerun the retained qualification suite on that new exact head;
- distinguish repository qualification from live deployment claims;
- migrate/reconcile the useful material in `CMP-1.3-DEFERRED-CLOSEOUT-DRAFT.md` and `cmp-1.3-deferred-closeout-ledger.json` here rather than discarding it.

Exit: CMP-1.3 may be marked COMPLETE only after the exact qualification-relevant implementation head passes the retained qualification suite and the durable closeout record identifies that SHA and its run evidence. A later evidence-only closeout commit inherits that qualified SHA.

**Roadmap provenance:** CMP-1.3.8–CMP-1.3.16 above are a **new authoritative roadmap created from the 2026-09-28 fresh repository audit** requested by the repository owner. They are not represented as recovered text from the unavailable prior conversation. The supporting audit is `docs/compute-market/CMP-1.3.8-1.3.16-WORKER-REGISTRY-GAP-AUDIT.md`.


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
