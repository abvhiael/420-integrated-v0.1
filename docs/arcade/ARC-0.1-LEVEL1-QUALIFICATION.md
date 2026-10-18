# ARC-0.1 — Durable Level 1 Qualification Certificate

**Disposition:** PASS — scoped repository and asset inventory qualification  
**Roadmap step:** ARC-0.1 — Canonical repository and asset audit  
**Qualification level:** Level 1 (ordinary step)  
**Qualified implementation SHA:** `c060503d168d044848e6957862966dcbe983072c`  
**Reconciliation base SHA:** `37f98f4d04cce26a9e1c7f18b5543cd425cb3a5d`  
**Original inventory source revision:** `3b170bbbaa6e9291d331be78dd6c0a5e9b1b8c3b`  
**Mad Buds source repository revision:** `11aad7b9be008c57d70f7f6b1fd1094c48fff03b`  
**PR:** [#727](https://github.com/abvhiael/420-integrated-v0.1/pull/727)  
**Branch:** `audit/arcade-0-1-canonical-inventory-20261018`

## Exact-SHA CI evidence

- Workflow: **420Arcade ARC-0.1 Level 1 inventory**
- GitHub Actions run: **39158405232** — [open run](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39158405232)
- Attempt: **1**
- Job: **inventory**, job ID **117766349569**
- Run status: **completed**
- Run conclusion: **success**
- Job status: **completed**
- Job conclusion: **success**
- Mandatory step **Check ARC-0.1 documented inventory and canonical boundary**: **success**
- Run head SHA: `c060503d168d044848e6957862966dcbe983072c` — exact match to the qualified implementation.
- Test owner: `.github/workflows/arcade-0-1-level1.yml`
- Verifier: `scripts/arcade/verify-arc-0-1.mjs`
- Audit artifact: `docs/arcade/ARC-0.1-CANONICAL-REPOSITORY-AND-ASSET-AUDIT.md`

The scoped verifier checks the identified canonical source paths, frozen Genesis configuration boundary, existing Gaming SDK entry point, GP-15 unresolved-deployment signal, internal audit links, all eleven proposed game names and source-revision/character-roster references. This verifies the *recorded inventory boundary*; it does **not** prove production game behavior, validate independently stored Mad Buds images, grant application approval, or establish live-network acceptance.

## Preservation rule

This file records evidence only. The certificate commit SHA is separate from the above **qualified implementation SHA**. No application source, tests, workflow logic, dependency, runtime configuration, or frozen Genesis input is to be changed by the certificate commit. The successful exact-SHA run must not be repeated solely to include this certificate.

## Outstanding findings / next step

- `config/genesis-applications.json` remains FROZEN: proposed 420Arcade Genesis inclusion requires authorized reconciliation.
- The canonical Mad Buds roster resides in a separate Unity repository. Its Art directory at the recorded revision contained a README but no production artwork; approved source sprites/portraits remain a future ARC-2 dependency.
- No previous arcade gameplay code, production asset pipeline or prior ARC qualification was found in the inspected main snapshot.
- GP-15 live-network deployment qualification remains unresolved; local audit PASS does not close it.
- **Level 2:** not due for this ordinary step.
- **Level 3:** not due for this ordinary step.
- **Next proposed step:** ARC-0.2 — architecture decision and formal roadmap/source-of-truth ratification, with Genesis governance handled via ARC-0.3.
