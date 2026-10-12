# DOOBr R03.11 — Browser, device, accessibility and denial journeys

**Canonical:** R03.11 Playwright, device, mobile, screen reader and keyboard journeys, all denial branches.
**PR:** #601, branch `roadmap/doobr-bc-vancouver-infrastructure`.
**Inspected main:** `fe21ef07359d6915bf5daac37c4bf24a24fcf19b`, branch 636 behind / 321 ahead at initial inspection.
**Qualification:** Level 1 scoped browser and app-web; R03.12 remains the clients/Travel Level 2 boundary, R05.10 remains once-only Level 3.
**Implementation SHA:** `49dc991fb367845b434d91053b5f4499fe0359d4`.
**CI:** `DOOBR R03.11 Browser And Device Emulation Level 1`, run #38291001808, queued at evidence authoring (do not assume PASS).
**Scope:** `playwright.doobr.config.mjs`, `tests/browser/doobr-r03-11.spec.mjs`, `.github/workflows/doobr-r03-11-level1.yml`, deferred-acceptance roadmap.

The deterministic, pinned Playwright Chromium suite starts a loopback-only web server. It tests desktop keyboard focus, skip navigation, public coverage UNKNOWN/UNAVAILABLE status, denial of checkout/payment affordances, absence of private PII input fields, mobile Pixel-sized viewport and overflow, 420Travel coarse UNKNOWN card, trusted external deep-link destination, disabled checkout, and no private/payment/API fetches during static public journeys. The workflow verifies exact implementation SHA before and after and executes the retained DOOBr public shell source integrity and build.

**Unresolved coverage:** Not a full physical iOS/Android acceptance suite, manual assistive technology acceptance, external authenticator or authenticated multi-user/backend staging. Real device, TalkBack/VoiceOver/NVDA, live issuer and private-client rejection journeys are separately recorded under R03.11 in `docs/audit/DOOBR-TESTNET-DEFERRED-QUALIFICATION-ROADMAP.md`, not counted as passing evidence. Additional offline scripted emulator/unit coverage remains in R03.8/9. CI failure must be diagnosed from the exact job/step and corrected at the code/test level; queued and cancelled never pass. No actual browser/physical-device execution is claimed before CI succeeds.

**Exit state:** targeted Level 1 awaiting CI; external acceptance explicitly deferred; R03.11 not formally COMPLETE until required locally runnable checks pass.
**Next canonical:** R03.12 Clients and travel Level 2 milestone.
