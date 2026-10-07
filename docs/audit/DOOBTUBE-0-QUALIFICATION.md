# DoobTube — DOOBTUBE-0 qualification evidence

Roadmap step: **DOOBTUBE-0 — Canonical identity and architecture decision**
Qualification level: **Level 1 — app-scoped architecture/governance qualification**
Status: **COMPLETE**
PR: **#553**
Branch: `audit/doobtube-baseline-20261006`

## Canonical implementation decision

DoobTube is now canonically defined as a **replaceable user-facing video application/client over the existing 420Media service**.

The adopted architecture in `docs/DOOBTUBE-ARCHITECTURE.md` establishes that:

- `420/service/media/v1` remains the canonical Media service identity;
- DoobTube does not rename, replace, fork or duplicate 420Media;
- DOOBTUBE-0 creates no second Media protocol/service authority;
- DOOBTUBE-0 creates no new protocol/service Registry identity;
- DoobTube is not added to the frozen Genesis application catalog;
- DoobTube is not added as a second Genesis consumer service;
- DOOBTUBE-0 allocates no frozen/reserved address;
- DOOBTUBE-0 requires no DoobTube-owned smart contract;
- DoobTube is non-custodial and does not hold wallet signing material;
- raw/high-volume media remains off-chain;
- app caches, feeds, projections and moderation presentation remain non-authoritative;
- stronger remedies remain with the appropriate owning protocol/service.

## Files changed for DOOBTUBE-0

- `docs/DOOBTUBE-ARCHITECTURE.md` — adopted architecture and authority boundaries;
- `docs/DOOBTUBE-NAME-DECISION.md` — naming decision promoted from proposed to adopted;
- `docs/DOOBTUBE-ROADMAP.md` — DOOBTUBE-0 marked COMPLETE (Level 1);
- `docs/DOOBTUBE-AUDIT.md` — reconciled baseline findings with the adopted architecture;
- `scripts/verify-doobtube-baseline.py` — upgraded to enforce DOOBTUBE-0 invariants.

The branch was reconciled with current `main` before qualification. The main-side changes were limited to existing 420Media web-logo presentation files and did not alter the canonical Media service/Genesis architecture.

## Requirements satisfied

DOOBTUBE-0 required explicit decisions for:

1. **Relationship to 420Media** — satisfied: DoobTube is a consumer/composition client over 420Media.
2. **Registry/service identity** — satisfied: no new protocol/service ID; Media authority resolves through `420/service/media/v1`.
3. **Genesis disposition** — satisfied: no frozen application-catalog or second consumer-service entry.
4. **Contract ownership** — satisfied: no DoobTube-owned smart contract is required by this step.
5. **Authority boundary** — satisfied: application state/presentation is replaceable and non-authoritative.
6. **Trust boundary** — satisfied: Wallet and canonical services remain authoritative; unresolved provenance fails closed.
7. **Data boundary** — satisfied: authority-bearing state remains with owning protocols; raw/high-volume media remains off-chain.
8. **Privacy boundary** — satisfied: least authority/data minimization; private/unlisted content cannot become public projection by UI assumption.
9. **Moderation boundary** — satisfied: app-level hiding/presentation does not gain canonical rights/custody/ruling authority.
10. **Custody boundary** — satisfied: DoobTube is non-custodial by architecture.
11. **Exit criterion** — satisfied: an adopted architecture exists with no contradiction against the current 420Media, Genesis application or consumer-service policy.

## Level 1 qualification

Qualified implementation SHA:

`a125f5c0ea0b620a03704d6b45670b6c4164a1bf`

Reconciliation base / current `main` at qualification:

`f0f64ecfe28c4390b524baaf7382ef82808aaa17`

Workflow: **DoobTube baseline audit**
Run: **37557194952**
Job: **baseline / 112586035071**
Result: **PASS**

Verified on the exact implementation SHA:

- explicit exact-head checkout;
- `git rev-parse HEAD == expected PR head SHA`;
- adopted naming decision;
- adopted canonical architecture;
- DOOBTUBE-0 COMPLETE roadmap state;
- canonical `420/service/media/v1` remains named `420Media`;
- no DoobTube/420Video Genesis consumer-service entry;
- no DoobTube/420Video frozen Genesis application entry;
- no premature `doobtube/` runtime;
- no premature DoobTube/420Video contract namespace;
- all twelve DOOBTUBE-0 architectural invariants;
- no false deployed/testnet/Genesis/production readiness claim.

## Diagnosed superseded failure

Run **37557139871**, job **112585859480**, failed only in the verifier.

Classification: **test-harness defect**.

Cause: the Python verifier needle accidentally contained literal backslashes around Markdown backticks (for example `\`config/genesis-applications.json\``) while the architecture document correctly used ordinary Markdown backticks.

The exact-SHA assertion passed in that run. No protocol/application defect was identified. The verifier literals were repaired, producing the qualified implementation SHA above. The deterministic failure was diagnosed before requalification rather than blindly rerun.

## Security/adversarial/invariant result

No runtime security claim is made because DOOBTUBE-0 contains no runtime implementation.

Architecture-level negative invariants are qualified:

- no silent Media rename/replacement;
- no shadow Media service;
- no implicit Genesis promotion;
- no implicit frozen address;
- no premature app-owned contract;
- no custody/private-key assumption;
- no on-chain raw media;
- no projection/cache authority promotion.

No unresolved DOOBTUBE-0 architecture vulnerability or contradiction remains.

## Milestone status

DOOBTUBE-0 is an **ordinary Level 1 roadmap step**, not a Level 2 milestone.

The documented app integration milestone remains **DOOBTUBE-8 — Ecosystem integration milestone**. Level 2 is therefore intentionally not run for DOOBTUBE-0.

## Intentionally deferred Level 3 qualification

Per the phase qualification policy, the following remain intentionally deferred until **DOOBTUBE-11 — Repository Level 3 exact-head closeout**:

- canonical full repository Solidity inventory;
- Genesis/address-authority full qualification;
- 420 Integrated/global qualification;
- repository-wide Docs/global reconciliation;
- unrelated app audits;
- global fault/soak qualification;
- final deployment/config/release reconciliation.

These are not blockers for this ordinary architecture-only Level 1 step.

## Limitations and blockers

No blocker remains for DOOBTUBE-0.

The application as a whole is not code/build/test/integration/security/testnet/Genesis/production complete; those states belong to later stable roadmap steps.

## Evidence SHA rule

This file is a **durable evidence-only update** written after the exact implementation SHA qualified.

Its commit may have a different evidence SHA. It changes no executable source, tests, workflows, dependencies, configuration, interfaces, generated/runtime artifacts, deployment state or substantive requirements. Therefore the already-qualified implementation SHA above remains authoritative and recursive qualification is not required.

## Next canonical roadmap step

**DOOBTUBE-1 — Product scope and canonical user workflows**
