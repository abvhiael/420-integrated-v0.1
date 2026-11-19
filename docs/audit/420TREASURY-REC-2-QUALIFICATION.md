# TREASURY-REC-2 — TreasuryRouter executability qualification

Status: **COMPLETE — targeted executable qualification passed**.

- Qualified implementation SHA: `45d8b4d0eecb8049229d79b6633d227273a2b9a6`.
- Original base: `a6b6070833e0e0a5c96238b279528729ef257033`.
- Reconciliation base: `f802270731e01684ee1f5e3fb5d433a90211aefc` (REC-1 merge, documentation-only).
- Pull request: [#1224](https://github.com/abvhiael/420-integrated-v0.1/pull/1224).
- Passing workflow: [44571486048](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44571486048), [job 135727424443](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44571486048/job/135727424443).
- Initial workflow 44571273820 failed before test execution on unrelated Bridge fixture imports. The corrected qualification uses the complete import closure of the four selected unmodified test owners and their dependencies, preserving compiler and fuzz configuration. No assertions were weakened.

## Results

| Suite | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Treasury lifecycle and eligibility | 13 | 0 | 0 |
| Treasury security/property | 5 | 0 | 0 |
| Treasury deployment and Registry binding | 4 | 0 | 0 |
| HighCountry direct Treasury gateway | 2 | 0 | 0 |
| Total | 24 | 0 | 0 |

Both fuzz properties completed 2,500 runs each. Exact SHA checkout, Solidity formatting, import-closure preparation and compiled ABI/read-only checks passed. Router artifact SHA-256: `b0a05862399491cd9cd0930d0739fdac7ff2df2ac6c8895c5eef22c40f3f00c7`. Router compiled runtime template SHA-256: `d9e7a217c2591c1a1605025c3d57062504598b22f13bfb82929001d2f7deb8bf`. These are compiled artifact identities, not deployed testnet hashes.

## Scope and reconciliation

Router eligibility now applies live asset-wide epoch capacity, including reductions below already-recorded spend and exact-cap execution. Inclusive time bounds, budget effectiveness, current policy, missing-ID revert and caller-independent semantics are preserved. The execution registry remains unchanged and retains actual caller capability and release commitment checks. Public ABI and read-only authority are preserved. All 24 tests passed on the exact qualified SHA; no new test run is claimed for the documentation-only reconciliation. The reconciliation incorporates REC-1 and adds this evidence and roadmap entry; qualified implementation, test owners and workflow remain unchanged. AUDIT-8/9 remain pending their original scope. Next: REC-3.
