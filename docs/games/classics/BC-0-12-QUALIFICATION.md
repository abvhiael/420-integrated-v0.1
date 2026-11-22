# BC-0.12 — Classics shared test and release qualification

**Status:** implementation in repository; exact-head CI evidence to be added after successful runs.
**Scope:** canonical 25 BC-1…BC-25 game titles, not the separate Cross-Country Chaos platform.
**No game title was activated or marked playable by this milestone.**

## Test matrix and owned sources

| Area | Executable scope | Owner |
|---|---|---|
| Unit / rules property | 128 deterministic two-player rounds, legal actions, seed/replay, tamper and terminal state, 512 mutated catalogue/evidence cases | `classic_release_qualification_test.go`, `classics-release-qualification.test.js` |
| PostgreSQL integration | PostgreSQL 16 Go race; test-only 420ID cookies for two members, independently authenticated private-seat views, authoritative scores and terminal state | `classic_release_qualification_integration_test.go` |
| Multiplayer / concurrent | 12 concurrent retry requests through independent service instances; exactly one durable command/event transition and consistent high-water sequence | Same integration test |
| AI simulation | Complete deterministic easy/medium/hard bot-v-bot fixtures plus existing BC-0.8 rule budget tests | Unit tests and existing BC-0.8 Go tests |
| Recovery / fault injection | Cold session constructor/replay; process restart, post-restart moves, event replay, invalid and forged public journal; simulated network failure and reconnect | Go integration plus Chromium fixtures, retained BC-0.11 adversarial cases |
| Browser / mobile / keyboard | Real headless Chromium, desktop 1366×800 and mobile 390×844; deep-link navigation, unqualified Play denial, keyboard tab flow, page exceptions | `classics-browser-qualification.mjs` |
| Accessibility | Chromium axe-core WCAG 2.0/2.1 A/AA serious and critical defects block qualification, plus keyboard, width and existing forced-colors/static checks | Same Chromium runner; retained BC-0.9 UI regression |
| Deployment / safety | Exact commit checkout, fail-closed 25-game catalogue and individual GitHub run SHA/workflow identity, manual main-only live acceptance | `bc-0-12-classics-qualification.yml`, `bc-0-12-classics-live-acceptance.yml`, `classics-release-gate.mjs` |

The fixed 25-title registry is navigable even when a game engine is not
available. `registry` means on-chain descriptor only, not a runnable board.
No browser fixture, simulated 420ID subject, synthetic score, local Playwright
test, or green unit test may lift a production Play gate.

## Exact-source qualification

Pull request and main builds use `github.event.pull_request.head.sha || github.sha`
for checkout, verify `git rev-parse HEAD`, and exercise the focused Node,
PostgreSQL 16 Go `-race`, Chromium and live-release audit jobs. Browser
dependencies are pinned, installed only in test jobs and never copied to the
web distribution; no existing asset-size, CSP, 420ID or financial safety
limits are relaxed.

**Repository qualification** allows BC-0.12 to close only after all three
workflow jobs succeed at a shared code SHA and the retained prior release
guards remain passing. This proves the shared test infrastructure, **not**
per-title live completion or deployment.

## Real production acceptance (separately gated)

`.github/workflows/bc-0-12-classics-live-acceptance.yml` is manual-only
`workflow_dispatch`, refuses a non-`main` ref and demands two different
real 420ID session cookies from GitHub Actions secrets:

- `BC12_ACCOUNT_A_COOKIE`
- `BC12_ACCOUNT_B_COOKIE`

Secrets are consumed only by the GitHub-hosted Chromium runner and are not
printed or copied to its retained receipt. The test visits the genuine
HTTPS production origin, verifies that each account authenticates as a
different 420ID subject, then invokes a **game-specific real rules adapter**
under `bong-goggles/web/test/live-classics/<game-id>.mjs` implementing
`playToMidpoint`, `finishAfterReload` and `runBotDifficulty`.
The harness confirms per-account server snapshots at the midpoint,
browser reload/recovery, authoritative terminal result, distinct private
seat projections and completed real Easy/Medium/Hard bot games. Any missing
adapter, authentication, private view, playable engine, production
deployment or credentials fails closed; **BC-0 supplies no such adapters**.

The retained receipt contains only game ID, exact source SHA and GitHub run ID.
No session cookie, concealed hand, 420ID subject or personal access token
may be placed into public evidence.

## Public Play gate / release evidence

`BC-0-12-RELEASE-EVIDENCE.json` starts with an empty `games` object.
The release audit fails on altered game order, a title tagged `account`
without evidence, out-of-sequence BC-1…BC-25 activation, unknown statuses,
wrong 420ID principals, untrusted origins, rule hashes, or non-successful
GitHub Actions runs. It validates separate exact-head framework and manual
production acceptance runs against GitHub's authenticated REST response
and checks the live workflow identity and source SHA. Evidence cannot be
manufactured by setting client flags, marking a fixture as `verified`,
or editing a catalogue status.

The game-specific deployed rule engine, legal moves, hidden-card handling,
AI, rematch and real end-to-end release are gates for **each individual game**.
The next roadmap game is **BC-1 Cribbage** only once BC-0 repository
infrastructure is qualified; BC-1 must not be labeled released until its own
deployed acceptance passes.

## Developer reproduction

From the repository root:

```sh
node --test bong-goggles/web/test/classics-release-qualification.test.js bong-goggles/web/test/classics-menu.test.js bong-goggles/web/test/tabletop-components.test.js bong-goggles/web/test/classic-communications.test.js
node bong-goggles/web/scripts/classics-release-gate.mjs --audit
go test -race -count=1 -tags account420_integration -run '^(TestBC12|TestBC11|TestBC08DeterministicBotVersusBotSimulation|TestBC06SessionMovesReplaysPrivacyAndRestart)' ./services/bong-goggles-account-social ./cmd/bong-goggles-social
```

Go integration requires the same disposable PostgreSQL 16 database and
`ACCOUNT420_TEST_DSN` as the retained BC-0.5–0.11 workflow. Chromium
requires pinned test-only `playwright@1.65.1` and `axe-core@4.10.3`
and a locally installed Playwright Chromium. The browser test serves only
local first-party source; its transport endpoints are explicit test fixtures,
not evidence of production service availability.
