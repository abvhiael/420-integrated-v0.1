# 420 Compute Market — Roadmap from CMP-1 to production

Status: **CONTROLLING PLANNING ROADMAP FOR POST-CMP-1 WORK; DOES NOT RENUMBER OR SUPERSEDE THE EXISTING CANONICAL CMP-1.1–CMP-1.5 ROADMAP.**

Created: 2026-09-30

## Purpose

This roadmap records the path from the current Compute Market foundation to a production-ready, general-purpose distributed compute marketplace capable of supporting useful scientific computation in the same broad problem class as systems such as CureCoin/Folding@home, while preserving 420Integrated's provider-neutral architecture.

The Compute Market remains general-purpose. Scientific compute is a major use case, not an architectural restriction. CPU, GPU, accelerator, simulation, proving, rendering, transcoding, batch execution, AI and non-AI workloads must all remain compatible.

This document exists to prevent roadmap drift. Existing canonical CMP-1 numbering remains authoritative for the core-contract phase. New phase numbers below begin only after CMP-1 is complete.

---

# Current position

## CMP-0 — Protocol specification

**Status: design/specification substantially complete; operational qualification remains open.**

Already specified:

- canonical ComputeJob schema;
- deterministic work-unit and attempt identities;
- signed execution manifests;
- provider/node/resource identity;
- offers, requests and matching;
- authorized job lifecycle;
- Vault-backed funding, settlement and payer refunds;
- receipts and verification;
- disputes, privacy and security;
- client/node/420AI integration;
- qualification and closeout gates;
- CMP-INV-001 through CMP-INV-030.

CMP-0 operational closeout remains blocked until the full executable market exists and passes live/testnet evidence gates.

---

# CMP-1 — Core smart contracts

The canonical CMP-1 roadmap contains exactly five primary slices.

## CMP-1.1 — ComputeJobRegistry

**Status: repository implementation substantially complete.**

Provides canonical job/request identity, signed owner/payer authorization, lifecycle state, manifest/input/output commitments, accepted match/result references and verifier-decision integration.

Question answered:

> What work exists, who requested it, and what is its canonical lifecycle?

## CMP-1.2 — ComputeEscrow / Vault-backed accounting

**Status: repository-qualified within current fixed-price single-assignment scope; live release blocked.**

Provides:

- payer-specific funding;
- reservation;
- accepted-price/max-spend enforcement;
- provider entitlement;
- release/payout;
- residual/partial release;
- cancellation/expiry/failure refunds;
- dispute freeze and adjudicated liability;
- solvency/reentrancy/accounting hardening.

Cross-phase stake/slash integration:

- repository integration is implemented in CMP-1.5.10: slash redistribution originates from CMP-1.5 collateral, never payer escrow;
- live deployment evidence remains gated by CMP-1.2.9 / later public testnet qualification.

Question answered:

> Is the job funded, and who is economically entitled to what?

## CMP-1.3 — ComputeWorkerRegistry

**Status: at CMP-1.3.16 closeout.**

Provides:

- worker/provider/node/resource identity;
- lifecycle and delegated mutation authorization;
- execution keys;
- capability profiles;
- CPU/GPU/VRAM/RAM/storage/network/software capability description;
- independent capability attestation;
- 420Trust references;
- future ComputeStake bindings;
- capacity reservations/concurrency limits;
- benchmark/TEE/inspection provenance;
- accepted-job worker snapshots;
- attempt lifecycle;
- historical reconstruction;
- canonical read model and SDK/indexer consumption;
- CMP-INV-001 through CMP-INV-030 qualification evidence.

Question answered:

> Which machine is doing the work, what is it authorized to do, and what capability evidence supports admission?

## CMP-1.4 — ComputeVerifierRegistry

**Status: repository-qualified through CMP-1.4.12 phase closeout.**

Purpose:

Separate workers from authorities that determine whether submitted work satisfies the accepted verification policy.

Existing verifier primitives created during CMP-1.1 are inputs to this phase but do not themselves complete the canonical CMP-1.4 deliverable.

### CMP-1.4.0 — Verifier architecture reconciliation
Inventory all existing verifier, policy, selector, attestation and signed-verdict components. Freeze canonical ownership and authority boundaries.

### CMP-1.4.1 — Verifier identity and lifecycle
Register, activate, suspend, rotate and retire verifier identities without granting unrelated authority.

### CMP-1.4.2 — Verifier classes and workload capabilities
Support independently typed classes such as protocol verifier, independent verifier, job-owner verifier, oracle verifier, TEE verifier and committee verifier.

### CMP-1.4.3 — Verification policy registry
Bind jobs to exact versioned verification policies before execution.

### CMP-1.4.4 — Signed verdicts and decision provenance
Bind every verdict to chain, contract, job, unit, attempt, worker, result, verifier, policy, evidence, nonce and expiry.

### CMP-1.4.5 — Independent verifier selection
Prevent worker-selected friendly verifiers and preserve conflict-of-interest controls.

### CMP-1.4.6 — Replicated / N-of-M verification
Support independent recomputation and quorum verification.

### CMP-1.4.7 — Deterministic verification adapters
For workloads whose result can be independently recomputed.

### CMP-1.4.8 — Scientific/probabilistic verification
Support workload-specific validation where full recomputation is impractical.

### CMP-1.4.9 — Challenge and appeal hooks
Integrate verifier decisions with dispute holds and later stake/slash adjudication.

### CMP-1.4.10 — Cross-verifier adversarial qualification
Cover forged/replayed verdicts, stale policy, wrong job/worker/attempt, verifier collusion, authority drift and failure atomicity.

### CMP-1.4.11 — Release-candidate/deployment readiness

### CMP-1.4.12 — Phase closeout

Question answered:

> Was the submitted computation actually valid under the accepted policy?

## CMP-1.5 — ComputeStake

**Status: CURRENT CORE CONTRACT PHASE after CMP-1.4 closeout.**

Canonical responsibilities:

- stake();
- unstake();
- requestExit();
- slash();
- reward().

### CMP-1.5.0 — Stake architecture
**Status: COMPLETE — Level 1 exact-head qualified on `af9f926465dff1a89e53150d030591e71411787f`.**

Reuse canonical $420 custody/accounting. Do not create an unrelated collateral treasury.

### CMP-1.5.1 — Worker collateral
**Status: COMPLETE — Level 1 exact-head qualified on `98a8f71b28048e81a3475e421aca06661eb94217`.**


### CMP-1.5.2 — Verifier collateral
**Status: COMPLETE — Level 1 exact-head qualified on `baa6ea2e5adc0315d6e6c89010b5c58a03c0532c`.**


### CMP-1.5.3 — Policy-specific minimum collateral
**Status: COMPLETE — Level 1 + first CMP-1.5 Level 2 milestone qualified on `d72dc4c2f5fc2772fd2ea4299dbce9936e78cece`.**


### CMP-1.5.4 — Exit queue / withdrawal delay
**Status: COMPLETE — Level 1 + Level 2 exact-head qualified on `5b706e2b4bfa7fd2f1f3b0a70e64b23cc1f6495c`.**


### CMP-1.5.5 — Objective slash authorization
**Status: COMPLETE — Level 1 + Level 2 exact-head qualified on `8847b36b8e50905402f45e5c0f121c80464673e4`.**


### CMP-1.5.6 — Slash distribution
**Status: COMPLETE — Level 1 + Level 2 exact-head qualified on `306cd68139963c11bf346db8e700fa6cf40bac4d`.**

Policy-bound distribution to harmed payer, replacement worker, challenger and/or protocol treasury.

### CMP-1.5.7 — Reward accounting
**Status: COMPLETE — Level 1 + Level 2 exact-head qualified on `7fd48bcdf2ecbc618d110b34d5b081d2f3cca874`; durable evidence reconciled in CMP-1.5.13.**

Separately authorized, canonical-Vault-backed worker/verifier reward accounting with exact collateral identity, replay protection and no payer-escrow or consensus-issuance authority.

### CMP-1.5.8 — Dispute/stake integration
**Status: COMPLETE — Level 1 + Level 2 exact-head qualified on `ceecba734b057c031f5e5a6ee8a9c91f84839ab8`.**

Freeze canonical verifier identity at dispute opening, preserve verifier collateral through active/objective-final dispute state, and atomically hand qualified objective verifier-error evidence into the existing slash authorization path before releasing the dispute stake hold.

### CMP-1.5.9 — WorkerRegistry stake-source integration
**Status: COMPLETE — Level 1 + Level 2 exact-head qualified on `4845679d1ca41152e3299870af2ed3b8e9e06c1e`.**

Bind WorkerRegistry admission to the actual Vault-backed CMP-1.5 worker collateral source with canonical WorkerRegistry identity and frozen source code-hash checks.

### CMP-1.5.10 — ComputeEscrow slash-redistribution integration
**Status: COMPLETE — Level 1 + Level 2 exact-head qualified on `0a6fe7d7a3d5b7bb6ea768a842bc98819efa3ce2`.**

Bind the harmed-payer recipient to the exact canonical ComputeEscrow entitlement/dispute state while proving that all redistributed slash value originates only from separately backed CMP-1.5 collateral and never payer escrow.

### CMP-1.5.11 — Hostile economic qualification
**Status: COMPLETE — Level 1 + Level 2 exact-head qualified on `1235f24d51d60a6fee2f71e495b34975d879029c`.**

Run the frozen hostile-economic campaign across solvency, isolation, exit races, slash finality, replay, duplicate withdrawal/slash/reward, hostile authorization, reentrancy and failure atomicity.

### CMP-1.5.12 — Release candidate
**Status: COMPLETE — repository-qualified release candidate on `cb67b0b4a564d90c7c6ca910288c6946b9a5929c`; live deployment blocked.**

Freeze the accumulated CMP-1.5 graph, pin runtime/dependency bindings, prepare truthful ProtocolRegistry publication/deployment evidence, and keep live fields fail-closed until real testnet deployment exists.

### CMP-1.5.13 — Phase closeout
**Status: reconciliation complete; Level 3 comprehensive qualification in progress.**

Question answered:

> What economic consequence exists when a worker or verifier cheats?

---

# Milestone A — CMP-1 complete

CMP-1 is complete only when:

- CMP-1.1 JobRegistry is qualified;
- CMP-1.2 Vault-backed accounting is qualified;
- CMP-1.3 WorkerRegistry is qualified;
- CMP-1.4 VerifierRegistry is qualified;
- CMP-1.5 ComputeStake is qualified;
- all cross-phase dependencies are reconciled;
- no live deployment claim is made without actual deployment evidence.

At this point the protocol has the core smart-contract market, but not yet the full distributed-compute runtime.

---

# CMP-2 — Offers, requests, pricing and matching

Purpose: convert registered jobs and workers into an actual resource market.

## CMP-2.1 — Worker offers
**Status: COMPLETE — Level 1 exact-head qualified on `1463c5ef83e522f20c4cff8f015d4cf389fc64ab`.**

Durable evidence: [CMP-2.1 qualification](CMP-2.1-QUALIFICATION-EVIDENCE.md). Level 2 deferred until offers/requests/matching integration; Level 3 reserved for CMP-2.8.

Advertise hardware/software capacity, availability, jurisdiction and price.

## CMP-2.2 — Compute requests
**Status: COMPLETE — Level 1 exact-head qualified on `6738c1a5a5a38c40bd6482ab3338705d16dd4fe3`.**

Durable evidence: [CMP-2.2 qualification](CMP-2.2-QUALIFICATION-EVIDENCE.md). Level 2 deferred until CMP-2.3 offers/requests/matching integration; Level 3 remains CMP-2.8.

Express required resource class, runtime, verification, replication, privacy, deadline and maximum price.

## CMP-2.3 — Replaceable matching engine
**Status: COMPLETE — Level 1 + Level 2 exact-head qualified on `103791e7c700ccd53607613b7d0cd2b6ab376902`.**

Schedulers propose matches; contracts remain authoritative.

CMP-2.3 is the first offers/requests/matching convergence milestone, so the retained Compute Market suite serves as the app-focused Level 2 integration gate in addition to targeted Level 1 checks.

Durable evidence: [`CMP-2.3-QUALIFICATION-EVIDENCE.md`](./CMP-2.3-QUALIFICATION-EVIDENCE.md). Level 3 remains deferred to CMP-2.8.

## CMP-2.4 — Pricing model
**Status: COMPLETE — Level 1 exact-head qualified on `880aee2edd699f54467145d7cf99cbde3871a6cc`.**

Support fixed-price, work-unit, CPU-time, GPU-time and verified-result pricing.

CMP-2.4 is an ordinary Level 1 step. The offers/requests/matching convergence milestone was qualified at Level 2 in CMP-2.3; Level 3 remains CMP-2.8.

Durable evidence: [CMP-2.4 qualification](CMP-2.4-QUALIFICATION-EVIDENCE.md).

## CMP-2.5 — Capacity-aware assignment
**Status: COMPLETE — Level 1 exact-head qualified on `61e40c8928138bd3b6676df0dfbe46dac4dc9e0b`.**

Consume CMP-1.3 capacity reservations atomically.

CMP-2.5 reuses the canonical CMP-1.3 WorkerSnapshot -> capacity reservation -> JobRegistry assignment boundary. The market adapter does not receive capacity-controller authority. Level 2 is not required for this ordinary step; Level 3 remains CMP-2.8.

Durable evidence: [CMP-2.5 qualification](CMP-2.5-QUALIFICATION-EVIDENCE.md).

## CMP-2.6 — Scheduler redundancy and non-authority
**Status: COMPLETE — Level 1 exact-head qualified on `ed0e1ec81ff3888db60e53ef511b66b7cf8c32ad`.**

Prove that matching remains available when any external scheduler is replaced or absent, while scheduler identity grants no acceptance, capacity, custody, settlement, or canonical-term authority.

CMP-2.6 hardens the already-qualified CMP-2.3 proposal-only matcher: multiple schedulers may race or replace one another, stale proposals fail closed, and the requester can self-propose through the same permissionless proposal surface if external schedulers are unavailable. Canonical contracts continue to revalidate request/offer constraints and only the request owner accepts. Level 2 is not required for this ordinary hardening step; Level 3 remains CMP-2.8.

Durable evidence: [CMP-2.6 qualification](CMP-2.6-QUALIFICATION-EVIDENCE.md).

## CMP-2.7 — Market adversarial qualification
**Status: COMPLETE — Level 1 + Level 2 exact-head qualified on `c20d14a06c0787ac76f58b925d94b1625969105b`.**

Attack matching/pricing/capacity behavior for replay, stale offers, race conditions, overbooking, manipulation, authorization failures and economic abuse.

The accumulated CMP-2 marketplace was exercised through a hostile cross-surface campaign covering request authorization/replay, stale and terminal state, scheduler substitution and races, fixed/variable pricing arithmetic and overflow, provider/resource/beneficiary drift, duplicate acceptance, capacity exhaustion/overbooking and failure atomicity.

CMP-2.7 is the final substantive market milestone before phase closeout. Level 1 targeted adversarial qualification and the Level 2 retained full Compute Market app integration suite both passed on the exact implementation SHA above. Repository-wide Level 3 remains reserved for CMP-2.8.

Durable evidence: [CMP-2.7 qualification](CMP-2.7-QUALIFICATION-EVIDENCE.md).

## CMP-2.8 — Phase closeout
**Status: reconciliation complete; Level 3 comprehensive qualification in progress.**

Reconcile the accumulated matching-market graph, run the required Level 3 qualification, preserve durable evidence, and prepare the handoff to CMP-3 — node420 worker runtime.

Reconciliation baseline: current `main` `834fcdd58bbe597716657bf69d3f302897f7227f`; reconciliation merge `808748b291164e38e0c67afc6640b989815dfb48`; branch was 0 commits behind `main` immediately after reconciliation.

Level 3 requires one exact accumulated merge-candidate SHA to pass canonical full Solidity qualification, Genesis/address-authority verification without duplicate Foundry, 420 Integrated/global qualification, Docs/global reconciliation, retained Compute Market qualification, affected SDK/client qualification, Indexer/shared-consumer checks, and required adversarial/invariant/security/static/deployment/config/build/lint/type checks.

Durable closeout evidence is recorded only after all required Level 3 owners pass the same exact merge-candidate SHA.

---

# CMP-3 — node420 compute worker runtime

Purpose: allow ordinary machines to become secure compute workers.

## CMP-3.1 — Worker daemon
**Status: COMPLETE — Level 1 exact-head qualified on `01badf4cb9302841a00905fdfadda44224bfdd3e`.**

Dedicated `node420-compute` process-lifecycle foundation with fail-closed canonical identity configuration, private state directory, explicit lifecycle states, sibling failure containment and bounded graceful shutdown. Workload execution remains disabled and later CMP-3 functionality remains deferred.

Durable evidence and exit criteria: [CMP-3.1 worker daemon](CMP-3.1-WORKER-DAEMON.md). Compute Market Qualification #213 / run `37240782332` passed on the exact implementation SHA.

## CMP-3.2 — Hardware/software discovery
**Status: COMPLETE — Level 1 exact-head qualified on `a111b1d63083ccffa8a5afacd9529728ce0a2eab`.**

Local, read-only host discovery now reports a versioned non-authoritative worker snapshot covering portable OS/architecture/logical CPU/runtime data, richer Linux CPU/memory/graphics identifiers, and allowlisted relevant software presence without executing discovered tools or collecting sensitive host/network/credential identifiers. Benchmarking and capability evidence remain deferred to CMP-3.3.

Durable evidence: [CMP-3.2 qualification](CMP-3.2-QUALIFICATION-EVIDENCE.md). Exit criteria: [CMP-3.2 hardware/software discovery](CMP-3.2-HARDWARE-SOFTWARE-DISCOVERY.md). Compute Worker Fast Qualification #13 / run `37243425378` passed on the exact implementation SHA; evidence anchor `822877d010f38cc16d2fb15b529b11fd765f6ef7`.


## CMP-3.3 — Benchmarking and capability evidence
**Status: COMPLETE — Level 1 exact-head qualified on `0f7a5a1c3bf40308f4ab029594454f3ab7ff8795`.**

Bounded provider-neutral CPU/memory benchmarking now produces versioned, content-addressed self-reported capability evidence bound to the exact CMP-3.2 discovery snapshot. The evidence is explicitly non-authoritative, independently unattested, and not job-result correctness evidence; trusted eligibility remains owned by the canonical independent attestation/provenance path.

Durable evidence: [CMP-3.3 qualification](CMP-3.3-QUALIFICATION-EVIDENCE.md). Exit criteria: [CMP-3.3 benchmarking and capability evidence](CMP-3.3-BENCHMARKING-CAPABILITY-EVIDENCE.md). Compute Worker Fast Qualification #35 / run `37250495294` passed on the exact implementation SHA; evidence anchor `5910c6f9100b5d2e02159861a5bac94561149d9b`.


## CMP-3.4 — Secure workload sandbox
**Status: COMPLETE — Level 1 exact-head qualified on `a3ad2c5c8d70b428d61c1b70f546ec5edbeedcaf`.**

Container, microVM, WASM or equivalent isolation. Customer workloads must not execute unrestricted on the host.

A digest-pinned OCI sandbox backend now enforces non-root execution, read-only rootfs, dropped capabilities, no-new-privileges, disabled networking, bounded CPU/memory/PIDs/tmpfs/runtime/output, no host mounts/devices/namespaces, and forced cleanup on timeout. The Level 1 workflow includes a real local Docker/scratch probe that validates the isolation controls from inside the container.

Durable evidence: [CMP-3.4 qualification](CMP-3.4-QUALIFICATION-EVIDENCE.md). Exit criteria: [CMP-3.4 secure workload sandbox](CMP-3.4-SECURE-WORKLOAD-SANDBOX.md). Compute Worker Fast Qualification #64 / run `37251256261` passed on the exact implementation SHA; evidence anchor `618df14e25f7f5a567d785f4f13d8fa1263e7ec9`.


## CMP-3.5 — Content-addressed work-unit download
**Status: COMPLETE — Level 1 exact-head qualified on `14f178762534d23a5519782960735eb98a4a6ac7`.**

The worker now retrieves immutable HTTPS work-unit artifacts into private content-addressed state, streams through exact-size bounds and SHA-256 verification, rejects redirects and malformed/mutable sources, revalidates cached content before reuse, and atomically publishes only verified bytes. Download does not authorize or execute work.

Durable evidence: [CMP-3.5 qualification](CMP-3.5-QUALIFICATION-EVIDENCE.md). Exit criteria: [CMP-3.5 content-addressed work-unit download](CMP-3.5-CONTENT-ADDRESSED-WORK-UNIT-DOWNLOAD.md). Compute Worker Fast Qualification #83 / run `37252325225` passed on the exact implementation SHA; evidence anchor `81919b68dc76923e7d87d452b887949e370b0fe4`.


## CMP-3.6 — Execution lifecycle
**Status: COMPLETE — Level 1 + Level 2 exact-head qualified on `612d9e9401ab05b7d4864be751f942a8d384a162`.**

The worker now resolves exact canonical attempt authorization, revalidates the content-addressed work unit immediately before execution, streams it into the CMP-3.4 sandbox without host mounts, persists restart-safe observational execution states, distinguishes cancellation/failure/expiry/interruption, and rejects exact-attempt replay. CMP-3.6 is the first worker-runtime convergence milestone and therefore adds a dedicated app-focused Level 2 integration workflow.

Durable evidence: [CMP-3.6 qualification](CMP-3.6-QUALIFICATION-EVIDENCE.md). Exit criteria: [CMP-3.6 execution lifecycle](CMP-3.6-EXECUTION-LIFECYCLE.md). Level 1 Compute Worker Fast Qualification #115 / run `37255444231` and Level 2 Compute Worker Integration Qualification #5 / run `37255444265` both passed on the exact implementation SHA; evidence anchor `27ea5df459f398ffa56ac4ecca864bf392b99262`.


## CMP-3.7 — Checkpointing/resume
**Status: COMPLETE — Level 1 exact-head qualified on `c438a029a652fdeed42ef94b877e50b804842689`.**

The worker now persists private, monotonically sequenced, authorization-bound checkpoints and can explicitly resume only the same still-authorized interrupted attempt. Resume re-resolves canonical authorization, rehashes both the original CMP-3.5 work unit and the latest checkpoint, frames them through a versioned bounded stdin protocol, and re-enters only through the CMP-3.4 sandbox. Terminal/live attempts cannot be reopened.

Durable evidence: [CMP-3.7 qualification](CMP-3.7-QUALIFICATION-EVIDENCE.md). Exit criteria: [CMP-3.7 checkpointing/resume](CMP-3.7-CHECKPOINTING-RESUME.md). Compute Worker Fast Qualification #143 / run `37256445519` passed on the exact implementation SHA; evidence anchor `1971279df16ad20af1761766f67f116ceb61b866`.


## CMP-3.8 — Result commitment
**Status: COMPLETE — Level 1 exact-head qualified on `05a4a5f835657c0860cd78685bd274ed66134e35`.**

The worker now hashes complete sandbox stdout independently of bounded diagnostic capture, persists the full stdout SHA-256/byte count in the durable execution record, and creates private deterministic unsigned result material bound to the exact authorization/attempt/work-unit/execution context. The material exposes a bytes32-compatible base content hash; CMP-3.9 must still apply the accepted profile-defined receipt output-commitment rule before signing/submission. CMP-3.8 does not create a receipt, signature, canonical RESULT_COMMITTED transition, correctness claim, or payment authority.

Durable evidence: [CMP-3.8 qualification](CMP-3.8-QUALIFICATION-EVIDENCE.md). Exit criteria: [CMP-3.8 result commitment](CMP-3.8-RESULT-COMMITMENT.md). Compute Worker Fast Qualification #187 / run `37257986490` passed on the exact implementation/spec SHA; evidence anchor `31e1343625b6bd56d8ea059a7460d1c63c5eb587`.


## CMP-3.9 — Execution-key signed receipt
**Status: COMPLETE — Level 1 + Level 2 exact-head qualified on `ae2a3a8243a1c969857b8b06161badbcc2b0c3d7`.**

The worker now freezes the canonical CMP-0.9 ReceiptV1 tuple, resolves accepted receipt context through a fail-closed canonical authority interface, signs the EIP-712 receipt with the execution key, and separately produces the existing worker-evidence contract-compatible result authorization signature. Receipt signing remains attribution only: no correctness, canonical result-state, upload, payment or settlement authority is introduced.

Durable evidence: [CMP-3.9 qualification](CMP-3.9-QUALIFICATION-EVIDENCE.md). Exit criteria: [CMP-3.9 execution-key signed receipt](CMP-3.9-EXECUTION-KEY-SIGNED-RECEIPT.md). Level 1 Fast #211 / run `37259468746` and Level 2 Integration #59 / run `37259517488` both passed the exact implementation/spec SHA; evidence anchor `3f836d35caf7206d0b3cc6620c59f496547b4c72`.


## CMP-3.10 — Result/evidence upload
**Status: COMPLETE — Level 1 exact-head qualified on `356f8d77f3b4b6997f9f9d75e612a36d1a32a43f`.**

The worker now implements a provider-neutral, content-addressed off-chain upload boundary for exact CMP-3.8 result material, CMP-3.9 signed receipts, a versioned evidence manifest, and every evidence object required by accepted policy. The worker validates the complete ordered evidence set, exact size/SHA-256 digests, privacy/access/retention/provenance bindings, byte ceilings, deterministic object idempotency and transport receipt identity before recording a non-authoritative upload completion.

CMP-3.10 does not invent a general ComputeMarket HTTP endpoint, 420Storage agreement/capacity authority, 420AI dependency, correctness verdict, canonical `RESULT_COMMITTED`, or payment/settlement authority.

Durable evidence: [CMP-3.10 qualification](CMP-3.10-QUALIFICATION-EVIDENCE.md). Exit criteria and implementation boundary: [CMP-3.10 result/evidence upload](CMP-3.10-RESULT-EVIDENCE-UPLOAD.md). Fast #233 / run `37261236505` / job `111608720907` passed the exact implementation/spec SHA; evidence anchor `8a72024fc27543f7754b624be2cada39d4b13849`.

## CMP-3.11 — Local resource controls
**Status: COMPLETE — Level 1 exact-head qualified on `56893c5b814d14138eaafec71f1b784d4b110189`.**

CPU/GPU percentage, idle-only mode, thermal ceilings, bandwidth and schedule controls.

The worker now provides a versioned operator-local resource policy; automatic hard CPU quota application to the OCI sandbox; fail-closed GPU-share enforcement contracts; timezone-aware weekly schedules; continuous idle/thermal monitoring capable of cancelling active execution leases; deterministic bandwidth shaping wired into work-unit downloads and result/evidence uploads; concrete Linux /proc/sysfs telemetry; and strict node420-compute operator flags.

GPU percentage never becomes advisory: GPU work is rejected unless a qualified platform-specific share enforcer is supplied. CMP-3.11 does not weaken CMP-3.4 isolation or gain canonical job/correctness/payment authority.

Durable evidence: [CMP-3.11 qualification](CMP-3.11-QUALIFICATION-EVIDENCE.md). Exit criteria and implementation boundary: [CMP-3.11 local resource controls](CMP-3.11-LOCAL-RESOURCE-CONTROLS.md). Fast #272 / run `37262445914` / job `111612318856` passed the exact implementation/spec/workflow SHA; evidence anchor `0f63e91ae9406cdf0a5d27d7c6211fa64d7ced4b`.

## CMP-3.12 — Malicious workload protections
**Status: COMPLETE — Level 1 exact-head qualified on `691d6296756281bc8424c17d4ad8597bf0a034b6`.**

The worker now adds digest-bound malicious-workload admission and containment on top of the existing sandbox/resource limits: bounded canonical argv, immutable image/command deny policy, cumulative local violation tracking, restart-safe quarantine, private non-authoritative incident evidence, protected fresh/resume execution wrappers, and additional OCI IPC/core-dump/file-descriptor hardening.

The implementation deliberately does not invent antivirus/EDR, content scanning, image-signature infrastructure, canonical slashing or correctness authority where the repository defines none.

Durable evidence: [CMP-3.12 qualification](CMP-3.12-QUALIFICATION-EVIDENCE.md). Exit criteria and implementation boundary: [CMP-3.12 malicious workload protections](CMP-3.12-MALICIOUS-WORKLOAD-PROTECTIONS.md). Fast #313 / run `37264388818` / job `111618008159` passed the exact implementation/spec/workflow SHA; evidence anchor `279c78a240f5a7223341bf4461978792812b44b3`.

## CMP-3.13 — Windows/Linux/macOS packaging
**Status: COMPLETE — Level 1 exact-head qualified on `6a5e82bbaa2fd9073c8d6f3415f2460048f115ca`.**

The worker now has deterministic Windows/Linux/macOS packages for amd64 and arm64, exact version/source-commit identity, CGO-disabled cross-builds, per-package metadata, SHA-256 manifests, safe argument-file launchers, explicit platform state directories, Linux systemd material, macOS launchd material, and Windows limited-user startup-task material.

Packaging does not claim native runtime certification, code signing/notarization, live worker deployment, or Level 3 merge-candidate readiness.

Durable evidence: [CMP-3.13 qualification](CMP-3.13-QUALIFICATION-EVIDENCE.md). Exit criteria and implementation boundary: [CMP-3.13 Windows/Linux/macOS packaging](CMP-3.13-WINDOWS-LINUX-MACOS-PACKAGING.md). Fast #344 / run `37269147888` / job `111632222887` passed the exact implementation/spec/workflow SHA; package artifact ID `11327388973`; evidence anchor `32b4e5a55dd71a54ff948f8360746592b17a864f`.

## CMP-3.14 — Phase closeout
**Status: COMPLETE — Level 3 exact-head qualified on `0fcb699e6270bc863538eacb08ba204ce2f41b6c`.**

Reconcile the complete accumulated CMP-3 node420 worker runtime against current `main`, establish one exact merge-candidate implementation SHA, run the canonical Level 3 owners once, preserve durable exact-SHA evidence, and hand off to CMP-4 only after every applicable closeout gate passes.

Closeout inventory: [CMP-3.14 phase closeout](CMP-3.14-PHASE-CLOSEOUT.md). Durable evidence: [CMP-3.14 qualification](CMP-3.14-QUALIFICATION-EVIDENCE.md).

---

# CMP-4 — Scientific compute framework

Purpose: make scientific/research workloads first-class while keeping the market general-purpose.

## CMP-4.1 — Scientific Work Unit specification

**Status: COMPLETE — Level 1 exact-head qualified on `8e4199c7d1e8b883a3518167a4093dae4899598a`.**

Specification and machine-readable contract: [CMP-4.1 scientific work unit](CMP-4.1-SCIENTIFIC-WORK-UNIT-SPECIFICATION.md). Durable evidence: [CMP-4.1 qualification](CMP-4.1-QUALIFICATION-EVIDENCE.md).

Each work unit should bind:

- research project;
- executable/container commitment;
- dataset/input commitment;
- parameters;
- resource class;
- output schema;
- verification strategy;
- deadline;
- reward/funding reference.

## CMP-4.2 — Research Project Registry

**Status: COMPLETE — Level 1 exact-head qualified on `8e4199c7d1e8b883a3518167a4093dae4899598a`.**

Owner-controlled, revisioned project identity/commitment and new-work admission registry. Durable specification: [CMP-4.2 Research Project Registry](CMP-4.2-RESEARCH-PROJECT-REGISTRY.md). Durable evidence: [CMP-4.2 qualification](CMP-4.2-QUALIFICATION-EVIDENCE.md).

## CMP-4.3 — Researcher / institution identity

**Status: COMPLETE — Level 1 exact-head qualified on `8e4199c7d1e8b883a3518167a4093dae4899598a`.**

Compute-scoped role binding to canonical `Identity420` profiles and credentials, with dynamic credential/profile validity, role-specific assurance, append-only revisions and controller-transfer recovery semantics. Specification: [CMP-4.3 researcher / institution identity](CMP-4.3-RESEARCHER-INSTITUTION-IDENTITY.md). Durable evidence: [CMP-4.3 qualification](CMP-4.3-QUALIFICATION-EVIDENCE.md).

## CMP-4.4 — Dataset manifests

**Status: COMPLETE — Level 1 exact-head qualified on `8e4199c7d1e8b883a3518167a4093dae4899598a`.**

Revisioned, project-bound dataset manifests bind the canonical scientific input commitment to schema, access-policy, provenance, partition/layout and size commitments without placing raw datasets or access credentials on chain. Specification: [CMP-4.4 dataset manifests](CMP-4.4-DATASET-MANIFESTS.md). Durable evidence: [CMP-4.4 qualification](CMP-4.4-QUALIFICATION-EVIDENCE.md).

## CMP-4.5 — Reproducible execution environments

**Status: COMPLETE — Level 1 exact-head qualified on `31fc4fd39b283fd3a49eef514c55863551646da6`.**

Project-bound revisioned execution-environment commitments freeze artifact, runtime, dependency, command, platform, sandbox and reproducibility semantics behind the scientific work-unit executable/container binding. Specification: [CMP-4.5 reproducible execution environments](CMP-4.5-REPRODUCIBLE-EXECUTION-ENVIRONMENTS.md). Durable evidence: [CMP-4.5 qualification](CMP-4.5-QUALIFICATION-EVIDENCE.md).

## CMP-4.6 — Result provenance

**Status: COMPLETE — Level 1 + first CMP-4 Level 2 exact-head qualified on `01824d6488a14d74d86ea6f1c6c8a4ecbd45d878`.**

Immutable scientific result provenance links the exact CMP-4.1 scientific work-unit commitment to canonical result-bearing attempt, worker result, receipt-bound execution evidence, output schema, verifier and canonical verification decision without creating a second correctness or settlement authority. Specification: [CMP-4.6 result provenance](CMP-4.6-RESULT-PROVENANCE.md). Durable evidence: [CMP-4.6 qualification](CMP-4.6-QUALIFICATION-EVIDENCE.md).

CMP-4.6 is the first CMP-4 app-integration milestone because project/dataset/environment/scientific-unit semantics converge with canonical worker result and verifier state here.

## CMP-4.7 — Scientific metadata and lineage

**Status: COMPLETE — Level 1 exact-head qualified on `f7389d8c9755721058a073a1ad19747ca95c4572`.**

Project-authenticated metadata commitments and parent-first provenance edges bind scientific interpretation and derivation lineage to exact canonical CMP-4.6 result provenance without placing raw research metadata on chain or creating correctness/access/economic authority. Specification: [CMP-4.7 scientific metadata and lineage](CMP-4.7-SCIENTIFIC-METADATA-LINEAGE.md). Durable evidence: [CMP-4.7 qualification](CMP-4.7-QUALIFICATION-EVIDENCE.md).

CMP-4.7 is an ordinary Level 1 step. CMP-4.6 remains the most recent CMP-4 Level 2 integration milestone.

## CMP-4.8 — Publication / retention policy

**Status: COMPLETE — Level 1 exact-head qualified on `fae498b72b2693f4264df3f208ebbe6a1e1d44bf`.**

Versioned project-authorized publication/access/retention commitments now bind exact CMP-4.7 lineage records with explicit PRIVATE/RESTRICTED/PUBLIC semantics, embargo and retention windows, append-only policy history, and fail-closed canonicality. Raw scientific bytes remain off-chain. Specification: [CMP-4.8 publication / retention policy](CMP-4.8-PUBLICATION-RETENTION-POLICY.md). Durable evidence: [CMP-4.8 qualification](CMP-4.8-QUALIFICATION-EVIDENCE.md).

CMP-4.8 is an ordinary Level 1 step. CMP-4.6 remains the most recent CMP-4 Level 2 integration milestone.

## CMP-4.9 — Research dashboard

**Status: COMPLETE — Level 1 + second CMP-4 Level 2 exact-head qualified on `12186148274f643dfe4b1d07b194d3fffd3aa23b`.**

A versioned read-only canonical research dashboard now composes exact CMP-4.2 project state, CMP-4.6 result provenance, CMP-4.7 metadata/lineage and CMP-4.8 publication policy without creating parallel authority or premature CMP-8 UI. Specification: [CMP-4.9 research dashboard](CMP-4.9-RESEARCH-DASHBOARD.md). Durable evidence: [CMP-4.9 qualification](CMP-4.9-QUALIFICATION-EVIDENCE.md). Compute Market Qualification #427 / run `37501862650` passed on the exact implementation SHA.

CMP-4.9 is the second CMP-4 app-integration milestone because the complete scientific-framework graph converges into one canonical consumer surface before phase closeout.

## CMP-4.10 — Phase closeout

**Status: LEVEL 3 CLOSEOUT CANDIDATE — exact-head comprehensive qualification pending.**

Reconcile the complete accumulated CMP-4 scientific framework against current `main`, force the canonical four-shard Solidity inventory, independently verify Genesis/address authority without duplicate Foundry execution, run global/Docs and retained Compute qualification, and preserve one exact merge-candidate SHA as phase-closeout evidence. Closeout definition: [CMP-4.10 phase closeout](CMP-4.10-PHASE-CLOSEOUT.md).

---

# CMP-5 — External distributed-compute adapters

Purpose: allow useful computation already performed in compatible external systems to be attested/rewarded without forcing every research project to rewrite its software for 420.

Potential adapters, where technically and administratively permitted:

## CMP-5.1 — Folding@home adapter

**Status: COMPLETE — Level 1 exact-head qualified on `aa8ebaeb243946b679766fb6d023f39acec42dc2`.**

Normalize Folding@home project/work-unit/donor/assignment/result/credit/evidence material into stable domain-separated 420Integrated commitments without claiming external truth, reward entitlement, settlement authority or duplicate protection. External-result attestation remains CMP-5.7 and double-reward prevention remains CMP-5.6. Specification: [CMP-5.1 Folding@home adapter](CMP-5.1-FOLDING-AT-HOME-ADAPTER.md). Durable evidence: [CMP-5.1 qualification](CMP-5.1-QUALIFICATION-EVIDENCE.md).

## CMP-5.2 — BOINC adapter

**Status: COMPLETE — Level 1 + first CMP-5 Level 2 exact-head qualified on `f463deb41f5e9de396a81d5ffbe0fc205c72f5a0`.**

Normalize BOINC project/application/work-unit/participant/host/assignment/result/timing/credit/evidence material behind the shared provider-neutral external-adapter identity surface. CMP-5.2 is the first CMP-5 Level 2 integration milestone because the Folding-at-home and BOINC adapter families now converge under one narrow interface while remaining domain-separated. External truth remains CMP-5.7 and duplicate-reward protection remains CMP-5.6. Specification: [CMP-5.2 BOINC adapter](CMP-5.2-BOINC-ADAPTER.md).

## CMP-5.3 — Research-cluster adapter

**Status: COMPLETE — Level 1 exact-head qualified on `a2c7c1eee735f86ecc555d8de265805359c57fdb`.**

Normalize research-cluster identity/scheduler/project/workload/submitter/allocation/result/lifecycle/resource/evidence material behind the existing provider-neutral external-adapter identity surface. Optional node-set identity is supported without weakening mandatory bindings. CMP-5.2 remains the first CMP-5 Level 2 integration milestone; CMP-5.3 is an ordinary Level 1 extension. External truth remains CMP-5.7 and duplicate-reward protection remains CMP-5.6. Specification: [CMP-5.3 Research-cluster adapter](CMP-5.3-RESEARCH-CLUSTER-ADAPTER.md). Durable evidence: [CMP-5.3 qualification](CMP-5.3-QUALIFICATION-EVIDENCE.md).

## CMP-5.4 — University/HPC gateway

**Status: COMPLETE — Level 1 exact-head qualified on `e7cc08829b470c6048e2a06cef3f22411630d809`.**

Normalize institution/gateway/scheduler/account/project/workload/allocation/result/lifecycle/resource/accounting/evidence material behind the existing provider-neutral adapter identity surface. Queue/partition identity is optional. CMP-5.2 remains the most recent Level 2 milestone; CMP-5.4 is an ordinary Level 1 extension. External truth remains CMP-5.7 and duplicate-reward protection remains CMP-5.6. Specification: [CMP-5.4 University/HPC gateway](CMP-5.4-UNIVERSITY-HPC-GATEWAY.md). Durable evidence: [CMP-5.4 qualification](CMP-5.4-QUALIFICATION-EVIDENCE.md).

## CMP-5.5 — External proof/credit adapters

**Status: COMPLETE — Level 1 + second CMP-5 Level 2 exact-head qualified on `41b3f7e9c84226c8b294f2b7a5af730c928ece61`.**

Normalize externally supplied proof and credit records against exact adapter/system/contribution identities, preserving provider-neutral scheme/issuer/unit semantics without claiming external truth, reward eligibility or duplicate protection. CMP-5.5 is the second CMP-5 Level 2 milestone because the accumulated external adapter families now converge into one shared proof/credit normalization layer. CMP-5.6 owns duplicate-reward prevention and CMP-5.7 owns external-result attestation. Specification: [CMP-5.5 External proof/credit adapters](CMP-5.5-EXTERNAL-PROOF-CREDIT-ADAPTERS.md). Durable evidence: [CMP-5.5 qualification](CMP-5.5-QUALIFICATION-EVIDENCE.md).

## CMP-5.6 — Double-reward prevention

**Status: COMPLETE — Level 1 + third CMP-5 Level 2 exact-head qualified on `505eea3d3eeb8e23c9a6f3a958e6afbc84946b02`.**

Add one-time canonical external-work consumption so alternate proof/credit records, reward references, evidence, or source wrappers cannot manufacture a second 420 reward opportunity for the same canonical external work. Governance-authorized, code-hash-pinned consumers prevent permissionless claim burning. CMP-5.7 remains the external-truth/canonical-work mapping owner; CMP-6 remains reward-economics/settlement owner. Specification: [CMP-5.6 Double-reward prevention](CMP-5.6-DOUBLE-REWARD-PREVENTION.md). Durable evidence: [CMP-5.6 qualification](CMP-5.6-QUALIFICATION-EVIDENCE.md).

## CMP-5.7 — External-result attestation

**Status: COMPLETE — Level 1 + fourth CMP-5 Level 2 exact-head qualified on `e04d6baa0e636a361ef7dd8d046f5a31ff2f72d4`.**

Add trusted, revocable external-result attestation and the authoritative mapping from normalized external source/result/proof-or-credit evidence into one canonical external-work commitment. Conflicting remaps fail closed; equivalent source wrappers may converge on the same canonical work. CMP-5.6 remains one-time duplicate-consumption authority; CMP-6 remains reward-economics/settlement authority. Specification: [CMP-5.7 External-result attestation](CMP-5.7-EXTERNAL-RESULT-ATTESTATION.md). Durable evidence: [CMP-5.7 qualification](CMP-5.7-QUALIFICATION-EVIDENCE.md).

## CMP-5.8 — Phase closeout

---

# CMP-6 — Useful-computation rewards

Purpose: provide application-layer incentives for verified useful compute. Compute rewards must not replace chain consensus.

## CMP-6.1 — Funding sources
Researcher, university, grant, philanthropic, community and ecosystem-funded jobs/pools.

## CMP-6.2 — Verification-gated rewards

## CMP-6.3 — Contribution accounting
Verified work units, CPU/GPU hours, project credit and other policy-defined metrics.

## CMP-6.4 — Research reward pools
Examples: cancer research, protein folding, climate simulation, astronomy, drug discovery.

## CMP-6.5 — Sponsor matching

## CMP-6.6 — Anti-Sybil / anti-farming economics

## CMP-6.7 — Transparent reward accounting

## CMP-6.8 — Phase closeout

---

# CMP-7 — SDK, API, CLI and indexer

## CMP-7.1 — @420/compute-sdk

## CMP-7.2 — Job submission API

## CMP-7.3 — Worker API

## CMP-7.4 — Verifier API

## CMP-7.5 — Research project API

## CMP-7.6 — Compute indexer

## CMP-7.7 — Historical analytics

## CMP-7.8 — Developer documentation

## CMP-7.9 — CLI
Examples: compute submit, worker, status, verify and rewards.

## CMP-7.10 — Phase closeout

---

# CMP-8 — 420Compute application

Purpose: provide the human-facing market and participation experience.

Required user surfaces:

- researcher/job-owner submission;
- worker onboarding;
- verifier operations;
- research-project management;
- worker health and earnings;
- jobs completed;
- CPU/GPU contribution;
- projects supported;
- result/verification status;
- reputation and stake.

The participation loop should be simple enough that a user can install the worker, choose resource limits/projects and contribute useful compute without understanding internal protocol mechanics.

---

# CMP-9 — Public testnet compute

Purpose: turn repository qualification into real deployed evidence.

## CMP-9.1 — Deploy canonical contracts

## CMP-9.2 — ProtocolRegistry publication

## CMP-9.3 — Operate real worker machines

## CMP-9.4 — Submit real funded $420 jobs

## CMP-9.5 — Match real workers

## CMP-9.6 — Execute real work units

## CMP-9.7 — Verify real results

## CMP-9.8 — Pay real workers

## CMP-9.9 — Execute real refunds

## CMP-9.10 — Execute real disputes

## CMP-9.11 — Slash test collateral

## CMP-9.12 — Multi-worker replicated jobs

## CMP-9.13 — Scientific workload demonstration

## CMP-9.14 — Long-duration soak testing

## CMP-9.15 — Close CMP-0 operational qualification

---

# CMP-10 — Security and adversarial qualification

Required campaigns include:

- external smart-contract audit;
- worker sandbox audit;
- malicious workload testing;
- malicious worker/verifier/scheduler testing;
- collusion;
- Sybil workers;
- fraudulent benchmarks/hardware claims;
- duplicated/stolen/replayed results;
- reward farming;
- DoS;
- dataset poisoning;
- supply-chain attacks;
- sandbox/container escape;
- key compromise;
- economic insolvency;
- stake/slash abuse.

End with an incentivized public testnet and retained qualification evidence.

---

# CMP-11 — Mainnet Compute Market

Production target flow:

1. researcher/job owner creates and funds a job;
2. matching proposes an eligible resource;
3. canonical contracts validate worker/resource/capacity/funding/policy;
4. node420 executes the accepted work unit in isolation;
5. worker signs result/receipt with the frozen execution key;
6. verifier policy validates the result;
7. disputes/challenges execute if required;
8. verified entitlement settles through 420Vault;
9. worker earns $420 for useful computation.

---

# Status dashboard

| Layer | Status |
| --- | --- |
| CMP-0 protocol/specification | substantially designed; operational closeout open |
| CMP-1.1 JobRegistry | built / repository-qualified scope |
| CMP-1.2 ComputeEscrow/Vault accounting | repository-qualified; live/stake dependencies remain |
| CMP-1.3 WorkerRegistry | current: CMP-1.3.16 closeout |
| CMP-1.4 VerifierRegistry | repository-qualified through CMP-1.4.12 |
| CMP-1.5 ComputeStake | current: CMP-1.5.13 Level 3 phase closeout; CMP-1.5.0–1.5.12 repository-qualified |
| CMP-2 matching marketplace | CMP-2.1–CMP-2.7 COMPLETE; CMP-2.8 Level 3 comprehensive qualification in progress |
| CMP-3 node420 worker runtime | CMP-3.1–CMP-3.14 COMPLETE; Level 3 exact-head qualified |
| CMP-4 scientific compute framework | CMP-4.1–CMP-4.9 COMPLETE; CMP-4.9 is the second Level 2 integration milestone; CMP-4.10 Level 3 phase closeout next |
| CMP-5 external compute adapters | CMP-5.1–CMP-5.7 COMPLETE; CMP-5.7 is the fourth CMP-5 Level 2 milestone; CMP-5.8 Level 3 phase closeout next |
| CMP-6 useful-compute rewards | forthcoming |
| CMP-7 SDK/API/indexer | forthcoming |
| CMP-8 420Compute UI | forthcoming |
| CMP-9 public testnet | forthcoming |
| CMP-10 security/adversarial qualification | forthcoming |
| CMP-11 mainnet | forthcoming |

---

# Immediate execution order

After CMP-1.3.16:

1. CMP-1.4 ComputeVerifierRegistry;
2. CMP-1.5 ComputeStake;
3. CMP-2 matching;
4. CMP-3 node420 worker runtime;
5. CMP-4 scientific workload framework;
6. CMP-5 external distributed-compute adapters;
7. CMP-6 useful-computation rewards;
8. CMP-7 SDK/API/indexer;
9. CMP-8 420Compute UI;
10. CMP-9 public testnet;
11. CMP-10 security/adversarial qualification;
12. CMP-11 mainnet.

## Roadmap integrity rule

Do not silently renumber, collapse, replace or reinterpret these phases. If a later audit finds that scope must change, amend this roadmap explicitly with repository evidence, rationale and migration notes. Existing canonical CMP-1.1–CMP-1.5 numbering remains preserved.
