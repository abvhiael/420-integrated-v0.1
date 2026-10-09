# HZ-GCA-12 — Awards UX and permanent history: Level 1 qualification

Status: **COMPLETE — repository-local fixture-backed Level 1**.
Canonical roadmap: `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`, HZ-GCA-12.
Branch / PR: `feature/420hz-generate-community-awards-roadmap` / #565.
Base main observed: `ffc6a4028676907c266714b5c1ae8ba3af9a7137`.

Qualified implementation SHA: `5187f4daa27112802c8135754c44f57dc12ab6e8`.
CI run: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37868294160
CI job: `113620185627` — **SUCCESS**.
Exact SHA assertion: PASS.
Node syntax checks: PASS.
Targeted Awards UX deterministic and adversarial fixtures: **5 PASS / 0 FAIL / 0 SKIPPED**.
Retained 420Hz Generate, Awards and voting tests: **85 PASS / 0 FAIL / 0 SKIPPED**.

Changed files:
- `hz/awards-web/model.js` — deterministic public-only Awards view model with fixtures, nomination/vote demo guards;
- `hz/awards-web/app.js` — DOM-rendered interaction and local Awards lifecycle phase controls;
- `hz/awards-web/index.html` — responsive semantic Awards landing, sections and fixture controls;
- `hz/awards-web/model.test.js` — deterministic UI, privacy, nomination/voting replay and archive tests;
- `.github/workflows/420hz-gca-12.yml` — exact-SHA Level 1 app-only workflow;
- `docs/architecture/420hz/HZ-GCA-12-AWARDS-UX.md` — UX/security/source-authority documentation;
- this audit record.

Exit criteria checklist:
1. Public Awards landing and current season/countdown: fixture implementation present.
2. Category browser and explicit eligibility text: present, category versions exposed.
3. Nomination form: present; fixture-local deterministic replay/closed-window validation.
4. Ballot/voting UI: present; explicit frozen/open distinction and fixture phase switching; test vote recording rejects replay.
5. Public live status without private voter proof, account, choice or nullifier: present/tested.
6. Winners/results, song badges and permanent archived season: present/tested against fixed archive fixtures.
7. Recording → Work → creator/rights provenance: stable per-recording IDs and accessible in-page reference anchors; production rights resolving deferred.
8. Complete fixture user flow: view season, browse rules, nominate locally, switch phase, submit fixture vote, inspect winners/archive; no production election claims.

Correction history: initial run `37868190559` failed one test due to a fixture replay assertion referencing a different candidate; corrected the test, with final passing replacement `37868294160`.

Authority/privacy: public output excludes private/unpublished source records, hides voter keys, secret choices and credentials, does not create live Awards results or payment rights. Browser code uses DOM `textContent` for untrusted labels. Demo-only phase controls are explicitly marked and never submit a production write.

Limitations: this is a static fixture application in the PR, not a live Cloudflare deployment or a production Wallet/Identity/Creative-backed Awards frontend. No claim of live source proof, immutable database, decentralized vote verification or real Awards ballot is made. Production integration and browser-end-to-end qualification against deployed service remain separate work.

Level 2: retained app tests included; broader app integration milestone deferred until live Awards/API convergence.
Level 3: Solidity Foundry/Genesis/full Integrated/Docs and merge-candidate qualification intentionally deferred.
No step-local CI blockers remaining.

Next canonical roadmap step: **HZ-GCA-13 — Rewards and prize settlement**.
