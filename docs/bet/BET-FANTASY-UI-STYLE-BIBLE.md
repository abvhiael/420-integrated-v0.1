# 420Bet Fantasy Sports — Master Visual Style Bible

**Document ID:** `BET-FANTASY-UI-STYLE-01` · **Status:** Approved artwork direction / visual contract for every Fantasy Sports website layer · 6 November 2026.

## 1. Canonical reference and scope

The **user-approved, full-width hockey watch-party artwork** is the authoritative Fantasy Sports visual reference. It depicts four excited adult hockey fans on a leather couch, a BongGoggles T-shirt on the far-left fan, a digital blue/teal `$420` cap, the green-and-white CANNABIS hockey jersey on the middle-right fan, a PuffBuddies toque on the right-hand woman, a neon 420Bet dice logo and `Fantasy Sports` sign, a hockey game on the television, a bong, snacks, a sunglasses-wearing cat, plant decor and purple/emerald light. **No third arm touching the far-left fan's cap.** Do not repaint or swap the approved image for generic stock sports photography.

- Source upload: `Neon 420Bet Hockey Lounge(1).png` (1672 × 941, 16:9).
- Deployment artwork: `clients/420bet-lobby/public/assets/420bet/fantasy/fantasy-hockey-lounge.avif` (optimized derivative of the approved source). Keep the original as the master.
- Entry URL: `/#game=fantasy`. All fantasy destinations use `/#game=fantasy&tab=<slug>`. No separate HTML page, remounted game iframe, new casino engine, or speculative paid contest endpoints.
- Owner: 420Bet Fantasy Sports UI. Code: `clients/420bet-lobby/src/fantasy-sports-ui.js` and `src/fantasy-sports.css`.
- Separation: image is **background only**. Clickable controls are HTML above it; none of the image's branded signs, TV, faces, hands or merchandise are to be re-rendered as fake clickable hotspots.

## 2. Nonnegotiable landing-page composition

1. The background covers **the entire viewport including the top edge** with `background-size:cover` and centre-oriented crop. The approved image supplies all large `420Bet` and `Fantasy Sports` branding. **Never add a title block, website header/logo strip, card frame, introduction text, statistics panel, or additional hero artwork** on this landing screen.
2. A small, dark translucent `← Game Lobby` escape control sits top-left without obscuring branded art. Do not duplicate the site's old 60 px gamebar or footer.
3. The **only primary controls on the landing image** are five large neon violet panels stacked at the **right-hand edge, mid/lower right**, inspired by the earlier Couch League mockup: Create a League, Join a League, Live Drafts, My Teams, Leaderboards.
4. Right-hand buttons are actual accessible `<button>` elements, not baked image text. Each opens a separate URL-addressable sublayer; the browser back/forward stack works. The menu lives in its own stacking context above the image.
5. Do not place controls over the faces, BongGoggles shirt, cannabis hockey jersey, PuffBuddies toque, tabletop bong or the large neon 420Bet sign. Avoid obscuring the hockey screen where viewport permits.

## 3. Token palette and finish

| Token | Hex | Use |
| --- | --- | --- |
| `--fs-night` | `#0E0717` | Deep cinema-violet fallback |
| `--fs-ink` | `#110C19` | Translucent high-contrast surfaces |
| `--fs-purple` | `#E63BFF` | Neon border and exterior glow |
| `--fs-leaf` | `#8FFF55` | Emerald cannabis energy, focus accents |
| `--fs-gold` | `#FFCD57` | Button icons and gold micro-highlights |
| `--fs-cream` | `#FFF6DC` | Navigation text |
| `--fs-plum` | `#35114C` | Inner purple panel gradient |

Buttons: dark translucent plum inner gradient, 2 px intense violet outline, controlled outer violet glow, rounded 15 px corners, gold/cream icon, cream bold text, right-facing small chevron. Avoid flat cartoon SVG buttons, conventional blue UI, brightly filled rectangles and rounded-glass fintech dashboards. Hover: small 5 px lateral move and increased glow, without animations under reduced-motion preference.

## 4. Typography

- The **image itself** owns the sign/wordmark. Do not typeset another `Fantasy Sports` hero heading over it.
- Navigation: system UI / Segoe UI, 800–850 weight, 15–20 px responsive, concise title case.
- Layer heading only (not landing page): italic heavy Georgia display, 35–67 px with warm gold fill and understated plum shadow.
- Layer body: comfortable 14–17 px, line height 1.65, near-white on dark panel.
- Fine print and `TESTNET` labels: 10–12 px, no invented fixture/league data, all human-readable.

## 5. Responsive composition and accessibility

- Desktop reference: **1672×941**. Full-screen and no page scroll at standard laptop/desktop heights; navigation width ~252–355 px at right and five rows high.
- Smaller laptops: reduce gaps and control heights first; preserve the artwork crop and navigation legibility.
- At 670 px or narrower: mobile wallpaper favours the left/central fans, but may crop the television; controls become a **two-column bottom grid**, with final button spanning the row. Ensure no horizontal scrolling and at least ~44 px touch targets.
- Image is intentionally decorative (`aria-hidden`); expose a single accessible `Fantasy Sports sections` nav. Accessible labels match visible buttons.
- Keyboard focus outline bright gold; Escape and back navigation should not strand the user. Respect `prefers-reduced-motion`.
- Use a dark gradient beneath text to meet contrast without washing out the approved wallpaper.

## 6. Five section identities and URL contract

| Tab slug | Button label | Future layer |
| --- | --- | --- |
| `create-league` | Create a League | League commissioner setup, format, scoring, season |
| `join-league` | Join a League | Verified league discovery, invitations and admission |
| `live-drafts` | Live Drafts | Authoritative timer, picks, order, real draft room |
| `my-teams` | My Teams | Authenticated rosters, league status and lineup choices |
| `leaderboards` | Leaderboards | Verified league scoring, standings and finals |

Sublayers must reuse the **same wallpaper** and neon green/violet/gold language. Unlike the home view, a sublayer may add a single restrained, translucent dark reading panel with its own heading, controls and **`← Fantasy Sports`** return link. Preserve continuity: no different visual theme for each layer unless an explicit user-approved asset contract says otherwise.

## 7. Data and authorization rules

- The Fantasy landing and sublayers initially **only navigate**; they do not create leagues, enroll users, start real drafts or transfer money.
- Until official testnet and fantasy admission/scoring/crypto contracts are qualified, future pages may show clearly marked **Awaiting authoritative testnet integration**, not fictitious active contests, prizes, players or standings.
- Existing Fantasy NHL contract, oracle, cutoffs, custody and privacy rules in `docs/bet/BET-FANTASY-*` remain authoritative. This document cannot alter gameplay or payout calculations.
- Live routes must be authenticated, subject-scoped and fail closed on missing proof, data feed or signer. Never expose hidden draft/lineup contents before authorized reveal.
- Preserve the testnet roadmap as source of testnet prerequisites. All controls that will move money remain disabled and out of scope until qualification.

## 8. Acceptance checklist

- Correct approved image rendered edge to edge, not a stretched/scaled-up screenshot containing duplicated buttons.
- No extra title, site bar, lobby footer or duplicate 420Bet logo on the landing.
- Exactly five visible, working right-hand links; each has a distinct stable deep link.
- Back to landing, return to game lobby, browser back/forward and refresh each preserve route.
- Laptop, 16:9 desktop, tablet and small-screen layouts show all five actions without obstruction.
- Original faces, clothing brands, couch, cat, bong and TV remain intact.
- No invented fantasy contest activity, transactions, registration, wallet sign-in or payout state.
- Run only affected Fantasy UI Level 1 DOM/route tests and lobby build; do not rerun unrelated casino suites merely for style changes.

**Change control:** Future work must cite `BET-FANTASY-UI-STYLE-01` and distinguish (a) wallpaper/source-approved design edits from (b) sublayer interaction/data-model changes. Do not silently substitute different artwork.
