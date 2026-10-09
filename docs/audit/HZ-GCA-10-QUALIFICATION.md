# HZ-GCA-10 — Awards domain model Level 1 qualification

Status: **PENDING exact-SHA Level 1 CI**. Do not mark COMPLETE until all required jobs PASS.

Canonical roadmap: `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`, HZ-GCA-10.
Authority policy: `hz/config/gca-awards-architecture-v1.json` and `hz/config/gca-nomination-voting-policy-v1.json`.

Branch: `feature/420hz-generate-community-awards-roadmap`; PR #565.
Observed main/base: `ffc6a4028676907c266714b5c1ae8ba3af9a7137`.
Implementation SHA: `918aff9164de3d231d57dc6e36bad3f333c4a5fb`.

Implemented:
- repository-local AwardProgram / Season / Category / EligibilityPolicy / Nomination / Ballot / Vote / Result / Badge models;
- named lifecycle transition validation, frozen season policy and ordered windows;
- season-scoped versioned category definitions, stable non-recycled object IDs;
- frozen candidate-set commitments, policy references, immutable result/badge identity;
- callback-based explicit action authorization, no inferred Creative/Wallet/Identity/Governance/Pay authority;
- adversarial tests for unauthorized writers, invalid windows/transitions, mutation escape, duplicate IDs, unready ballot and missing result/badge history.

Files: `hz/generate/src/awards.js`, `hz/generate/test/awards.test.js`, `hz/generate/src/index.js`, `hz/generate/package.json`, `.github/workflows/420hz-gca-10.yml`, `docs/architecture/420hz/HZ-GCA-10-AWARDS.md`, this record.

CI first attempted on `f3c00949966003083c01c3e42384d771c2ed6619`, run `37864315223`, job `113607287711`: FAIL, 81 passed / 1 failed. Root cause: policy object was returned by mutable reference. The code was repaired at implementation SHA above. This previous failure is superseded, not silently ignored.

Requalification: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37864406142
Job: `113607585027` (pending at time of this evidence record). Required: exact SHA, `npm run qualify`, HZ-GCA-1.12 architecture verifier, HZ-GCA-1.13 policy-boundary verifier.

Scope: local domain schemas/state machines only. Live qualified vote source, Identity-eligibility proof, Creative source checks, on-chain transaction bindings, production persistence and nomination caps / quorum / tie / one-person policy remain HZ-GCA-11 or later and must never be claimed here as qualified.

Level 2: no mandatory milestone established at HZ-GCA-10.
Level 3: full Solidity/Genesis/Integrated/Docs closeout intentionally deferred.
Next canonical: **HZ-GCA-11 — Eligibility, nominations and voting**.
