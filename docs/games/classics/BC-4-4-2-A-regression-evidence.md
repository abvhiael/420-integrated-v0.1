# BC-4.4.2-A — Executed regression evidence

Tested source: c3b3c0de3e18c2da15678055b0d863ab80af4d52

GitHub Actions push run: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45754986227
Job: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45754986227/job/139691397439
PR: https://github.com/abvhiael/420-integrated-v0.1/pull/1429

Verified job conclusion: success. Web unit tests: 548 passed, 0 failed, including all four original Word Salad tests. Public social feed HTTP tests: 4 passed, 0 failed. Static checks, three build profiles and static asset qualification succeeded. No test assertions changed. Published Word Salad artwork: 71 PNG files, 14,512,134 bytes, matching pinned Git blob identities, file sizes, PNG metadata and the exact artwork cap enforced by scripts/qualify-web.mjs.

## Original CI log excerpts

```text
2026-11-26T04:24:44.3715244Z # Subtest: all board dimensions, rack capacities and canonical premium cells render
2026-11-26T04:24:44.3715639Z ok 545 - all board dimensions, rack capacities and canonical premium cells render
2026-11-26T04:24:44.3715897Z   ---
2026-11-26T04:24:44.3716034Z   duration_ms: 5.84788
2026-11-26T04:24:44.3716186Z   type: 'test'
2026-11-26T04:24:44.3716333Z   ...
2026-11-26T04:24:44.3716716Z # Subtest: every physical tile art and approved control is allowlisted
2026-11-26T04:24:44.3717066Z ok 546 - every physical tile art and approved control is allowlisted
2026-11-26T04:24:44.3717294Z   ---
2026-11-26T04:24:44.3717434Z   duration_ms: 0.242912
2026-11-26T04:24:44.3717592Z   type: 'test'
2026-11-26T04:24:44.3717797Z   ...
2026-11-26T04:24:44.3718070Z # Subtest: draft and turn controls use authoritative state; rejected errors escaped
2026-11-26T04:24:44.3718463Z ok 547 - draft and turn controls use authoritative state; rejected errors escaped
2026-11-26T04:24:44.3718717Z   ---
2026-11-26T04:24:44.3718857Z   duration_ms: 1.38194
2026-11-26T04:24:44.3719016Z   type: 'test'
2026-11-26T04:24:44.3719164Z   ...
2026-11-26T04:24:44.3719350Z # Subtest: terminal shared victory locks moves
2026-11-26T04:24:44.3719596Z ok 548 - terminal shared victory locks moves
2026-11-26T04:24:44.3719784Z   ---
2026-11-26T04:24:44.3719922Z   duration_ms: 0.529917
2026-11-26T04:24:44.3720081Z   type: 'test'
2026-11-26T04:24:44.3720225Z   ...
2026-11-26T04:24:44.3720360Z 1..548
2026-11-26T04:24:44.3720497Z # tests 548
2026-11-26T04:24:44.3720718Z # suites 0
2026-11-26T04:24:44.3720862Z # pass 548
2026-11-26T04:24:44.3721155Z # fail 0
2026-11-26T04:24:44.3721481Z # cancelled 0
2026-11-26T04:24:44.3721636Z # skipped 0
2026-11-26T04:24:44.3721838Z # todo 0
2026-11-26T04:24:44.3722017Z # duration_ms 2403.830866
2026-11-26T04:24:39.8712358Z c3b3c0de3e18c2da15678055b0d863ab80af4d52
2026-11-26T04:27:50.5462228Z BC-4.4.2 verified artwork: 71 14512134
2026-11-26T04:27:54.6183489Z BG-19.13 static build gates passed: 270 files; 21355446 bytes; max JS 262144, CSS 262144, base assets 1610303/1217536, 49 card assets 2579120/4194304, 6 atlas layers 2646094/12582912, 6 vehicle tokens 7795/16384; optimized brand assets verified
```

## Scope boundary

These tests execute the real renderSaladTable implementation with fixtures and verify generated markup and asset allowlists. They do not execute a browser, measure responsive layout, compare rendered screenshots or exercise pointer interactions. Browser-specific acceptance remains unverified; do not claim complete visual qualification on this evidence alone. The PR was opened after the successful push run; PR checks are separate.
