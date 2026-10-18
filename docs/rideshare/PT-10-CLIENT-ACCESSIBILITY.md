# LIFTd PT-10 — Client and accessibility review

**Scope:** rider, driver, operator browser workflows; keyboard navigation, form validation, focus management, semantic announcements, small-screen layout, authentication/permission denial and safety. This is repository-side Level 1, not independent accessibility certification.

## Reviewed implementation
- `rideshare/web/app.mjs`, `index.html`, `route-policy.mjs`: retained skip-link, landmarks, mobile menu Escape handling, focus on navigation, live status, denied and offline session recovery. No local role override or live passenger operations.
- `rider-account.mjs`, pickup and quote controllers: retained labeled fields, consent, manual pickup fallback after geolocation permission denial, guarded service errors.
- `driver-onboarding.mjs`: added input validation for receipt/vehicle identifiers and positive safe expiry, machine-friendly number entry, `aria-invalid` on offending control, keyboard focus and status announcement. Submission remains subject to independent review.
- `driver-trip-view.mjs`: retained labeled safety/confirmation controls, disabled offline mutations and refreshed server state.
- `operator-console.mjs`: added bounded typed trip/incident references, error focus and invalid ARIA annotations before sensitive HTTP actions. Backend role and signed authorization remain mandatory.
- `styles.css`: all inputs/selects/textareas and programmatically focused elements receive visible keyboard focus; form controls have readable font, touch-target minimums, bounded mobile layout and overflow wrapping. Retains reduced-motion.
- `web/test/pt10-accessibility.test.mjs`: automated static focus, mobile, validation and semantic regression coverage.

## Qualification ownership
Existing `.github/workflows/liftd-l02-12-level1.yml` triggers on `rideshare/web/**` and already owns the **real Chromium + Playwright + axe-core** web accessibility, mobile viewport, keyboard, offline/reconnect, static shell and `npm run check --prefix rideshare/web` checks. Reuse this owner rather than install a second duplicate browser CI inventory. Confirm its run on the exact PT-10 SHA and do not treat skipped/unavailable browser jobs as PASS.

## Remaining external review
Actual assistive-technology/manual screen-reader tests on representative hardware, independent WCAG assessment, real auth/provider error states and production incident operations remain **NOT ACCEPTED** as the original L03.8–L03.11 / TN-0–TN-6 gates require. No live trips or payment capability is activated.
