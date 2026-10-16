# BNB-5.14 — Global qualification evidence inheritance determination

**Decision: PARTIAL INPUT IDENTITY PROVEN; FULL PHASE-4 LEVEL-3 EVIDENCE INHERITANCE NOT AUTHORIZED.** This is a preflight determination, not a Level 3 PASS certificate.

## Scope and provenance (2026-10-15)

- Prior BNB-4.12 global qualification executable `7ccc76fe613ba4fdc162d459827f5ec95fae3385`; associated canonical passing runs recorded in `docs/bnb/BNB-4.12-PHASE4-LEVEL3-CLOSEOUT.md`: Solidity #38510212059, Genesis #38510278373, Integrated #38510325301, Docs #38510245111.
- BNB-5.14 reconciled main `d3310d153e7ccc71f5ded95639aadfd7a6f6e682`; qualified BnB candidate executable `7bed67de5833778a070b60e8d87aafc637a75a05`, evidence-only HEAD at inspection `ab0316c7d09e0f7d369733e647e60605a4215abb`.
- Current Phase 5 PR #644 remains draft/unmerged. GitHub comparison from main to BnB HEAD: 71 Phase-5 paths confined to `.github/workflows/bnb-runtime.yml`, `docs/bnb/**`, and `services/420bnb/**`, zero commits behind the reconciled main.
- Complete Git tree (not GitHub's truncated compare list) of Phase-4 executable versus main: **762 added/modified blob paths on main**, including **60 in `contracts/**`**, **32 in `scripts/**`**, **266 in `docs/**`**, and **64 in `.github/workflows/**`**. Counts include unrelated workflows and do not establish that each is a mandatory changed qualification input. However, they categorically disprove a claim that the global input tree remained unchanged since the Phase-4 qualification.
- Relative to reconciled main, Phase 5 introduces **no new files under `contracts/**`, `config/**`, `consensus/**`, `execution/**`, `integration/**`, root `go.mod`/`go.sum`, or canonical global workflow paths**. This verifies *BnB did not introduce further global input divergence from its main base*, not that old global evidence covers main.

## Canonical workflow file blob identity

| Owner | Phase-4 qualified tree blob | Reconciled main and BNB-5.14 blob | Inheritance implication |
| --- | --- | --- | --- |
| Solidity | `bf4c9ef01de812bce2e806c0123f33b5dc466629` | `fb32e969e05564790c1d419ad9007bf88c74d78c` | Changed workflow and contracts; Phase-4 evidence does not prove new input |
| Genesis | `79d560f3f389b73f9ca786d318fdf2e1e4360757` | `8827a175b0d05c1f16c5085eebaebf106018922f` | Changed workflow; cannot blindly inherit |
| Integrated | `2a9876dbb3364a83f717ba2873c4f34ffccaf7c7` | `82706a1818acf19016422bb1c55900961a87c3b6` | Changed workflow; full impact review needed |
| Docs | `16ffd7460905f719016ceea30b57020804c29dce` | same `16ffd7460905f719016ceea30b57020804c29dce` | Workflow code is unchanged; documentation input content changed, so exact-input inheritance still not proved |
| Retained BnB | Phase 5 modifies BnB services and workflow intentionally | Reconciled BnB Runtime Slice #38830601652 and nine BnB guardrails PASS on evidence-only HEAD | Scoped app evidence can be retained; no need to rerun unchanged BnB checks merely to regenerate certificates |

## Policy decision

Canonical `docs/bnb/BNB-PHASE5-ROADMAP.md` explicitly requires BNB-5.14 **final Level 3**, with canonical Solidity full source/test/script inventory, separate Genesis, Integrated, full Docs and affected BnB checks. Its evidence-inheritance clause applies to **evidence-only commits only when substantive requirements, source/tests/workflows/dependencies/configuration/runtime artifacts remain unchanged**. `docs/bnb/BNB-4.12-PHASE4-LEVEL3-CLOSEOUT.md` similarly limits evidence inheritance to evidence-only commits and requires new assessment for substantive changes. Neither policy establishes unconditional cross-phase reuse of Level-3 results after changed global source/workflows.

**Finding A — proven:** BnB-to-main reconciliation carried all current main global inputs byte-for-byte; BnB did not alter them further. An appropriate contemporaneous global PASS for exact matching inputs, if identified and permitted by qualified scope, might eliminate redundant work. This has not yet been demonstrated for all four owners.

**Finding B — proven:** The Phase-4 old global PASS inputs are not identical to current main / reconciled Phase-5 global inputs. Their prior passing run IDs must not be relabeled as exact-SHA BNB-5.14 PASS evidence.

**Finding C — permitted scope:** Inherit passing BnB app results across the confirmed documentation-only HEAD diff. Reuse unaffected historical evidence for context and unchanged components where explicitly allowed, not as a substitute for mandatory current Phase-5 Level-3 evidence.

**Final BNB-5.14 decision: NOT YET QUALIFIED.** No new global Foundry or other expensive workflow was dispatched in making this assessment; PR #644 remains draft/unmerged. Before any expensive run, inspect newer successful global evidence matching current main input blobs, then complete frozen-input preflight and obtain only the genuinely missing mandatory Level-3 checks, keeping Foundry unique to its canonical owner.
