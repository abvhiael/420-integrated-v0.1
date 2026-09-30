# CMP-1.4.0 — Verifier architecture reconciliation

Status: **IMPLEMENTATION COMPLETE; EXACT-HEAD QUALIFICATION PENDING. NO LIVE DEPLOYMENT/PUBLICATION CLAIM.**

## Canonical definition

The detailed Compute Market roadmap defines CMP-1.4.0 exactly as:

> Inventory all existing verifier, policy, selector, attestation and signed-verdict components. Freeze canonical ownership and authority boundaries.

Parent CMP-1.4 purpose:

> Separate workers from verification authorities.

CMP-1.4.0 is an architecture/reconciliation gate. It does not implement the future verifier registry/lifecycle itself and must not silently promote older verifier primitives into that role.

## Repository baseline

Baseline current `main` before modification:

`bd00e64e29e74c96b4d89b1254254547767a6851`

Relevant repository history and authority reviewed:

- `docs/compute-market/CMP-1-IMPLEMENTATION-ROADMAP.md`;
- `docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md` carried forward exactly from saved roadmap PR #417;
- frozen V1 architecture and CMP-INV-001–030;
- CMP-0.9 receipts/verification specification;
- CMP-0.10 disputes/privacy/security;
- CMP-0.12 qualification gates;
- CMP-1.1 verifier qualification and lifecycle/release policy;
- historical PR #369 foundation work and PR #370 CMP-1.1 work;
- current verifier contracts, tests, configuration and deployment-readiness records.

PR #369 and PR #370 are merged historical sources. Their earlier scope/labels do not supersede the current canonical CMP-1 roadmap.

## Gap analysis

### Satisfied before CMP-1.4.0

The repository already contains substantial verifier-related primitives:

1. `ComputeJobVerifierEvidence420`
   - records job-scoped verifier decisions;
   - authenticates the submitting account through scoped verification capability;
   - explicitly does not prove objective correctness.

2. `ComputeJobIndependentVerification420`
   - EIP-712/ERC-1271 signed-verdict primitive;
   - binds job/request/manifest/match/assignment/result/verifier/profile/revision/expiry/nonce;
   - consumes verifier nonce only on accepted decisions;
   - explicitly does not prove beneficial-owner independence by signature alone.

3. `ComputeJobPolicyEnforcedVerification420`
   - composes signed verdicts with canonical owner/payer/operator lookup and independent appointment eligibility;
   - does not itself prove workload correctness.

4. `ComputeJobIntegerProfileVerification420`
   - independently recomputes one bounded deterministic `INTEGER_SUM_OF_SQUARES/V1` profile;
   - blocks signature-only acceptance for that profile;
   - is not a generic scientific/GPU/AI verifier.

5. `ComputeVerifierIndependencePolicy420`
   - separates governance, identity attestor and verifier selector;
   - records controller attestations and job/profile-specific appointments;
   - checks controller separation, expiry, revocation and authority epoch;
   - is not the canonical verifier identity/lifecycle or class/capability registry.

6. `ComputePolicyRegistry420`
   - already supports versioned `KIND_VERIFICATION` publication;
   - publication is not verifier identity, appointment, correctness decision or settlement authority.

7. `ComputeJobCanonicalWiring420`
   - checks a bounded CMP-1.1.4 wiring/code-hash/role graph;
   - does not deploy, publish or establish the general CMP-1.4 verifier registry.

The retained test suite already covers signed-verdict replay/expiry/profile rejection, EOA/ERC-1271 signature behavior, appointment revocation, controller conflicts, authority rotation, hostile verdict substitution, deterministic recomputation, canonical wiring and verification-gated entitlement behavior.

### Worker capability attestation boundary

`ComputeWorkerAttestation420` and `ComputeWorkerAttestedEligibility420` are inventoried because they are existing attestation components relevant to the compute graph. They attest/compose worker capability evidence only. They are **not** verifier identity, verifier appointment, result correctness, or settlement authority, and CMP-1.4 must not reinterpret them as such.

### Planned verification router boundary

The frozen V1 architecture and `contracts/config/genesis-dapp-contract-map.json` name `ComputeVerificationRouter420.sol` as a target ComputeMarket surface. No such Solidity source exists on this baseline. CMP-1.4.0 therefore records it as a **planned, not implemented** surface. Later CMP-1.4 work must reconcile its routing responsibilities with the canonical verifier registry/model before implementation; documentation/config naming is not proof of source code, deployment, or publication.

### Missing before CMP-1.4.0

The repository did not yet have a single authoritative verifier architecture freeze that:

- inventoried all retained verifier components and classified each by actual authority;
- prevented `ComputeVerifierIndependencePolicy420` from being misrepresented as `ComputeVerifierRegistry420`;
- assigned future verifier identity/lifecycle ownership to CMP-1.4.1;
- assigned verifier classes/capabilities to CMP-1.4.2;
- assigned policy, signed verdict, selection, quorum, deterministic, scientific, challenge, adversarial, release and closeout responsibilities to CMP-1.4.3–CMP-1.4.12;
- froze authority separation from Vault/custody, settlement, worker lifecycle, governance, bridge, validator and arbitrary-wallet rights;
- tied the freeze to relevant frozen ComputeMarket invariants;
- mechanically verified that the retained components/tests/docs remain present.

That is the complete implementation gap for CMP-1.4.0. No new verifier runtime contract is required by this step.

## Canonical verifier model

The machine-readable authority is:

`contracts/config/compute-market/cmp-1.4.0-verifier-architecture.json`

### Identity and lifecycle

Owner step: **CMP-1.4.1**.

The future canonical verifier identity/lifecycle surface must register, activate, suspend, rotate and retire verifier identities without granting unrelated authority.

Existing controller attestations in `ComputeVerifierIndependencePolicy420` are evidence used by selection policy. They are not silently promoted into the verifier lifecycle registry.

### Classes and workload capabilities

Owner step: **CMP-1.4.2**.

Initial architectural classes are:

- protocol verifier;
- independent verifier;
- job-owner verifier;
- oracle verifier;
- TEE verifier;
- committee verifier.

Class/capability eligibility is separate from appointment, controller identity, correctness proof and settlement.

### Verification policy

Owner step: **CMP-1.4.3**.

`ComputePolicyRegistry420.KIND_VERIFICATION` is a reusable versioned publication primitive where compatible. Accepted verification semantics must be frozen before execution; later publication or suspension cannot silently reinterpret historical jobs.

### Signed verdicts

Owner step: **CMP-1.4.4**.

Retain the existing EIP-712/ERC-1271 verdict primitive where compatible. Authentication proves provenance, not correctness by itself.

### Independent verifier selection

Owner step: **CMP-1.4.5**.

Retain the independence-policy design where compatible:

- verifier cannot self-appoint;
- selector cannot grant verification capability or publish profiles;
- identity attestor cannot appoint;
- governance/selector/attestor separation is explicit;
- controller conflicts fail closed.

### Replicated / N-of-M verification

Owner step: **CMP-1.4.6**.

No existing primitive is reclassified as completing this requirement.

### Deterministic verification adapters

Owner step: **CMP-1.4.7**.

`ComputeJobIntegerProfileVerification420` is retained as one bounded example, not the generic verifier architecture.

### Scientific / probabilistic verification

Owner step: **CMP-1.4.8**.

Not implemented by CMP-1.4.0.

### Challenge and appeal hooks

Owner step: **CMP-1.4.9**.

The existing lifecycle/release policy remains authoritative written guidance. Challenges/appeals must preserve the original immutable verdict and cannot themselves move funds.

### Cross-verifier adversarial qualification

Owner step: **CMP-1.4.10**.

### Release-candidate/deployment readiness

Owner step: **CMP-1.4.11**.

### Phase closeout

Owner step: **CMP-1.4.12**.

## Frozen authority boundaries

CMP-1.4 must preserve all of the following:

- verifier identity or capability grants no Vault custody, arbitrary withdrawal, beneficiary redirection, settlement execution, worker lifecycle, validator, bridge, governance or arbitrary-wallet authority;
- a signed verdict proves authentication/provenance only;
- correctness requires the exact preaccepted verification method/profile;
- a PASS/FAIL/INCONCLUSIVE decision is evidence and never a direct Vault transfer;
- settlement beneficiary and amount derive from canonical accepted economic state, never verifier input;
- selector, identity attestor, policy/profile publisher, verifier, dispute reviewer, worker, payer and settlement authority remain separable;
- policy publication does not appoint a verifier and cannot rewrite historical accepted-job semantics;
- worker/resource reputation and 420Trust cannot substitute for correctness proof;
- raw private workload/evidence bytes are not required public canonical state;
- suspension/revocation blocks unsafe new activity without rewriting historical decisions or silently confiscating earned rights;
- emergency/governance powers cannot fabricate outcomes or redirect balances;
- non-AI workloads remain first-class.

## Frozen invariant mapping

The architecture freeze explicitly preserves:

- CMP-INV-005 — registration/identity does not imply unrelated authority;
- CMP-INV-009/010 — verifier cannot exceed payer cap or choose settlement beneficiary;
- CMP-INV-013 — terminal state cannot regain spend authority;
- CMP-INV-014 — receipt/verdict replay boundaries remain domain-separated;
- CMP-INV-016 — signature alone is not correctness;
- CMP-INV-017 — verification semantics are explicit/versioned/prebound;
- CMP-INV-018 — verifier activity cannot create duplicate settlement;
- CMP-INV-020 — suspension cannot confiscate valid historical entitlement;
- CMP-INV-022 — slashing needs objective evidence under bound policy;
- CMP-INV-023 — Trust evidence remains separable from verification/custody/settlement authority;
- CMP-INV-024 — private workload evidence is not required plaintext state;
- CMP-INV-025 — emergency power is non-confiscatory;
- CMP-INV-026 — accepted jobs remain reconstructable;
- CMP-INV-027 — replaceable off-chain services have no hidden canonical privilege;
- CMP-INV-030 — non-AI workloads require no 420AI dependency.

## Security, integration and deployment disposition

CMP-1.4.0 changes no production Solidity runtime behavior.

It creates no:

- fixed Genesis predeploy;
- live deployed verifier address;
- runtime code-hash claim;
- ProtocolRegistry publication;
- Vault grant;
- settlement grant;
- worker mutation grant;
- stake/slash grant.

Existing testnet deployment evidence that names bounded verifier components remains historical/readiness evidence only while its runtime/publication verification flags remain false.

## Qualification requirements

The step requires:

1. exact roadmap text retained;
2. complete machine-readable inventory/model;
3. all listed retained source/test/doc paths present;
4. every CMP-1.4.1–CMP-1.4.12 ownership assignment present exactly once;
5. frozen authority boundaries and relevant invariant IDs present;
6. no live deployment/publication claim;
7. the architecture verifier wired into 420Docs Qualification;
8. relevant retained Solidity/Integrated/Docs qualification workflows green on the exact final qualification head.

## Exit criteria

CMP-1.4.0 is COMPLETE only when:

- every existing verifier/policy/selector/attestation/signed-verdict component is inventoried and dispositioned;
- canonical ownership and authority boundaries are frozen;
- no legacy/test-only or bounded verifier primitive is mislabeled as the general verifier registry;
- retained tests/docs are identified;
- the mechanical verifier passes;
- exact-head repository qualification is green;
- durable qualification evidence records the exact qualified SHA and workflow results.

## Completion

**NOT YET COMPLETE.** Implementation/reconciliation artifacts are present, but exact-head CI qualification and final evidence recording remain pending.
