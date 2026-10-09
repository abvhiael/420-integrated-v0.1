# HZ-GCA-11 — Eligibility, nominations and voting

Status: **COMPLETE — repository-local Level 1 qualified**.

Canonical definition: `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`, HZ-GCA-11.
Frozen authority/policy: `hz/config/gca-nomination-voting-policy-v1.json`, `hz/config/gca-awards-architecture-v1.json`.

Implementation: `hz/generate/src/award-voting.js`, integrated export `hz/generate/src/index.js`, script `hz/generate/package.json`.
Tests: `hz/generate/test/award-voting.test.js`.
Dedicated fast CI: `.github/workflows/420hz-gca-11.yml`.
Architecture: `docs/architecture/420hz/HZ-GCA-11-VOTING.md`.

Qualified implementation SHA: `1f5c76958bc9036ae22b231a9d6d5ca7aa45ee97`.
PR/branch: #565, `feature/420hz-generate-community-awards-roadmap`.
Observed base main: `ffc6a4028676907c266714b5c1ae8ba3af9a7137`.
Implementation targeted run: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37866314099 — PASS, job 113613763666. 85 tests passed, 0 failed, 0 skipped, 0 cancelled. Exact-SHA assertion PASS; frozen HZ-GCA-1.12 and HZ-GCA-1.13 verifiers PASS. Evidence-only HEAD run: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37866354765 — PASS.
Prior targeted run: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37866247568 — SUCCESS, but superseded by later executable source hardening.

Requirements implemented locally: explicit nomination/window/Creative source eligibility, AI classification policy, self-nomination rules, nomination caps, dedupe, optional public community support policy, deterministic freeze/dedup of accepted candidates, user authorization, separate wallet/identity/jury mode, fail-closed qualified identity, ballot-scoped vote replay keys, opt-in abstention, quorum, threshold and tie modes, deterministic finalization and immutable result identity.

Adversarial fixtures: unauthorized nomination, private-source rejection, self-nomination, caps, replay, closed nomination window, accepted candidate freeze, wrong frozen choice, double ballot vote, premature/duplicate finalize, wrong/absent identity proof, permanent badge references. Source status must be verified at nomination, ballot freeze and result finalization. Tests are repository-local and retain earlier generation, Community, Charts and Awards suites.

**Not claimed:** deployable independent public service, trusted Wallet/Identity adapter, high-assurance unique-human source, distributed nullifier database, durable atomic replay store, rate-limiter, public nomination/voting integration, actual on-chain transactions, testnet, canonical source on-chain finality. These remain production integration/testnet blockers. Coordinator's hardcoded `admin` delegation is repository-local and must never be exposed as a trusted production authentication/authorization path.

Level 2: no explicit milestone for HZ-GCA-11; retain app boundary for later meaningful integration.
Level 3: full Solidity, Genesis, 420 Integrated, Docs and global integration deferred to phase closeout.

Next canonical step: **HZ-GCA-12 — Awards UX and permanent history**.
