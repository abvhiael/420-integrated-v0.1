# LIFTd PT-10 — Client and accessibility Level 1 qualification

**Repository-side status: LEVEL 1 PASS.** Independent WCAG/manual accessibility and real service operational acceptance **NOT ACCEPTED**.

- **Definition:** Review rider/driver/operator client workflows for keyboard operation, field validation, focus, screen reader semantics, mobile responsiveness, authentication failures, permissions and safety; fix failures and run automated accessibility checks.
- **Exact qualified implementation SHA:** `bb8e76bd429ccf5886d16638015ee39ee2a00308`.
- **Base main:** `3b170bbbaa6e9291d331be78dd6c0a5e9b1b8c3b`.
- **PR:** [#725](https://github.com/abvhiael/420-integrated-v0.1/pull/725); branch `audit/liftd-pt10-client-accessibility-20261018`.
- **CI workflow:** existing retained `.github/workflows/liftd-l02-12-level1.yml` for `rideshare/web/**`, [GitHub Actions run #39096822726](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39096822726), job `117584906082`, **SUCCESS**, exact head SHA qualified.
- **Automated tests:** focused accessibility/device suite **8 PASS / 0 FAIL**, full web checks **48 PASS / 0 FAIL**, automated static accessible shell, **real headless Chromium/Playwright/axe-core** WCAG 2/2.1/2.2 A/AA inspections, keyboard focus and navigation, mobile and desktop viewport, denied/offline session states, and expanded authenticated rider, driver, operator 390px mobile axe scans **PASS**. No duplicate browser workflow created.
- **Source changes:** `rideshare/web/styles.css` focus and responsive input/touch targets; `rideshare/web/driver-onboarding.mjs` safe bounded identifiers/expiry, accessible invalid field focus; `rideshare/web/operator-console.mjs` safe bounded ID validation and focus for denied trip/incident; `rideshare/web/test/pt10-accessibility.test.mjs` regression tests; `rideshare/web/e2e/accessibility-device.mjs` authenticated role browser scans; `docs/rideshare/PT-10-CLIENT-ACCESSIBILITY.md` audit matrix.
- **Triaged test infrastructure failures (not successful qualification):** superseded run #39096485453 used deep-link URLs unsupported by local static server; superseded run #39096620668 did not expand mobile nav menu, leaving role links invisible. Both corrected in browser test, no runtime authority was weakened. Prior green run #39096297907 passed original screen checks but was superseded when authenticated-role coverage was added.
- **Safety:** existing service-preview and public dispatch/payment disabling remain; browser tests use simulated signed-in UI only and do **not** validate live remote authentication or independent operational permissions.
- **Independent acceptance:** hardware screen-reader/assistive-technology manual audits, actual external authority denial screens, production cross-browser devices, deployed safety workflow and independent accessibility approval remain **NOT ACCEPTED** under existing L03.8–L03.11 and TN-0–TN-6.
- **Level 2:** not invoked; **Level 3:** not invoked. No unrelated Solidity, Genesis, Integrated, Geth, Docs global qualification initiated.
- **Merge:** PR remains open pending current-main merge review, evidence-only commit and user authorization. Next canonical LIFTd milestones unchanged.

This is a non-executable evidence certificate; no implementation or CI inputs change.
