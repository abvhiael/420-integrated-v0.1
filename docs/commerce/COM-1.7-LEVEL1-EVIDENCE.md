# COM-1.7 — Exact-SHA Level 1 security architecture evidence

**Step:** COM-1.7 — Security model and threat assessment.
**Implementation SHA:** `78d8bb174cad960b11d76800f321001f6fd0ec2f`
**Main/base:** `ffc6a4028676907c266714b5c1ae8ba3af9a7137`
**PR/branch:** #588 / `commerce/com-1-architecture-reconciliation`
**Status:** threat model/documentation delivered; targeted consistency PASS; GitHub Actions qualification pending/unverified.

## Implementation
Added `docs/commerce/COM-1.7-SECURITY-THREAT-MODEL.md` and updated `docs/commerce/COM-1-ARCHITECTURE-AND-ROADMAP.md`. This documents 16 risk-ranked threats, 10 security invariants, ownership across COM-2 to COM-8, abuse/negative scenarios and explicit production checkout release-blockers. No contract, frontend, test, workflow, dependency, address map, security setting or deployment state changed.

## Targeted Level 1 check results
GitHub exact-implementation-SHA reads of the new document, phase roadmap, Market OrderRegistry, Pay swap settlement adapter and Wallet service manifest validator; **14/14 PASS**: roadmap link, financial forged-proof risks, inventory race, upload safety, customer PII, tenant permissions, reorg handling, adversarial test matrix, release gate, authorized settlement reporter, quote expiry, verified Wallet manifest, nonfinancial read-only degraded mode and COM-1.8 next-step consistency.

The branch comparison at implementation SHA showed **ahead 19 / behind 0** against main `ffc6a4028676907c266714b5c1ae8ba3af9a7137`.

## CI result snapshot
No PR-triggered workflow runs were returned by the GitHub commit-run lookup for the exact implementation SHA at observation time. This is **not a PASS**. Check exact-head Docs/Commerce applicable CI after evidence commit. This step is architecture-only; no reason to run a redundant full Solidity Foundry or Genesis inventory as Level 1.

## Blockers and deferred checks
- Missing production-qualified Pay→Market reporter bridge blocks real checkout.
- Application persistence, upload filtering, tenant ACL, frontend, deployed domain and operational privacy controls remain future COM-3–7 deliverables; threat model is not penetration-test evidence.
- Level 2 app integration deferred until substantive components converge.
- Level 3 exact-SHA COM-1.8 remains unstarted.
- COM-8 real testnet and COM-9 mainnet remain externally gated.

**Next canonical step:** COM-1.8 — Level 3 architecture closeout.
