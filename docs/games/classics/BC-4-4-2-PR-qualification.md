# BC-4.4.2 — PR qualification evidence

PR #1429; qualified head `09571ea33361a94478ec43a67338ea7ff9773c17`.

- BC-3.7 Chess Automated and Adversarial Qualification: pull_request, completed, success — https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45756673438
- AUTH-8/9/10/11 Wallet-Independent BongGoggles Social: pull_request, completed, success — https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45756673439
- BC-2.6 Labyrinth History and Social Integration: pull_request, completed, success — https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45756673237
- 420Docs Qualification: pull_request, completed, success — https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45756673333
- BC-1.4 Cribbage Player Frontend: pull_request, completed, success — https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45756673096
- BC-4.2 Word Salad Backend Qualification: pull_request, completed, success — https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45756673144
- BC-2.4 Labyrinth 325-Point Interface and Source Art Gate: pull_request, completed, success — https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45756673397
- BC-2.7 Labyrinth Final Repository Qualification: pull_request, completed, success — https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45756673199
- BC-3.6 Chess History and Social Integration: pull_request, completed, success — https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45756673142
- BC-3.4 Chess Player Interface: pull_request, completed, success — https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45756673118
- BC-3.5 Chess Player Interface: pull_request, completed, success — https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45756673170
- BC-1.5 Cribbage Authenticated Multiplayer and Recovery: pull_request, completed, success — https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45756673071
- Bong Goggles Web Verification: pull_request, completed, success — https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45756673052
- .github/workflows/bc-2-1-labyrinth-cribbage-rules.yml: push, completed, failure — https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45756666205
- .github/workflows/bc-2-5-labyrinth-multiplayer.yml: push, completed, failure — https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45756664993

All 13 PR workflows passed. Earlier exact-source web qualification and log excerpts are retained in BC-4-4-2-A-regression-evidence.md. The two failed push runs had no jobs; inspection found malformed YAML and truncated shell commands in both workflow files, with identical blobs on main. Repair restores the existing test selectors and package targets, without relaxing assertions. The repaired workflows require fresh execution; the old failures are retained as historical evidence, not represented as passing. Browser acceptance explicitly deferred by owner until Render upgrade. No release gating is removed.
