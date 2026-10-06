# CMP-5.5 — Qualification Evidence

Status: **COMPLETE — Level 1 + second CMP-5 Level 2 exact-head qualified.**

## Qualification identity

- Roadmap step: **CMP-5.5 — External proof/credit adapters**
- Qualification: **Level 1 + second CMP-5 Level 2 integration milestone**
- Exact qualified implementation SHA: `41b3f7e9c84226c8b294f2b7a5af730c928ece61`
- Pre-repair implementation SHA: `094b376086aa5cb4a7d92d96906bff3d1d13c4f5`
- Current main observed at closeout: `9bf48f473489a2ad9d0a70f45675c644745ddde8`
- Branch: `cmp-5.1-folding-at-home-adapter-20261006`
- PR: **#539**
- Level 3: **deferred to CMP-5.8 — Phase closeout**
- Next canonical step: **CMP-5.6 — Double-reward prevention**

## Qualified implementation

The exact qualified SHA includes:

- `contracts/src/compute/ComputeExternalProofCreditAdapter420.sol`
- `contracts/test/ComputeExternalProofCreditAdapter420.t.sol`
- `contracts/config/compute-market/cmp-5.5-external-proof-credit-adapters.json`
- `docs/compute-market/CMP-5.5-EXTERNAL-PROOF-CREDIT-ADAPTERS.md`
- `scripts/verify-cmp-5-5-external-proof-credit-adapters.py`
- Compute Market workflow ownership and roadmap wiring.

## Exit criteria disposition

1. Proof and credit records bind exact external adapter/system/contribution identities — **PASS**.
2. Proof identifiers bind scheme/issuer/proof while record commitments bind timing/expiry/evidence — **PASS**.
3. Credit identifiers bind scheme/issuer/unit while record commitments bind amount/time/evidence — **PASS**.
4. Missing source/proof/credit/evidence bindings fail closed — **PASS**.
5. Invalid proof timing fails closed while explicit non-expiring proofs remain supported — **PASS**.
6. Zero external credit amount fails closed — **PASS**.
7. Folding@home, BOINC, research-cluster and university/HPC source bindings remain mutually distinct — **PASS**.
8. No external-truth, reward, settlement, stake/slash, issuer-registry or duplicate-prevention authority is introduced — **PASS**.
9. CMP-5.6 and CMP-5.7 remain the canonical owners of duplicate-reward prevention and external-result attestation — **PASS**.
10. Dedicated tests, retained CMP-5 regressions, mechanical verifier and exact-head Compute Market qualification pass — **PASS**.

## Failure diagnosis and repair

The first implementation candidate `094b376086aa5cb4a7d92d96906bff3d1d13c4f5` exposed two deterministic test failures:

- `testProofRecordBindsSchemeIssuerProofTimingExpiryAndEvidence` — `time changed proof id`
- `testCreditRecordBindsSchemeIssuerUnitAmountTimeAndEvidence` — `amount changed credit id`

Root cause was test-side Solidity memory aliasing: mutation cases reused an aliased in-memory struct, so later assertions inherited previous mutations.

The narrow repair commit:

- `41b3f7e9c84226c8b294f2b7a5af730c928ece61`
- message: `test(compute): isolate CMP-5.5 memory mutation cases`

rebuilds a fresh canonical record for each mutation case. Protocol semantics were unchanged.

## Exact-head CI evidence

### Compute Market Qualification #462

- Run: `37533755480`
- Job: `112509804244`
- Exact-head checkout/verification — **PASS**
- Compute Market build — **PASS**
- Retained Compute Solidity suite — **PASS**
- Verification-script compilation — **PASS**
- Retained CMP-1/CMP-2/CMP-4 verifier chain — **PASS**
- CMP-5.1 Folding@home verifier — **PASS**
- CMP-5.2 BOINC verifier — **PASS**
- CMP-5.3 Research-cluster verifier — **PASS**
- CMP-5.4 University/HPC gateway verifier — **PASS**
- CMP-5.5 External proof/credit adapters verifier — **PASS**
- Final result — **SUCCESS**
- Affected Compute SDK steps — **SKIPPED as not affected**

### Solidity Contracts #5241

- Run: `37533755477`
- Classification job — **PASS**
- Compute-fast job: `112509454819` — **SUCCESS**
- Exact-head verification — **PASS**
- Compute Market build — **PASS**
- Retained Compute Solidity suite — **PASS**
- Full repository Foundry job — **SKIPPED as expected**
- Full PR shards — **SKIPPED as expected**

## Supporting exact-head workflows

- 420Registry REG-AUDIT-4 #2019 / run `37533755618` — **SUCCESS**
- Genesis Address Authority #2210 / run `37533755633` — **SUCCESS**
- 420Docs Qualification #6414 / run `37533755511` — **SUCCESS**
- Compute Worker Fast Qualification #474 / run `37533755646` — **SUCCESS**
- 420Indexer #2480 / run `37533755460` — **SUCCESS**
- 420Oracle audit qualification #1745 / run `37533755630` — **SUCCESS**

These are supporting observations and do not convert CMP-5.5 into a Level 3 closeout.

## Security / adversarial disposition

Coverage includes:

- adapter-kind substitution;
- external-system substitution;
- contribution substitution;
- proof-scheme / issuer / proof substitution;
- proof observation / expiry / evidence mutation;
- credit-scheme / issuer / unit substitution;
- credit amount / observation / evidence mutation;
- missing required bindings;
- invalid proof expiry ordering;
- zero credit amount;
- four-family source-domain collision resistance.

## Milestone disposition

CMP-5.5 is the **second CMP-5 Level 2 integration milestone** because the previously separate external adapter families converge into one provider-neutral proof/credit normalization surface.

Repository-wide Level 3 remains exclusively reserved for CMP-5.8.

## Intentionally deferred

- CMP-5.6 — Double-reward prevention
- CMP-5.7 — External-result attestation
- CMP-5.8 — Phase closeout
- CMP-6 useful-computation rewards
- live external issuer registry integration
- provider-specific proof verification and credit authority

## Main-branch note

At durable closeout, current `main` was observed as `9bf48f473489a2ad9d0a70f45675c644745ddde8`. The active CMP branch history is behind/diverged relative to current `main`, but CMP-5.5 qualification is exact-SHA evidence for `41b3f7e9c84226c8b294f2b7a5af730c928ece61`. Final phase integration/reconciliation remains a later branch/phase concern and does not invalidate this step-level qualification record.

## Completion

**CMP-5.5 is repository COMPLETE at Level 1 + second CMP-5 Level 2 on exact implementation SHA `41b3f7e9c84226c8b294f2b7a5af730c928ece61`.**

This evidence-only follow-up changes no executable source, tests, workflows, dependency/configuration state, interfaces or deployment state and therefore inherits the exact-head qualification without recursive rerun.

## Next canonical step

**CMP-5.6 — Double-reward prevention**
