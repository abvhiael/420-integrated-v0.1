# ARC-1.6 — Durable exact-SHA Level 1 qualification certificate

**Step:** ARC-1.6 — Implement keyboard, touch and gamepad input abstraction  
**Disposition:** PASS — normalized, game-scoped input adapter and scoped qualification; no actual completed game content or device-wide accessibility certification.  
**Qualification level:** Level 1

- **Qualified implementation SHA:** `3f472583d711cb73935d3b0fc02450559c412bd6`
- **Reconciliation base:** `2bb4e64402d816a95c3a0cd52f629f272d00b61d`
- **PR:** [#752](https://github.com/abvhiael/420-integrated-v0.1/pull/752)
- **Branch:** `audit/arcade-1-6-input-abstraction`
- **Owning workflow:** `.github/workflows/arcade-1-6-level1.yml`
- **Successful run:** [39205410272](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39205410272)
- **Successful job:** `117907045117` — completed/success.

## Verified checks

- Normalized seven actions across keyboard, pointer/touch and gamepad, with focus-limited keyboard capture and suppression of editable controls, modifiers, repeated keys and external focus.
- Keyboard release; multipointer capture/release/cancel; gamepad button/axes deadzone, disconnected/no-controller behavior, and pause/disable/dispose cleanup.
- Explicit gameId scope, strict action allowlist and inert behavior without enabled game lifecycle.
- Adversarial malformed identity, action, gamepad configuration and terminal disposal tests.
- Existing Phaser and React casual adapter tests passed.
- Existing Arcade React launcher syntax/security checks, typecheck, regression tests and Vite production build passed.
- No SDK signing, verified-score, Registry or economic authority introduced.

## Prior failed attempt

Run [39205333165](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39205333165), job `117906814268`, failed in the native EventTarget test fixture because `Event.target` is read-only. The fixture was corrected to define a controlled own test property without weakening input behavior or assertions. The corrected Level 1 owner passed on the exact implementation SHA recorded above.

## Reconciliation

The starting `main` base advanced by sixteen unrelated LIFTd rideshare files/workflow commits. These do not alter Arcade source or its frozen inputs. Preserve independent exact-SHA Arcade Level 1 evidence; do not require requalification just because unrelated source on `main` advanced.

**Evidence commit:** this separate document-only certificate; not the tested implementation SHA.  
**Level 2:** not triggered. **Level 3:** not triggered. No unrelated global qualification manually dispatched.  
**Outstanding implementation:** real game-specific input widgets, controller usability on physical devices, WCAG game accessibility and gameplay content are later local ARC milestones, not falsely represented by this adapter.  
**Testnet:** live Gaming Protocol operator and Registry approval remain separate external proof.  
**Next:** only the next canonical step confirmed from the authorized roadmap; do not invent numbering.
