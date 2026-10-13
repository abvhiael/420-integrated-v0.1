# BNB-4.9 — Accessibility and Resilient Guest/Host Experience Acceptance Matrix

Canonical owner: BNB-PHASE4-ROADMAP.md BNB-4.9. This is an app-only Level 1 implementation checklist, not a legal accessibility certification. Human assistive-technology acceptance is independent and explicitly testnet gated.

## Automated browser requirements

- Keyboard-only navigation: Tab reaches the skip link first; Enter moves to the main content landmark. All controls use native buttons, anchors, labels and focus-visible outlines, not hover-only actions.
- Session loss: Clear session scrubs in-memory authorization token and private guest/host results; focus moves to the authentication input. Controls for drafts are disabled; no previously private cached data remains.
- Dialog/form reveal: When the verified-host response textarea is revealed, move focus to it instead of leaving keyboard users on the opening button. No payment or booking authority is implied.
- Re-render focus stability: Refresh of per-property operations preserves the existing trigger focus when present and does not auto-focus unavailable content.
- Reflow: 320, 390, 768, 1366 px horizontal overflow assertions; cards and controls can wrap; no content requires a two-dimensional scroll.
- Reduced motion: Respect `prefers-reduced-motion` and avoid forced animation/transitions; status and error updates remain text.
- Live status: read-only status regions announce search, loading, errors, authorization rejection, pending payment and no-finality receipts.
- Resilience: independent provider failures must not blank unrelated authorized sections. Permission loss is disclosed as denial, not as a success or confirmation. Existing requests remain nonbinding and Pay-owned.

## Human assistive-technology scenarios (deferred independent acceptance)

1. NVDA on Windows with Firefox and Chrome: navigate landmarks and all form labels, live result counts, errors, request status, credential loss, refund/finality explanations, and focus after detail/form reveal; verify browse-mode and focus-mode operation.
2. VoiceOver on iPhone Safari and macOS Safari: swipe/rotor navigation, read main/guest/hosting regions, dynamic property cards, modal-free form flows, session signout and status changes. Check 200% and 400% zoom with external keyboard where applicable.
3. TalkBack on Android Chrome: gesture/linear navigation, content order, message status updates, repeated refreshes, failed Pay provider, and current casework status.
4. Keyboard-only desktop at 320 CSS px and large text: zoom up to 400%, no clipping or horizontal scrolling, visible focus, predictable landmark order, no lost focus on account logout or host details rerender.
5. Low-vision and cognitive walkthroughs: high contrast/forced colors, reduced motion, translated error clarity, no time-limited unsignaled action, clear difference between pending booking request, pending payment and confirmed source finality.
6. Independent users/reviewers must separately approve manual WCAG and jurisdictional compliance. CI axe-core and mocked fixture results must never be used to assert human screen-reader acceptance, authenticated production device support, or legal accessibility signoff.

## Boundaries

- The UI remains preview-only. `travel.bnb_booking=false` and payment/booking execution disabled.
- Real Identity/Wallet/Pay authorization, external providers, human accessibility, legal/privacy and operational acceptance are gated in BNB-TESTNET-WORK-ROADMAP.md.
- This checklist does not supersede the exact-SHA Level 1 CI certificate, which must document a terminal app suite success before BNB-4.9 can be marked complete.
