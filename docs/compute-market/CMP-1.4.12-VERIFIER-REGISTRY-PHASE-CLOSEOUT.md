# CMP-1.4.12 — Phase closeout

Status: **IMPLEMENTATION/RECONCILIATION COMPLETE; LEVEL 3 QUALIFICATION PENDING.**

## Canonical definition

> Phase closeout

CMP-1.4 is the ComputeVerifierRegistry phase. Closeout is the final reconciliation boundary for CMP-1.4.0 through CMP-1.4.11 and must answer the phase question: **Was the submitted computation actually valid under the accepted policy?**

## Repository baseline and reconciliation

CMP-1.4.12 begins from `main` merge `06e137050964bb4f787164c9900f1740f2cf4b97`, which merged the repository-qualified CMP-1.4.11 release-candidate package.

The closeout audit found one internal canonical gap: CMP-1.4.4 had deliberately remained open through later roadmap steps. Closeout therefore implements and qualifies that missing signed-verdict provenance requirement instead of declaring a phase complete around an acknowledged hole.

## CMP-1.4.4 reconciliation

Signed verdict provenance now binds chain, verifier contract, canonical JobRegistry, job, current single-unit identity, exact result-bearing attempt, canonical worker, result, verifier, frozen policy, execution evidence, nonce and expiry.

The current CMP-1 repository scope is a single payable work unit per fixed-price job, so `unitId == jobId`. Retry identity is not lost: the worker evidence exposes the exact latest result-bearing `attemptRef` and attempt number while JobRegistry retains its immutable root assignment.

The signed provenance record is queryable through `decisionProvenance(decisionRef)`. Authentication remains separate from objective correctness and settlement authority.

## Phase inventory

The closeout retains the complete verifier phase surfaces:

- verifier identity/lifecycle and versioned history;
- independently typed verifier classes and workload capabilities;
- frozen verification-policy registry;
- signed verdict provenance;
- independent verifier selection and conflict controls;
- N-of-M replicated verification;
- deterministic verification adapters;
- scientific/probabilistic verification;
- challenge/appeal integration;
- cross-verifier adversarial qualification;
- immutable release-candidate graph and repository deployment-readiness package.

The machine-readable closeout ledger is `contracts/config/compute-market/cmp-1.4.12-phase-closeout.json`.

## Authority and security reconciliation

CMP-1.4 preserves these boundaries:

- verifier identity/capability authority cannot mutate worker lifecycle;
- a signature authenticates provenance but does not prove computation correctness;
- objective verification cannot move Vault funds by itself;
- verifier selection cannot grant custody, settlement or governance rights;
- challenge/appeal hooks preserve original verification provenance;
- ComputeStake collateral/slashing remains a separate CMP-1.5 authority;
- no fixed Genesis predeploy is allocated by this phase;
- discovery/publication remains through the frozen ProtocolRegistry at `0x0000000000000000000000000000000000000434`.

## Repository versus live readiness

Repository phase closeout does not claim live deployment. Live readiness remains blocked until applicable CMP-1.5 verifier collateral is qualified and real public-testnet deployment, runtime-code-hash, graph-binding and ProtocolRegistry publication evidence exists.

CMP-1.4.4 is no longer an internal release blocker after this reconciliation. The remaining blockers are external/live prerequisites.

## Qualification model

### Level 1

The repaired CMP-1.4.4 surfaces require affected compilation, signed-verdict tests, retry provenance tests, policy-bound provenance tests, hostile/replay/expiry checks and the mechanical verifier.

### Level 2

Prior milestones remain retained evidence, including identity/classes/policy integration, selector/quorum integration, deterministic/scientific integration, verifier-dispute integration and CMP-1.4.10 cross-verifier adversarial qualification. The final closeout does not replace those milestones.

### Level 3

CMP-1.4.12 is the complete phase-closeout boundary, so Level 3 is mandatory against one exact accumulated merge-candidate SHA. Required applicable qualification includes the retained Compute suite, complete Solidity inventory, Genesis/address authority, 420 Integrated qualification, Docs/global reconciliation, Indexer/client consumers, Registry integration, adversarial/security checks, deployment/config verification, builds and static/lint/type checks exercised by those workflows.

No missing, cancelled, skipped-required or failed gate counts as green.

## Exit criteria

CMP-1.4.12 may be marked complete only when:

1. CMP-1.4.0 through CMP-1.4.11 are present and mechanically reconciled;
2. CMP-1.4.4 is implemented and no longer an internal phase blocker;
3. the accumulated verifier graph preserves authority/correctness/custody boundaries;
4. the CMP-1.4.11 repository release package remains ready while live readiness remains fail-closed;
5. all required Level 3 workflows pass on the same exact qualification-relevant implementation SHA;
6. the durable closeout record identifies that SHA and exact run evidence;
7. remaining live blockers are explicit and no deployment evidence is fabricated.

An evidence-only final recording commit may inherit the already-qualified implementation SHA if it changes no executable code, tests, workflows, dependencies, interfaces, deployment state, configuration semantics or substantive requirements.

## Completion

**PENDING LEVEL 3 EXACT-HEAD QUALIFICATION.**

After repository closeout, the next canonical roadmap step is **CMP-1.5.0 — Stake architecture** under **CMP-1.5 — ComputeStake**.
