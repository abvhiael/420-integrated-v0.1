# ARC-0.7 — Exact-SHA Level 1 qualification certificate

**Step:** ARC-0.7 — Freeze game scope, acceptance criteria, qualification policy and implementation dependencies

**Status:** PASS — definition/requirement freeze only; not implementation or phase closeout.

**Qualification level:** Level 1

- Qualified implementation SHA: `a69fda8f973f14dbce3c9fdd132d6c8df02a6e58`
- Reconciliation base `main`: `366b0ab3fb60593c8b3dd052a01186b88b20057d`
- PR: [#745](https://github.com/abvhiael/420-integrated-v0.1/pull/745)
- Branch: `audit/arcade-0-7-scope-freeze-20261018`
- Qualified workflow: `.github/workflows/arcade-0-7-level1.yml`
- Verified run: [39193204709](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39193204709)
- Verified job: `117870269063` — completed / success.
- Evidence-only SHA: the commit containing this certificate; not the tested implementation SHA.

## Verified criteria

- Exact eleven-game scope and three excluded candidate games
- Source blob freeze: all five expected inputs exist and Git SHA-1 blob digests match `config/arcade-0-7-scope-freeze.json`
- ARC-0.4 identity, ARC-0.5 platform and ARC-0.6 module alignment
- Frozen acceptance, security, privacy, versioning and rights boundaries
- Level 1/2/3 ownership and no redundant global qualification
- 25 adversarial negative tests rejecting tampered scope, stale digests, unauthorized authority, weakened verification and false live approval
- Earlier ARC-0.1–0.6 exact-SHA qualifications retained; their executable inputs unchanged

## Exit limits and merge disposition

This verifies **requirements freeze**, not the eleven runtime builds, gameplay, device accessibility, offline operation, live Registration, testnet acceptance, economic approvals or full app-phase closeout. Those must be qualified at their canonical implementation and external gates. Level 2 was not triggered; Level 3 was not triggered. No global Solidity, Genesis, Integrated, Docs or Geth runs were manually launched.

Current main matched the reconciliation base before certificate publication with zero behind commits; confirm GitHub mergeability and resulting main SHA before treating PR as merged.

**Next canonical roadmap step:** use only the actual next repository/owner-authorized ARC step; do not infer a new step name from this certificate.
