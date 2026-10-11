# DOOBR R03.1 — Official brand, accessibility, design system and site shell

**Canonical:** R03.1 Brand, accessibility, design system and site shell for doobr.420integrated.org (domain proposed, not deployed).

## Repository implementation

`web/doobr/` contains a static information-only site shell, accessible skip link, semantic header/nav/main/footer, keyboard-visible focus, reduced-motion support, responsive layout, color tokens, accessible image text and prominent fail-closed non-operational service notices. No checkout, consumer order submission, payment, contact-data form, location access, courier tracking, advertising, 420Travel authority transfer or regulatory eligibility claim. Deployment is **not authorized**.

The repository's canonical approved exact artwork is `doobr-official-logo.png`: PNG 1494×1052 RGB SHA256 `098c8fd41099af18c0ccbf8102bec35c135d307bfcc720c13151e7a920af98d7`. The exact artifact was located in the owner's ChatGPT file library and verified bit-for-bit against the canonical checksum. Responsive derivative PNGs `doobr-logo-480.png` and `doobr-icon-64.png` were generated from that approved original (not substituted artwork).

**Blocking integration:** Binary PNG bytes could not be written through the available GitHub text-only repository file tool. The approved files have been packaged as `doobr-r03-1-approved-assets.zip` and must be uploaded intact to `web/doobr/assets/` on the same audit branch. Do not interpret this note or original artwork availability outside GitHub as completion of the mandatory version-controlled asset. CI deliberately rejects a missing or modified logo; do not weaken that guard.

The build is `npm run check` then `npm run build` from `web/doobr`. No third-party dependencies or production API credentials required. Publish static `dist/` only after all required Level 1, infrastructure, security and legal approval gates; this work does not deploy the proposed domain.

## Qualification / limitations

`.github/workflows/doobr-r03-1-level1.yml` runs an exact-SHA check, verifies checksum, PNG geometry, derivative presence, safe static design, accessibility source markers and non-transactional HTML, builds static output, and checks SHA again. **Status: BLOCKED until the official approved binary assets are committed and successful exact-SHA CI evidence is recorded.** Actual browser axe/WCAG screen reader and cross-device rendering acceptance remains R03.11 and R03.12; source assertions are not a substitute for user testing.

Last verified main `1c509a0f054bcf9fa191f71db29d0dc87f54c528`; PR #601 on `roadmap/doobr-bc-vancouver-infrastructure`. R02.13 backend Level 2 passed implementation SHA `a6cc8cf041dc4c016000d6d76983b33d3ba683ca` in run #38104989365. Level 3 and main reconciliation reserved for R05.10.

**Next canonical step:** R03.2 Public coverage lookup, legal availability disclaimers, strict age-appropriate discovery and support. Do not advance until R03.1 Level 1 passes.
