# CMP-5.6 — Qualification Evidence

Status: **COMPLETE — Level 1 + third CMP-5 Level 2 exact-head qualified.**

## Qualification identity

- Roadmap step: **CMP-5.6 — Double-reward prevention**
- Qualification: **Level 1 + third CMP-5 Level 2 integration milestone**
- Exact qualified implementation SHA: `505eea3d3eeb8e23c9a6f3a958e6afbc84946b02`
- Current main observed at closeout: `9bf48f473489a2ad9d0a70f45675c644745ddde8`
- Branch: `cmp-5.1-folding-at-home-adapter-20261006`
- PR: **#539**
- Level 3: **deferred to CMP-5.8 — Phase closeout**
- Next canonical step: **CMP-5.7 — External-result attestation**

## Qualified implementation

The exact qualified SHA includes:

- `contracts/src/compute/ComputeExternalDoubleRewardGuard420.sol`
- `contracts/test/ComputeExternalDoubleRewardGuard420.t.sol`
- `contracts/config/compute-market/cmp-5.6-double-reward-prevention.json`
- `docs/compute-market/CMP-5.6-DOUBLE-REWARD-PREVENTION.md`
- `scripts/verify-cmp-5-6-double-reward-prevention.py`
- CMP-5.6 Compute Market workflow ownership
- canonical roadmap wiring

## Exit criteria disposition

1. One canonical external-work commitment maps to one chain-scoped claim key independent of proof, credit, reward reference, evidence, or source wrapper — **PASS**.
2. A canonical external-work claim can be consumed only once — **PASS**.
3. Alternate proof/credit evidence and alternate reward references cannot create a second claim for the same canonical work — **PASS**.
4. Alternate external-source wrappers cannot create a second claim for the same canonical work — **PASS**.
5. Unauthorized callers cannot front-run or burn claims — **PASS**.
6. Only governance may authorize/revoke consumers; authorized consumers must be deployed code with pinned runtime code hash — **PASS**.
7. Zero canonical work, zero reward reference, zero evidence, and invalid external-source bindings fail closed — **PASS**.
8. Successful consumption records exact source binding, consumer, reward reference, evidence, and timestamp for auditability — **PASS**.
9. No external-truth, reward-amount, reward-eligibility, Vault/settlement, stake/slash, proof-verification, or credit-issuance authority is introduced; CMP-5.7 remains the truth owner — **PASS**.
10. Dedicated adversarial tests, mechanical verifier, retained Compute regressions, and exact-head qualification pass — **PASS**.

## Exact-head CI evidence

### Compute Market Qualification #473

- Run: `37548531663`
- Job: `112558580279`
- Exact-head checkout — **PASS**
- Exact qualification SHA verification — **PASS**
- Foundry setup — **PASS**
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
- Affected Compute SDK steps — **SKIPPED as not affected**
- Final result — **SUCCESS**

### Solidity Contracts #5266

- Run: `37548531615`
- Classification job — **PASS**
- Compute-fast job: `112558735065` — **SUCCESS**
- Exact-head checkout/verification — **PASS**
- Compute Market build — **PASS**
- Retained Compute Solidity suite — **PASS**
- Full repository Foundry — **SKIPPED as expected**
- PR shards — **SKIPPED as expected**

## Supporting exact-head workflows

- 420Oracle audit qualification / run `37548531591` — **SUCCESS**
- 420Registry REG-AUDIT-4 / run `37548531632` — **SUCCESS**
- Genesis Address Authority / run `37548531680` — **SUCCESS**
- 420Docs Qualification / run `37548531565` — **SUCCESS**
- Compute Worker Fast Qualification / run `37548531710` — **SUCCESS**
- 420Indexer / run `37548531668` — **SUCCESS**

These are supporting observations and do not convert CMP-5.6 into a Level 3 closeout.

## Security / adversarial disposition

Coverage includes:

- replay of the same canonical external-work commitment;
- alternate proof/credit evidence for the same work;
- alternate reward references for the same work;
- alternate external source wrappers for the same work;
- distinct-work non-collision;
- unauthorized direct claim consumption;
- permissionless front-run / claim-burn attempts;
- consumer authorization and revocation;
- governance-only consumer administration;
- EOA/non-code consumer rejection;
- runtime-code-hash pinning;
- zero/invalid work, reward, evidence, and source bindings.

## Authority boundaries

CMP-5.6 enforces only **one-time external reward-claim consumption**.

It does not:

- attest external truth;
- establish that work actually occurred;
- decide reward eligibility;
- calculate reward amount;
- mint or transfer assets;
- create or release Vault obligations;
- mutate or slash stake;
- validate proof semantics;
- issue external credit.

CMP-5.7 remains the owner of **external-result attestation and authoritative canonical-work mapping**.

CMP-6 remains the owner of **useful-computation reward economics and payout integration**.

## Milestone disposition

CMP-5.6 is the **third CMP-5 Level 2 milestone** because all later external reward paths must converge on one shared, stateful, one-time external-work consumption boundary.

Repository-wide Level 3 remains reserved for CMP-5.8.

## Intentionally deferred

- CMP-5.7 — External-result attestation
- CMP-5.8 — Level 3 phase closeout
- CMP-6 — Useful-computation reward economics and payout integration
- live authorized reward-consumer deployment
- ProtocolRegistry publication / deployment evidence

## Main-branch note

At durable closeout, current `main` was observed as `9bf48f473489a2ad9d0a70f45675c644745ddde8`. The active CMP branch remains historically diverged because current main contains unrelated PuffBuddies-only changes. No Compute/CMP/Compute-workflow files were changed by that incoming main delta, so the exact-SHA qualification of `505eea3d3eeb8e23c9a6f3a958e6afbc84946b02` remains authoritative for CMP-5.6.

## Completion

**CMP-5.6 is repository COMPLETE at Level 1 + third CMP-5 Level 2 on exact implementation SHA `505eea3d3eeb8e23c9a6f3a958e6afbc84946b02`.**

This evidence-only closeout changes no executable source, tests, workflows, dependencies, configuration semantics, interfaces, deployment state, or substantive requirements. It inherits the exact-head qualification and requires no recursive test rerun.

## Next canonical step

**CMP-5.7 — External-result attestation**
