# CMP-5.7 — Qualification Evidence

Status: **COMPLETE — Level 1 + fourth CMP-5 Level 2 exact-head qualified.**

## Qualification identity

- Roadmap step: **CMP-5.7 — External-result attestation**
- Qualification: **Level 1 + fourth CMP-5 Level 2 integration milestone**
- Exact qualified implementation SHA: `e04d6baa0e636a361ef7dd8d046f5a31ff2f72d4`
- Current main observed at closeout: `f0f64ecfe28c4390b524baaf7382ef82808aaa17`
- Branch: `cmp-5.1-folding-at-home-adapter-20261006`
- PR: **#539**
- Level 3: **deferred to CMP-5.8 — Phase closeout**
- Next canonical step: **CMP-5.8 — Phase closeout**

## Qualified implementation

The exact qualified SHA includes:

- `contracts/src/compute/ComputeExternalResultAttestation420.sol`
- `contracts/test/ComputeExternalResultAttestation420.t.sol`
- `contracts/config/compute-market/cmp-5.7-external-result-attestation.json`
- `docs/compute-market/CMP-5.7-EXTERNAL-RESULT-ATTESTATION.md`
- `scripts/verify-cmp-5-7-external-result-attestation.py`
- CMP-5.7 Compute Market workflow ownership
- canonical roadmap wiring

## Exit criteria disposition

1. Trusted external attesters bind normalized external source, result, and proof/credit evidence to one canonical external-work commitment — **PASS**.
2. Equivalent external source wrappers may map to the same canonical-work commitment — **PASS**.
3. A previously bound source, result, or evidence identity cannot be remapped to a conflicting canonical-work commitment — **PASS**.
4. Identical attestation publication is idempotent and does not create a second attestation identity — **PASS**.
5. Untrusted callers cannot publish attestations; only governance may manage trusted-attester status — **PASS**.
6. Attester/governance revocation and governance trust withdrawal make attestations unusable for new resolution — **PASS**.
7. Invalid/zero source, result, canonical-work, scheme, evidence, timing, and proof/credit inputs fail closed; at least one normalized proof or credit record commitment is required — **PASS**.
8. Acceptable attestations resolve exact canonical-work, source, result, and evidence commitments for downstream CMP-5.6 consumption — **PASS**.
9. No reward amount/eligibility, Vault/settlement, stake/slash, proof-verification, credit-issuance, or duplicate-consumption authority is introduced — **PASS**.
10. Dedicated adversarial tests, mechanical verifier, retained Compute regressions, and exact-head qualification pass — **PASS**.

## Exact-head CI evidence

### Compute Market Qualification #482

- Run: `37552303563`
- Job: `112570604929`
- Exact-head checkout — **PASS**
- Exact qualification SHA verification — **PASS**
- Compute Market build — **PASS**
- Retained `Compute*.t.sol` Solidity suite — **PASS**
- Verification-script compilation — **PASS**
- Retained CMP-1/CMP-2/CMP-4 verifier chain — **PASS**
- CMP-5.1 Folding@home verifier — **PASS**
- CMP-5.2 BOINC verifier — **PASS**
- CMP-5.3 Research-cluster verifier — **PASS**
- CMP-5.4 University/HPC verifier — **PASS**
- CMP-5.5 External proof/credit verifier — **PASS**
- CMP-5.6 Double-reward prevention verifier — **PASS**
- CMP-5.7 External-result attestation verifier — **PASS**
- Affected Compute SDK steps — **SKIPPED as not affected**
- Final result — **SUCCESS**

### Solidity Contracts #5279

- Run: `37552303637`
- Compute-fast job: `112570448249` — **SUCCESS**
- Exact-head checkout/verification — **PASS**
- Compute Market build — **PASS**
- Retained Compute Solidity suite — **PASS**
- Full repository Foundry — **SKIPPED as expected**
- PR shards — **SKIPPED as expected**

## Supporting exact-head workflows

- 420Registry REG-AUDIT-4 / run `37552303708` — **SUCCESS**
- Genesis Address Authority / run `37552303570` — **SUCCESS**
- 420Docs Qualification / run `37552303594` — **SUCCESS**
- Compute Worker Fast Qualification / run `37552303705` — **SUCCESS**
- 420Indexer / run `37552303511` — **SUCCESS**
- 420Oracle audit qualification / run `37552303654` — **SUCCESS**

These are supporting observations and do not convert CMP-5.7 into a Level 3 closeout.

## Security / adversarial disposition

Coverage includes:

- trusted and untrusted attester publication;
- governance-only attester trust management;
- exact source/result/evidence binding;
- conflicting source/evidence remap rejection;
- equivalent-wrapper convergence;
- idempotent identical publication;
- attester revocation;
- governance trust withdrawal;
- foreign-attester revoke rejection;
- proof-only and credit-only evidence cases;
- missing proof+credit evidence rejection;
- zero/invalid source/result/work/scheme/evidence bindings;
- observation/validity/expiry boundary rejection.

## Authority boundaries

CMP-5.7 owns only:

- trusted external-result attestation;
- authoritative canonical external-work mapping.

It does not:

- decide reward amount;
- decide final reward eligibility;
- mint or transfer assets;
- create/release Vault obligations;
- mutate or slash stake;
- validate provider-specific proof cryptography;
- issue external credit;
- consume duplicate-reward claims.

CMP-5.6 remains the one-time duplicate-consumption authority.

CMP-6 remains the useful-computation reward-economics and payout authority.

## Milestone disposition

CMP-5.7 is the **fourth CMP-5 Level 2 milestone** because it introduces the shared authoritative truth mapping that all external reward integrations must consume.

Repository-wide Level 3 remains reserved for CMP-5.8.

## Intentionally deferred

- CMP-5.8 — Level 3 phase closeout
- reconciliation of the full accumulated CMP-5 branch against current `main`
- canonical full Solidity repository inventory on the reconciled merge candidate
- Genesis/address-authority Level 3 verification
- 420 Integrated/global qualification
- Docs/global reconciliation
- live external-attester governance onboarding
- ProtocolRegistry publication
- provider-specific off-chain evidence-validation services
- CMP-6 reward-economics and payout integration

## Main-branch / PR note

At durable closeout, current `main` was observed as `f0f64ecfe28c4390b524baaf7382ef82808aaa17`.

The active CMP branch is materially diverged from current `main`, and PR #539 is not presently mergeable. This is a **CMP-5.8 Level 3 reconciliation requirement**, not a failure of CMP-5.7's exact-SHA step qualification.

CMP-5.7 remains authoritative on exact implementation SHA `e04d6baa0e636a361ef7dd8d046f5a31ff2f72d4` until any later executable/test/workflow/config/interface/deployment/substantive change creates a new implementation SHA.

## Completion

**CMP-5.7 is repository COMPLETE at Level 1 + fourth CMP-5 Level 2 on exact implementation SHA `e04d6baa0e636a361ef7dd8d046f5a31ff2f72d4`.**

This evidence-only closeout changes no executable source, tests, workflows, dependencies, configuration semantics, interfaces, deployment state, or substantive requirements. It therefore inherits exact-head qualification without recursive rerun.

## Next canonical step

**CMP-5.8 — Phase closeout**
