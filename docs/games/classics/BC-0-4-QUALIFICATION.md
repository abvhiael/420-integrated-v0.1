# BC-0.4 — Wallet-optional 420ID authentication and profiles

**Status:** Repository implementation **QUALIFIED**, 2026-11-21. Published frontend source/CSS smoke **PASS**. A full signed-in two-person browser end-to-end match is not claimed.
**Qualified implementation commit:** [`ae010bdba302dab52313102fb9e875fb9511a9e7`](https://github.com/abvhiael/420-integrated-v0.1/commit/ae010bdba302dab52313102fb9e875fb9511a9e7).
**Exact-head CI:** [Bong Goggles Web Verification #44964060589](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44964060589), completed **success** on the above SHA.
**Production source check:** [BongGoggles live header login #44964060528](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44964060528), completed **success** on the above SHA. Verified production host serves the updated app shell, 420ID identity module and responsive header CSS; it is a source/deployment smoke, **not** a real 420ID credential flow, browser click or 420ID service health attestation.
**Adjacent live check:** [BongGoggles live Home feed CSS #44964060540](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44964060540), **success**.

## Real functionality delivered

- The global header visibly shows **Sign In · Log in with 420ID** when the activated 420ID-backed account service has confirmed guest/unauthenticated state, including on `/games` and every game deep link. The link targets the existing **same-origin** `/social-api/auth/start`; no wallet approval, browser secrets or parallel OAuth implementation.
- When the exact same-origin `/social-api/v1/me` check verifies `walletRequired:false`, a valid 420ID UUID subject and a bounded display name, the header shows **My account: [verified name]** and a working **Sign Out** button. Sidebar and all 30 game detail screens reuse the same normalized account name. Account management links target existing `/social` and `/account/games` routes. No on-chain wallet is required for any of these reads.
- The new `AccountIdentityController` keeps only an in-memory public display name and subject. The existing 420ID/Account Social service owns the HttpOnly cookie, session expiration/introspection, CSRF/Origin enforcement and server authentication. No token, OAuth authorization code, Wallet key or cookie value is read or stored by JavaScript.
- Account identity is checked on every navigation, initial boot, tab return and while the page is visible. Bounded retries apply **only to idempotent GETs** during 502/503/504 transient sleep; a 401 clears the verified account. Quiet same-identity checks avoid unnecessarily re-rendering editors and losing drafts. Changes/expired sessions revoke the displayed identity rather than showing a stale profile.
- Sign Out performs a **single** authorized same-origin `/social-api/auth/logout` POST and clears all related local controller projections before awaiting confirmation. Concurrent reads and duplicate sign-out are fenced; failed logout never claims success, never retries the mutation and never preserves a supposedly verified profile.
- The existing Account Social profile editor remains the owner of profile writes. On a confirmed profile change, the header identity is reverified. The older Account Games Tic-Tac-Toe/Connect Four remain independently server-authorized and wallet-optional. The backend's `AccountGames.Invite/List/Get/Respond/Move` already checks 420ID subject and bidirectional blocks as applicable; BC-0.4 does not bypass those controls or claim the 25 unfinished games playable.
- When account services are intentionally disabled by build config, no misleading working login/action is shown. During loading or unverified service failure, no person is asserted signed in; the UI shows a checking or retry state and a real login path when appropriate.

## Repository changes

| File | Change |
|---|---|
| `bong-goggles/web/core/account-identity.js` | New, standalone account-identity *reader* of existing SSO session; strict DTO normalization; public header and per-game profile surfaces; guarded one-shot logout and revalidation |
| `bong-goggles/web/app.js` | Initializes account reader globally, wires Sign Out and Retry, refreshes on navigation/visibility/interval, and rechecks after profile edits |
| `bong-goggles/web/core/app-shell.js` | Renders authenticated/current 420ID header on every page, preserves separate Wallet state, shares verified account identity with Games and sidebar |
| `bong-goggles/web/core/games-ui.js` | Sign In/profile/current-account surfaces in public catalogue and each game page; existing wallet-only session hub remains gated |
| `bong-goggles/web/dashboard.css` | Accessible, mobile/forced-colour login, logout, retry and Games account presentation |
| `bong-goggles/web/test/420id-login-ui.test.js` | Maintains prior login/logout/escaping/activation expectations for the updated verified header |
| `bong-goggles/web/test/account-identity.test.js` | 13 new focused cases: valid DTO, wallet-free GET, expiration, transient retry, concurrency, one-shot logout, injection, all 25 deep links and browser lifecycle |
| `bong-goggles/web/scripts/qualify-web.mjs` | Independent pinned 12 KiB BC-0.4 asset allowance; BC-0.1–BC-0.3/legacy budgets and all card/map/vehicle checks remain unchanged |
| `.github/workflows/bonggoggles-live-header-login.yml` | Qualifies the new production account module alongside app-shell and the original prominent mobile styling; preserves the live-host verification gate |

## Actual qualification

- GitHub Actions run **#44964060589** at exact source SHA `ae010bdba302dab52313102fb9e875fb9511a9e7`: **386/386 web tests PASS**, **4/4 HTTP regressions PASS**, static checks PASS, default 420ID-disabled build PASS, explicitly activated Cloudflare account-social build PASS, BG-19.13 static asset/accessibility qualification PASS, frontend secret scan PASS.
- Recorded published asset budget: **BC-0.4 growth 10,842 / 12,288 bytes**, **BC-0.3 growth 13,687 / 16,384 bytes**, **BC-0.2 growth 7,918 / 8,192 bytes**, original legacy base **1,184,116 / 1,184,768 bytes**. All protected game-card, map, vehicle, per-file JS/CSS and original legacy limits remained enforced; no broad budget waiver was introduced.
- The code and the qualified one-shot logout use the existing same-origin Account Social service; no new Go contracts, SmartAccount/Wallet authority or game-engine changes were made, so unrelated chain and gameplay suites were not rerun.
- Live header run **#44964060528** PASS confirmed the source/CSS appears on `https://bonggoggles.420integrated.org/`. This does not independently attest to the availability of a user's credentials or the live 420ID provider.

## Boundaries

BC-0.4 establishes account identity **presentation and session revalidation**, not a credential refresh-token flow. When the server session expires, the client clears it and requires the existing 420ID login again; it does not mint or refresh credentials. Account/game policy enforcement remains server-side. New 25-title online game creation, invited seats, real-time matching, rules/AI, authoritative scoring and reward payouts are **not** implemented in this step.

**Roadmap:** BC-0.4 QUALIFIED (repository and live-header source check); **BC-0 remains IN PROGRESS**. Next substep is **BC-0.5 — Invites and seating**; it was not started here.
