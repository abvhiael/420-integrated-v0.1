# HZ-GCA-1.15 — Threat model qualification evidence

Status: **COMPLETE — Level 1**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Work package: **HZ-GCA-1.15 — Threat model**

## Qualification identity

- Repository: `abvhiael/420-integrated-v0.1`
- PR: **#565 — Add 420Hz Generate, Community & Awards roadmap phase**
- Branch: `feature/420hz-generate-community-awards-roadmap`
- Current `main` / base SHA: `d112b2eb55b50a3a4f52a5e2a5364374595efe71`
- Qualified implementation SHA: `6449d6b42b56af6d1898efe36705f8daa9f32a0a`
- Qualification level: **Level 1 — per-roadmap-step fast qualification**
- Level 2 milestone: **NOT REQUIRED for HZ-GCA-1.15**
- Level 3: **DEFERRED to HZ-GCA-17 phase closeout**

## Canonical definition

HZ-GCA-1.15 freezes the security threat model for the accumulated Generate + Community + Awards architecture.

It covers protected assets, trust boundaries, adversaries, attack surfaces, mitigations, residual/accepted risks, deferred runtime evidence, fail-closed rules and executable security invariants.

## Implementation completed

Added:

- `hz/config/gca-threat-model-v1.json`
- `docs/architecture/420hz/HZ-GCA-1.15-THREAT-MODEL.md`
- `scripts/verify-420hz-gca-1-15.py`

Updated:

- `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`
- `.github/workflows/420hz-gca.yml`

## Requirements satisfied

### Protected assets / trust boundaries

The threat model explicitly protects:

- Wallet/session authorization;
- private generation inputs/drafts;
- provider/model/result identity;
- provenance/disclosure/consent;
- Creative/Rights state;
- generation economics;
- Community records/privacy;
- qualified-play/Charts state;
- Awards state/history;
- moderation/evidence state;
- optional Arbitration consumption;
- storage integrity/deletion;
- derived-service freshness;
- operational credentials/secrets.

Security-sensitive trust crossings are enumerated between browser/Wallet, 420Hz/AI/Compute, provider/result verification, Creative/Rights, Storage, derived reads, Community/Charts, Identity/Awards, moderation, Arbitration and operator infrastructure.

### Threat catalogue

The machine-readable manifest freezes **24 threat classes**:

1. prompt/tool injection;
2. provider/result spoofing;
3. malicious media/metadata;
4. unsafe URL/HTML schemes;
5. unauthorized reference audio;
6. unconsented voice/persona;
7. derivative-rights bypass;
8. private draft/prompt leakage;
9. secrets/provider-token leakage;
10. generation spam/resource exhaustion;
11. Wallet/session replay/domain substitution;
12. payment/accounting confusion;
13. storage hash mismatch/resurrection;
14. stale/reorged derived state;
15. Community replay/privacy bypass;
16. Chart manipulation;
17. collusive nominations;
18. vote stuffing/Sybil voting;
19. Awards tally/result tampering;
20. moderation/report bypass or abuse;
21. evidence/privacy leakage;
22. Arbitration authority escalation;
23. provider/operator compromise;
24. cross-component confused deputy.

Each entry has an explicit surface, risk, mitigation list and residual-risk disposition.

### Core fail-closed protections

The model requires fail-closed behavior for:

- missing actor/chain/domain/capability/replay context;
- provider/result mismatch;
- missing reference/voice/derivative authorization;
- private/unlisted publication fallback;
- stale/unverified derived state;
- storage integrity mismatch;
- generation economic state disagreement;
- ambiguous Awards policy/eligibility/finality;
- unscoped moderation/Arbitration action;
- wrong/unavailable required service identity/version.

### Security invariants

The manifest freezes **HZGCA-THREAT-INV-001 through HZGCA-THREAT-INV-018**.

They prevent:

- model/prompt authority escalation;
- privacy fallback;
- provider-signature-as-settlement-proof;
- rights/consent bypass;
- replay duplication across economic/community/chart/Awards surfaces;
- executable malicious metadata;
- stale storage/projection resurrection;
- derived-authority substitution;
- hidden/manual Chart rank manipulation;
- nondeterministic/multi-result Awards finalization;
- Wallet-count-as-human uniqueness;
- moderation cross-domain escalation;
- private evidence disclosure by commitment;
- Arbitration superuser behavior;
- operator credential blast-radius expansion;
- stale/reorged privileged action;
- cross-boundary domain/replay ambiguity;
- creation of new runtime/protocol authority by the architecture step.

### Accepted/deferred risk separation

Accepted design risks are documented separately from unqualified runtime controls.

Deferred runtime evidence includes production:

- AI worker sandbox/tool/network isolation;
- media scanner/codec sandbox;
- distributed edge rate limits;
- secret management/rotation;
- qualified-play/bot detection;
- unique-human voting verifier;
- evidence host/key management;
- public-testnet restart/retry/reorg/rebuild abuse testing;
- incident-response/operator-suspension runbooks.

These are not falsely represented as repository-qualified live controls.

## Level-1 qualification

Dedicated workflow:

**420Hz GCA Qualification**

Successful exact-head run:

- Run ID: **37740311018**
- Run number: **#178**
- Job: **HZ-GCA Level 1**
- Job ID: **113189250047**
- Exact tested SHA: `6449d6b42b56af6d1898efe36705f8daa9f32a0a`
- Result: **PASS**

Successful checks:

1. exact PR-head checkout/verification;
2. all GCA JSON manifest syntax validation;
3. retained HZ-GCA-1.1 verifier;
4. retained HZ-GCA-1.2 verifier;
5. retained HZ-GCA-1.3 verifier;
6. retained HZ-GCA-1.4 verifier;
7. retained HZ-GCA-1.5 verifier;
8. retained HZ-GCA-1.6 verifier;
9. retained HZ-GCA-1.7 verifier;
10. retained HZ-GCA-1.8 verifier;
11. retained HZ-GCA-1.9 verifier;
12. retained HZ-GCA-1.10 verifier;
13. retained HZ-GCA-1.11 verifier;
14. retained HZ-GCA-1.12 verifier;
15. retained HZ-GCA-1.13 verifier;
16. retained HZ-GCA-1.14 verifier;
17. HZ-GCA-1.15 threat-model verifier.

The concurrently triggered **420Hz Web Qualification #114** also passed on the same exact implementation SHA. It is collateral evidence, not a substitute for required GCA Level 1.

## Diagnosed failed attempt

Initial exact-head run:

- SHA: `f4812abece5bf03bd133accc71d745365672d20e`
- Run ID: **37740238516**
- Job ID: **113189019195**
- Result: **FAIL**

All retained HZ-GCA-1.1 through HZ-GCA-1.14 checks passed.

The new HZ-GCA-1.15 verifier reported:

`adversary class missing: prompt/tool-injection`

Diagnosis: **test-harness wording defect**.

The manifest already contained the intended adversary:

`malicious generation user crafting prompt/tool/provider injection payloads`

Repair:

- changed only the verifier substring to match the normative adversary wording;
- changed no threat;
- removed no mitigation;
- changed no trust boundary;
- weakened no fail-closed condition or invariant.

The repaired exact SHA passed.

## Security / adversarial result

Result: **PASS**

The verifier confirms coverage of the roadmap-required attack classes, including:

- prompt injection across provider/tool boundaries;
- malicious media/metadata and unsafe URL/HTML;
- unauthorized reference audio;
- unconsented voice/persona;
- derivative-rights bypass;
- generation/resource abuse;
- Wallet/session replay;
- vote stuffing/Sybil patterns;
- collusive nominations;
- Chart manipulation;
- moderation/report bypass;
- provider/result spoofing;
- storage mismatch;
- stale/reorged derived state;
- private draft/prompt leakage;
- secrets/provider-token leakage.

## Level 2 status

**Not run / not required.**

HZ-GCA-1.15 is an ordinary architecture/security-definition substep. It changes no shared executable runtime component and is not the documented HZ-GCA-1 milestone boundary.

The HZ-GCA-1 Level-2 milestone remains **HZ-GCA-1.20**.

## Intentionally deferred Level 3

Deferred to HZ-GCA-17:

- canonical full Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- Docs/global reconciliation;
- retained 420Hz app suite;
- affected client/service/Indexer/Search/RPC/frontend/backend suites;
- complete adversarial/invariant/security/static-analysis qualification;
- deployment/config verification.

Solidity Contracts remains the canonical owner of the full Foundry inventory. Genesis/address-authority remains a distinct owner and must not duplicate that inventory.

## Limitations

HZ-GCA-1.15 intentionally does not implement or claim live qualification of:

- worker/container isolation;
- media scanner/codec sandbox;
- production CSP/egress firewall;
- distributed abuse/rate infrastructure;
- secret-manager/key rotation;
- live bot detection;
- production unique-human proof provider;
- live moderation operations;
- live Arbitration domain;
- testnet/production attack simulation.

Those remain later roadmap work.

## Blockers

None for HZ-GCA-1.15.

## Completion state

**HZ-GCA-1.15 — COMPLETE (Level 1).**

Parent **HZ-GCA-1 remains IN PROGRESS**.

Next canonical work package:

**HZ-GCA-1.16 — API/event/interface contracts**
