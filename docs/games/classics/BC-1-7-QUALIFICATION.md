# BC-1.7 — Cribbage final repository qualification and acceptance

**Status: implementation under exact-head qualification. BC-1.8 production release not authorized.**

## Mandatory BC-1.7 gates

- Frozen Cribbage rules identity `v1.0` / `6f13bd77568efc5d0836eaa61458ca0cc2c500d1db2d9c38e228b1c668f71e24`. Retain previously qualified 2/3/4 seat rules, complete 121-point two-account match, Easy/Medium/Hard server AI, immutable cryptographic replay, undo/timeout, turn security and account recovery tests.
- Real PostgreSQL 16, signed 420ID identities and Go race: concurrent same-request challenge idempotency, concurrent distinct requests against the 10-room quota, unique one-source rematch under competing hosts, irreversible block/follow consent revocation, simultaneous same-ID Cribbage moves, exactly one immutable command/journal and cross-account privacy.
- Actual desktop and mobile Chromium: different HTTP-only cookie jars, browser-generated challenge/rematch POST, keyboard-only submission, untrusted HTML-escaped friend names, participant-specific history/invitation recovery after reload, auth-outage wiping of rendered private state, WCAG 2.1 AA axe serious/critical violations at zero, mobile no horizontal overflow.
- The existing `test/classics-live-acceptance.mjs` now has a **real, game-specific** `live-classics/cribbage.mjs` adapter. It starts authenticated lobby + 420ID second human, plays *real server turns* to a midpoint, resumes after page reload, completes 121, verifies two signed final seat projections and stored result, completes an explicitly accepted rematch to 121, and independently runs Easy/Medium/Hard AI against deployed server workers. Nothing in this adapter stubs API replies or asserts scores/rewards from the browser.
- Existing `bc-0-12-classics-live-acceptance.yml` remains **main-only manual dispatch** with two real 420ID secret cookies and an exact deployed rules hash; no PR test can activate public Play or fake that production attestation.

## Evidence register

Exact-head workflow: `.github/workflows/bc-1-7-cribbage-qualification.yml`. All three jobs must succeed against the same head. Record exact commit, run IDs and any verified external acceptance limitations here when results are available.

Pre-existing independently qualified evidence: [BC-1.2](BC-1-2-QUALIFICATION.md), [BC-1.3](BC-1-3-QUALIFICATION.md), [BC-1.4](BC-1-4-QUALIFICATION.md), [BC-1.5](BC-1-5-QUALIFICATION.md), [BC-1.6](BC-1-6-QUALIFICATION.md).

**Strict boundary:** A green source/fixture job is not proof of a deployed 420ID game. Live acceptance requires a deployed instance using the verified rules hash, separate authenticated accounts, worker activation and real main-only dispatch with environment secrets. Do not enable the catalogue until BC-1.8.
