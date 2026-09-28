# CMP-1.3.0 — ComputeWorkerRegistry baseline audit and frozen integration design

Status: **DESIGN BASELINE COMPLETE; executable worker registration remains CMP-1.3.1+ and live attestation/stake/reputation authorities remain separately gated.**

Baseline authority: `main` commit `dd50a7a86831e4c1389205e621cfc678328404bd`, immediately after qualified CMP-1.2 was merged. This step reconciles the original CMP-1.3 ComputeWorkerRegistry requirements with the frozen V1 provider/node/resource architecture. It does not deploy a worker registry, assert self-reported hardware as trusted, create compute stake, publish a reputation score, or authorize paid work.

## 1. Original CMP-1.3 requirements

Workers must be able to register or expose, through canonical worker state:

- worker address
- node public key
- supported architectures
- CPU classes
- GPU classes
- VRAM
- memory
- storage
- network capabilities
- software capabilities
- optional jurisdiction metadata
- reputation
- stake
- status

The controlling roadmap additionally requires that self-reported hardware is never sufficient by itself. Capabilities must ultimately be benchmarked, attested, or otherwise independently qualified before they can become trusted eligibility evidence.

## 2. Current source inventory and authority reconciliation

| Source / surface | Current repository semantics | CMP-1.3.0 decision |
| --- | --- | --- |
| `ComputeProviderRegistry420` | Stable provider identity, operator, settlement account, manifest/security references, revision history and REGISTERED/ACTIVE/SUSPENDED/RETIRED lifecycle. Explicitly holds no stake and certifies no hardware. | Reuse provider identity and operator authority. Do not create a second worker-level economic provider identity or beneficiary. |
| `ComputeNodeRegistry420` | Permanent provider parent, operator, node manifest, endpoint commitment/expiry, revision history and lifecycle. It has no canonical node signing public key. | Reuse node identity and immutable provider parentage. CMP worker registration must bind to one existing node revision and add a domain-specific execution-signing key or key commitment without making the node movable between providers. |
| `ComputeResourceRegistry420` | Resource belongs to one node/provider and stores compute class, hardware/runtime/capability hashes, capacity units, revisions and availability. Comments explicitly state that it is advertised capacity only and has no reservation/metering engine. | Reuse resource identity and class. Do not duplicate resource ownership. Worker capability detail may be committed through a versioned capability profile referenced by the worker record, while admission continues to require the canonical resource revision. |
| `ComputeOfferRegistry420` / accepted-price match | Accepted paid work already binds provider, node, resource and resource revision. | Worker eligibility must consume these exact frozen identities. A worker record cannot substitute a different resource/operator after match acceptance. |
| `ComputeJobRegistry420` and worker evidence | Job lifecycle and accepted worker evidence are job-scoped and replay guarded. | CMP-1.3 supplies authoritative worker eligibility/identity inputs; it does not rewrite job lifecycle or make a worker signature equivalent to correctness. |
| `ComputeIdentitySnapshot420`, `ComputeIdentityGuard420`, `ComputeIdentityHistory420` | Existing experimental composition/snapshot/history helpers over provider/node/resource state. | May be reused as read-only historical evidence where exact semantics match. They are not the original CMP-1.3 deliverable and must not be relabeled as ComputeWorkerRegistry. |
| `Stake420` / validator staking surfaces | Genesis validator-staking/read surfaces. They are not a general ComputeMarket worker-collateral ledger. | Do not reuse validator stake as compute collateral. CMP-1.3 worker records may carry only a typed reference to the independently qualified CMP-1.5 stake source. Until CMP-1.5 exists and is bound, stake-required eligibility must fail closed. |
| 420Trust architecture | Stores authenticated post-finality performance/dispute evidence; no universal provider score is canonical. | Reputation in CMP-1.3 is a reference/snapshot of qualified 420Trust evidence or a policy-specific derived view, never an arbitrary mutable universal score controlled by the worker registry. |
| Capability Registry / `ComputeAuthorization420` | Object/action-scoped authorization. | Registration/update/status operations must use narrowly scoped worker actions and must never imply Vault, governance, validator, bridge, wallet or verifier authority. |

## 3. Canonical worker model frozen by this step

CMP-1.3 will introduce an explicitly named `ComputeWorkerRegistry420` as a **worker execution identity and eligibility registry**, not as a replacement provider, node, resource, trust or stake registry.

A worker is bound to:

- one immutable `providerId`;
- one immutable `nodeId`;
- one worker/operator account;
- one execution-signing key commitment;
- a versioned capability profile;
- optional privacy-minimized jurisdiction/policy metadata;
- typed references to reputation evidence and compute-stake state;
- a revisioned worker status.

The provider/node parents cannot change for an existing worker ID. If execution moves to a different provider or node, a new worker identity is required.

### 3.1 Worker ID and revisions

Worker IDs must be chain- and registry-domain-separated and derived from a monotonic nonzero serial plus immutable parent identifiers. IDs are never reassigned.

Each material update creates a new revision preserving historical state. Accepted jobs bind the exact worker revision used for admission so later key/capability/status changes cannot rewrite historical execution identity.

### 3.2 Worker address and signing key

The worker/operator address is the account authorized to maintain the worker record and accept assigned work subject to existing scoped authorization.

The node execution public key is separate from the account address. The registry stores either the canonical public key bytes when bounded and practical or, preferably for V1, a nonzero versioned key commitment plus key type/domain. Registration and rotation require proof that the registering operator controls the corresponding execution key. A key rotation suspends the new revision from fresh paid admission until the applicable policy/attestation gate is satisfied.

A provider operator or governance address cannot silently replace an accepted job's worker signing key.

### 3.3 Capability profile

Self-reported fields are represented through a versioned capability profile committed by hash and, where matching needs exact on-chain predicates, by bounded canonical scalar fields.

The profile must cover at minimum:

- supported architectures;
- CPU classes;
- GPU classes;
- VRAM;
- system memory;
- storage capacity/class;
- network capability;
- software/runtime capability;
- optional jurisdiction/policy metadata.

The existing `ComputeResourceRegistry420.computeClass`, `hardwareProfileHash`, `runtimeProfileHash`, `capabilityHash` and `capacityUnits` remain authoritative resource-layer inputs. The worker profile refines execution capability; it cannot broaden the bound resource beyond the resource registry or accepted offer.

No commercial hardware model string becomes a consensus-critical enum merely because it is self reported.

### 3.4 Capability trust and attestation

Worker registration records **claims**, not trusted truth.

A capability can be used by a policy that requires trusted hardware only when the worker's exact revision has a live attestation/benchmark reference accepted by the bound capability-attestation policy. The attestation surface must be replaceable and provider-neutral. Future supported evidence may include benchmark attestations, TEE/device attestations, independently signed operator inspections, or other versioned methods.

The worker registry itself does not declare a benchmark successful. It stores the evidence reference/status needed for deterministic eligibility checks.

Changing hardware, software, execution key, jurisdiction metadata, or capability commitment invalidates prior capability attestation for new work unless the bound policy explicitly proves the new revision equivalent.

### 3.5 Reputation

There is no canonical universal mutable reputation score in ComputeMarket V1.

The worker record may expose:

- a `reputationReference` to authenticated 420Trust evidence;
- a policy/version identifier describing how a client may derive a view;
- an optional immutable snapshot/commitment when a match explicitly binds a reputation threshold.

Reputation never grants correctness, custody, stake, matching, slashing or settlement authority.

### 3.6 Stake

CMP-1.3 does not create collateral. Worker stake is represented as a typed `stakeReference`/source binding to CMP-1.5.

Until CMP-1.5 qualifies:

- a worker may exist in a non-staked registration state;
- any policy requiring compute collateral must reject the worker;
- validator stake or wallet balance cannot be substituted for compute stake;
- no CMP-1.2 payer deposit can count as worker stake;
- no slash result may be fabricated from registry status.

When CMP-1.5 is implemented, worker eligibility must read the authoritative stake source and bind the required amount/policy without copying mutable balances into this registry as an independent authority.

### 3.7 Status composition

Worker status is revisioned and narrowly scoped. Initial lifecycle target:

`REGISTERED -> ACTIVE <-> SUSPENDED -> RETIRED`

`RETIRED` is terminal.

`ACTIVE` means only that the worker record itself is administratively/actionably active. A worker is eligible for new paid work only when **all** required parent/policy predicates are simultaneously true, including:

- provider active;
- node active and endpoint live;
- resource available and exact revision compatible;
- worker active;
- worker operator/signing-key proof valid;
- required capability attestation live;
- required stake policy satisfied once CMP-1.5 is bound;
- request/offer/match authorization still valid.

Parent suspension or resource unavailability therefore makes the worker ineligible even if the local worker status remains ACTIVE. Reactivating a worker cannot override a suspended provider/node/resource.

Suspension may stop new admission but cannot confiscate or rewrite already earned valid settlement, consistent with CMP-INV-020.

## 4. Required authoritative interfaces for CMP-1.3.1+

The executable implementation must expose enough read-only state for matching/job logic to prove:

1. worker ID exists and exact revision exists;
2. immutable provider/node parentage;
3. worker/operator address;
4. execution signing-key commitment/type;
5. capability profile commitment/version;
6. canonical resource binding used for eligibility;
7. optional jurisdiction/policy commitment;
8. reputation evidence reference without turning it into correctness authority;
9. stake source/reference and whether the bound stake predicate is satisfied;
10. worker lifecycle status;
11. capability-attestation reference/status where policy requires it;
12. a single fail-closed `isEligible(...)`-style predicate or equivalent composition that cannot ignore parent/resource/policy state.

Mutation functions must be version guarded and narrowly authorized. No general administrator setter may replace immutable parentage, fabricate attestation, alter accepted historical revisions, or bypass stake/parent status.

## 5. Acceptance and adversarial test plan

CMP-1.3.1+ must add named Foundry tests covering at minimum the following.

### Positive

- operator registers a worker under an active provider/node/resource;
- worker ID is deterministic/domain separated and unique;
- exact worker revision can be reconstructed from history;
- correct execution-key possession proof is accepted;
- capability profile exposes architecture/CPU/GPU/VRAM/memory/storage/network/software commitments;
- optional jurisdiction metadata can be absent without breaking identity;
- valid revision becomes eligible only when all required parent/resource/policy predicates pass;
- later revision preserves old revision for an already accepted job;
- suspension blocks new admission while preserving historical identity;
- reputation/stake references are read without becoming independent settlement/correctness authority.

### Negative

- zero/foreign/reused IDs;
- cross-provider or cross-node worker reassignment;
- unauthorized register/update/status mutation;
- registering against inactive provider/node or unavailable resource where active admission is requested;
- forged execution-key proof;
- stale or wrong worker revision;
- capability mutation that tries to broaden an accepted job;
- false hardware claim satisfying a policy that requires attestation;
- expired/revoked/wrong-subject attestation;
- worker ACTIVE while parent provider/node/resource is suspended, with admission correctly rejected;
- validator stake/wallet balance substituted for CMP-1.5 collateral;
- missing CMP-1.5 source treated as sufficient stake;
- reputation value used as correctness, settlement or slashing authority;
- retired worker reactivation;
- duplicate worker/attempt evidence replay;
- worker registration granting Vault, verifier, governance, bridge, validator or arbitrary wallet privileges.

Rejected actions must leave canonical revisions, accepted-match bindings, balances and job state unchanged.

## 6. Applicable frozen invariants

CMP-1.3 implementation and qualification must explicitly map tests to at least:

- CMP-INV-002: distinct stable identities;
- CMP-INV-003: no identity reassignment;
- CMP-INV-004: node cannot move providers;
- CMP-INV-005: registration grants no unrelated authority;
- CMP-INV-007/008: worker/capability selection cannot broaden accepted constraints;
- CMP-INV-019: one worker/resource cannot consume another entitlement;
- CMP-INV-020: suspension cannot confiscate earned settlement;
- CMP-INV-021/022: stake/slash only through the defined stake/policy path;
- CMP-INV-023: Trust evidence is separable from authority;
- CMP-INV-026: accepted execution identity remains reconstructable;
- CMP-INV-028/029: capability, endpoint and manifest changes cannot silently alter accepted semantics;
- CMP-INV-030: general-purpose non-AI workers remain supported.

## 7. Deployment and publication boundary

ComputeWorkerRegistry is a registry-resolved ComputeMarket application contract. CMP-1.3.0 allocates no new frozen system/predeploy address.

Before live publication, the eventual contract must have:

- deployment address/network recorded;
- runtime code hash independently checked against qualified source/artifact;
- parent provider/node/resource registry addresses checked;
- authorization/capability authority checked;
- attestation adapter/policy checked where enabled;
- CMP-1.5 stake source checked where stake is required;
- ProtocolRegistry publication performed only by the authorized publisher;
- exact deployed configuration tested;
- no test-only permissive attestation, stake, reputation or admin authority.

## 8. Qualification boundary for CMP-1.3.0

CMP-1.3.0 is intentionally a **design/audit gate**.

It is fully qualified at repository scope when:

1. this baseline is committed against the exact post-CMP-1.2 main baseline;
2. the source inventory above is reconciled with current canonical provider/node/resource, job, Trust and Stake surfaces;
3. the ownership decisions for worker identity, execution key, capabilities, attestation, reputation, stake and status are explicit and non-duplicative;
4. the executable acceptance plan and invariant mapping are frozen;
5. repository Docs and Integrated qualification complete successfully on the exact candidate head.

No Solidity implementation, deployment, worker registration, hardware attestation, compute stake, ProtocolRegistry publication or live paid worker is claimed by CMP-1.3.0.

## 9. Next implementation step

CMP-1.3.1 implements the canonical worker identity and lifecycle core: worker ID/revisions, immutable provider/node binding, operator and execution-key proof, capability-profile commitment, status lifecycle and fail-closed parent/resource eligibility. Attestation-policy enforcement, capability-detail predicates, Trust/reputation references, CMP-1.5 stake binding, accepted-job snapshot integration and deployment qualification remain subsequent numbered CMP-1.3 steps.
