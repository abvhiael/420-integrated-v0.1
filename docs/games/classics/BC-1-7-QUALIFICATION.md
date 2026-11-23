# BC-1.7 — Cribbage final repository qualification and acceptance

**Status: REPOSITORY QUALIFIED on 2026-11-22 at exact source `2ce243ce3e5db365e101ed461a4b690150cfafec`. BC-1.8 deployed production acceptance and public Play are NOT qualified or authorized.**

## Mandatory BC-1.7 gates

- Frozen Cribbage rules identity `v1.0` / `6f13bd77568efc5d0836eaa61458ca0cc2c500d1db2d9c38e228b1c668f71e24`. Retain previously qualified 2/3/4 seat rules, complete 121-point two-account match, Easy/Medium/Hard server AI, immutable cryptographic replay, undo/timeout, turn security and account recovery tests.
- Real PostgreSQL 16, signed 420ID identities and Go race: concurrent same-request challenge idempotency, concurrent distinct requests against the 10-room quota, unique one-source rematch under competing hosts, irreversible block/follow consent revocation, simultaneous same-ID Cribbage moves, exactly one immutable command/journal and cross-account privacy.
- Actual desktop and mobile Chromium: different HTTP-only cookie jars, browser-generated challenge/rematch POST, keyboard-only submission, untrusted HTML-escaped friend names, participant-specific history/invitation recovery after reload, auth-outage wiping of rendered private state, WCAG 2.1 AA axe serious/critical violations at zero, mobile no horizontal overflow.
- The existing `test/classics-live-acceptance.mjs` now has a **real, game-specific** `live-classics/cribbage.mjs` adapter. It starts authenticated lobby + 420ID second human, plays *real server turns* to a midpoint, resumes after page reload, completes 121, verifies two signed final seat projections and stored result, completes an explicitly accepted rematch to 121, and independently runs Easy/Medium/Hard AI against deployed server workers. Nothing in this adapter stubs API replies or asserts scores/rewards from the browser.
- Existing `bc-0-12-classics-live-acceptance.yml` remains **main-only manual dispatch** with two real 420ID secret cookies and an exact deployed rules hash; no PR test can activate public Play or fake that production attestation.

## Evidence register

Exact-head workflow [#45080232054](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45080232054) **SUCCESS (3/3 jobs)** on `2ce243ce3e5db365e101ed461a4b690150cfafec`:

- **signed-postgres-concurrency** (job `137386497705`): Go `-race` and `go vet` with real PostgreSQL 16, 420ID session fixtures and frozen Cribbage rules. **4/4 TestBC17 PASS**, covering 12 concurrent same-request challenges, 16 concurrent different-request quota attempts, single surviving rematch from competing players, block/consent revocation and exactly one immutable move/event/command from 10 simultaneous requests. No relaxed throttles or assertions.
- **browser-privacy-accessibility** (job `137386497443`): **17/17 Node regression PASS** plus actual Chromium desktop/mobile with two independent HTTP-only 420ID cookie jars, keyboard-only challenge and rematch POST, separate account invitation/history recovery and logout/outage privacy scrubbing. **No axe WCAG 2.1 AA serious/critical violations**; corrected new history link contrast within the original `cribbage.css` 12-KiB cap.
- **release-separation** (job `137386497237`): **5/5 release-gate tests PASS**; 25 catalogue entries locked and **0** games falsely promoted to public Play.

**Not asserted:** The new real-service `live-classics/cribbage.mjs` adapter was syntax-checked but the existing main-only, manually dispatched `bc-0-12-classics-live-acceptance.yml` was NOT executed. Deployed 420ID credentials, independent real-production two-account completions, per-difficulty production bot completion, operational rollout/rollback and public playable flag remain BC-1.8 release requirements.

Pre-existing independently qualified evidence: [BC-1.2](BC-1-2-QUALIFICATION.md), [BC-1.3](BC-1-3-QUALIFICATION.md), [BC-1.4](BC-1-4-QUALIFICATION.md), [BC-1.5](BC-1-5-QUALIFICATION.md), [BC-1.6](BC-1-6-QUALIFICATION.md).

**Strict boundary:** A green source/fixture job is not proof of a deployed 420ID game. Live acceptance requires a deployed instance using the verified rules hash, separate authenticated accounts, worker activation and real main-only dispatch with environment secrets. Do not enable the catalogue until BC-1.8.
