# ARC-1.2 — Navigation, application shell and responsive interface

**Implemented:** React client-side hash navigation with canonical route parsing for the game catalog, individual game detail placeholders, About and Accessibility, plus a fail-closed unknown-route recovery. Stable `#/games` links work under static subpath deployment without server-side route rewrites.

The shell has one page-level heading per view, labeled primary navigation, active-page semantics, keyboard focus transfer on route changes, a skip link, 44-pixel navigation hit targets, a responsive wrapping header/cards/footer, 320px layout support, reduced-motion styling, and a live status notice. No uncontrolled wallet/registration, verified score or paid-game behavior is added. Game cards and detail views explicitly remain nonplayable.

**Acceptance:** `apps/arcade-web/test/navigation.test.mjs` tests route allowlists, traversal/malformed input rejection, page headings, keyboard navigation semantics, responsiveness policies, and all eleven disabled games. Existing ARC-1.1 checks and build/typecheck/lint remain active in the ARC-1.2 scoped workflow. Device/browser assistive-technology acceptance is not claimed here.

**Qualified architecture sources:** ARC-0.4 identity manifest, ARC-0.5 platform policy, ARC-0.6 module boundaries and ARC-0.7 scope freeze are unchanged. No testnet action, contract or SDK power is required at this navigation step.
