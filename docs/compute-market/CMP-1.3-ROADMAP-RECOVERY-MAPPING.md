# CMP-1.3 roadmap recovery and completed-work mapping

Status: **RECOVERY PARTIAL; 1.3.0–1.3.7 IMPLEMENTATION MAPPED; AUTHORITATIVE 1.3.8–1.3.16 TEXT STILL UNRECOVERED.**

This record exists because the detailed CMP-1.3.0–CMP-1.3.16 roadmap was established in a prior ChatGPT conversation but was not committed to the repository. The repository later drifted by treating a newly invented CMP-1.3.8 closeout as authoritative. That numbering has been removed.

This document records only what can be supported by preserved conversation context and repository history. It does not manufacture missing roadmap text.

## Recovered controlling CMP-1.3 requirement

ComputeWorkerRegistry must cover:

- worker address / operator identity;
- node execution/public-key identity;
- supported architectures;
- CPU classes;
- GPU classes;
- VRAM;
- memory;
- storage;
- network capabilities;
- software capabilities;
- optional jurisdiction metadata;
- reputation;
- stake;
- status;
- trusted benchmarking/attestation rather than relying on self-reported hardware alone.

The frozen CMP-1.3.0 integration design additionally requires reuse of canonical provider/node/resource identity, 420Trust evidence, CMP-1.5 compute-collateral authority, exact revision history, fail-closed parent/policy eligibility, accepted-job historical identity, and registry-resolved deployment.

## Completed-work mapping

### CMP-1.3.0 — baseline and integration design

Recovered intent:
- reconcile existing provider/node/resource, Trust and stake surfaces;
- freeze the non-duplicative WorkerRegistry authority boundary;
- define worker identity/revision, execution key, capability profile, attestation, reputation, stake-reference, status and historical semantics;
- define adversarial/invariant/deployment qualification requirements.

Repository artifact:
- `docs/compute-market/CMP-1.3.0-WORKER-REGISTRY-BASELINE-AND-INTEGRATION-DESIGN.md`

Disposition:
- **implemented as design/audit baseline**.

### CMP-1.3.1 — worker identity and lifecycle

Implemented:
- permanent provider/node/resource ancestry;
- operator identity;
- execution-key possession proof;
- revisioned historical worker records;
- exact resource revision binding;
- lifecycle REGISTERED / ACTIVE / SUSPENDED / RETIRED;
- profile refresh and execution-key rotation;
- fail-closed parent/resource eligibility.

Repository artifacts:
- `ComputeWorkerRegistry420.sol`
- `ComputeWorkerRegistry420.t.sol`

Qualified historical head:
- `505851b33cf4ac3f81d030269c1bae16ac661f18`

Disposition:
- **implemented and repository-qualified**.

### CMP-1.3.2 — trusted capability attestation

Implemented:
- provider-neutral attestation policy;
- benchmark / TEE / inspection evidence classes;
- exact worker/revision/resource/profile/key binding;
- trusted attester policy;
- expiry and revocation;
- replay resistance;
- fail-closed admission.

Repository artifacts:
- `ComputeWorkerAttestation420.sol`
- `ComputeWorkerAttestedEligibility420.sol`
- dedicated Foundry tests and qualification record.

Disposition:
- **implemented; retained in later whole-branch qualification**.

### CMP-1.3.3 — canonical capability profile and matching predicates

Implemented:
- bounded canonical architecture/CPU/GPU/software sets;
- VRAM, memory, storage, network scalars;
- storage/network/runtime commitments;
- immutable exact-worker-revision profile;
- resource-class constrained matching;
- optional trusted-attestation composition.

Repository artifacts:
- `ComputeWorkerCapabilityProfile420.sol`
- `ComputeWorkerCapabilityEligibility420.sol`
- dedicated tests and qualification record.

Final evidence head:
- `bed8e60287eee5403e023ab8dad30e4a6fa90b82`

Disposition:
- **COMPLETE**.

### CMP-1.3.4 — 420Trust reputation references

Implemented:
- policy-scoped 420Trust metrics;
- no universal mutable reputation score;
- immutable worker-revision reputation references;
- current live Trust state remains authoritative for new admission;
- no correctness, settlement, stake, slash or lifecycle authority.

Repository artifacts:
- `ComputeWorkerTrust420.sol`
- dedicated tests and qualification record.

Historical caveat:
- candidate `67195b992f7793ac8012af130085bcf0902c23d4` qualified;
- evidence head `ba11ab000f819e7d34408536ef58cf6ef20b5692` had Docs/Solidity success but its Integrated run was cancelled;
- later descendant whole-branch qualification retains the same implementation.

Disposition:
- **implemented; historical evidence-head closeout caveat preserved**.

### CMP-1.3.5 — compute-stake binding

Implemented:
- typed/versioned binding to future CMP-1.5 compute collateral;
- stake-required admission fails closed while source is unbound;
- rejects validator stake, wallet balances and payer escrow as substitutes;
- live worker/policy-specific collateral read;
- immutable historical stake references;
- no custody or slash authority.

Repository artifacts:
- `IComputeStakeSource420.sol`
- `ComputeWorkerStake420.sol`
- dedicated tests and qualification record.

Final evidence head:
- `4d95792fc8fd0a144ef484294927bc5936de2cd5`

Disposition:
- **implemented and final evidence head repository-qualified**.

### CMP-1.3.6 — accepted-job worker execution snapshot

Implemented:
- accepted job binds exact worker ID/revision;
- provider/node/resource and resource revision frozen;
- execution signer/key commitment frozen;
- capability, Trust and stake-reference context frozen;
- later worker/resource/policy mutation cannot rewrite accepted historical execution identity;
- duplicate assignment/result replay protections.

Repository artifacts:
- `ComputeJobWorkerSnapshotEvidence420.sol`
- dedicated tests and qualification record.

Final evidence head:
- `56523d6a869fd1730b6c94607861df2ae70e7db0`

Disposition:
- **implemented and final evidence head repository-qualified**.

### CMP-1.3.7 — deployment/publication qualification package

Implemented:
- exact component graph verifier;
- runtime code-hash checks;
- exact WorkerRegistry/job/admission graph checks;
- chain/governance binding;
- fail-closed live evidence manifest;
- ProtocolRegistry publication requirements;
- no synthetic deployment evidence.

Repository artifacts:
- `ComputeWorkerCanonicalWiring420.sol`
- `ComputeWorkerCanonicalWiring420.t.sol`
- `cmp-1.3.7-worker-deployment-evidence.json`
- `verify-cmp-1-3-7-deployment.py`
- qualification record.

Candidate head:
- `c7dc959d19c798ff587edf1da9106a81ae772e7a`

Repository qualification:
- Docs success;
- Solidity 16/16 success;
- Integrated success;
- Genesis Address Authority success.

Live blockers remain:
- canonical public testnet not live;
- live CMP-1.5 compute-stake source unavailable;
- therefore no truthful live addresses/transactions/blocks/runtime hashes/ProtocolRegistry publication.

Disposition:
- **repository package qualified; live deployment blocked**.

## Recovery boundary

The prior conversation is known to have defined CMP-1.3.0 through CMP-1.3.16 and to have placed additional authorized work after CMP-1.3.7.

The exact text, titles and acceptance criteria for CMP-1.3.8 through CMP-1.3.16 are not present in:
- the current repository;
- accessible historical versions of `CMP-1-IMPLEMENTATION-ROADMAP.md`;
- recoverable indexed prior-conversation context.

Therefore:
- CMP-1.3.8 is **not** a phase-closeout step merely because the repository reached deployment-package work;
- CMP-1.3.8 through CMP-1.3.16 must not be reconstructed from guesswork and represented as recovered fact;
- the mistakenly created closeout work is preserved under `CMP-1.3-DEFERRED-CLOSEOUT-DRAFT.md`;
- no later CMP-1.3 step should be marked complete until its authoritative original definition is recovered.

