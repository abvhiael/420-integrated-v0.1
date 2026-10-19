# ARC-0.5 — Browser, desktop, mobile, accessibility and offline-support requirements

**Step disposition:** requirements definition; NOT a claim of delivered app/game runtime or certified browser compatibility.

## Scope and authoritative boundaries

This is the original ARC-0.5 step title provided by the repository owner: **Define browser, desktop, mobile, accessibility and offline-support requirements**. The inspected `docs/arcade` inventory has no separate canonical ARC roadmap checklist; this requirements freeze applies ARC-0.2 ADR-ARC-002/003/004/008/009/010 and the eleven frozen game IDs of ARC-0.4 without renumbering or advancing the implementation phases.

The machine-readable policy is `config/arcade-platform-requirements.json`. Validation only defines measurable acceptance criteria for later implementations. No Phaser, React, service worker, native app, wallet, cloud sync, artwork or production deployment is introduced at ARC-0.5.

## Browser and desktop acceptance

- Support the current and immediately prior major releases of Chromium, Firefox and Safari on desktop and iOS Safari/Android Chrome on mobile at release qualification time. Browser-specific feature detection and explicit unsupported-browser messaging are mandatory; no untested compatibility claim.
- Responsive launcher and game surfaces down to 320 × 568 CSS pixels; desktop keyboard and pointer parity, 200% zoom without losing core actions, visible focus and no unavoidable horizontal scrolling for navigation. Games may retain accessible gameplay viewports with alternative controls.
- Games are lazily loaded, use constrained asset budgets, integrity-checked approved assets, abort pending loads on unmount, and cannot crash or starve the launcher or another game's state. Unsupported APIs fall back or produce a nonblocking explanation.

## Mobile and touch acceptance

- iOS Safari and Android Chrome current/prior versions, pointer/touch plus connected keyboard where supported, safe orientation recovery, no hover-only actions, touch targets at least 44 × 44 CSS pixels or an equivalent accessible target spacing pattern.
- Pause/resume on background/foreground, interruptions, lost audio context, reduced-motion and resized viewports without duplicated sessions or corrupt progress. UI remains usable with software keyboards and platform screen readers.

## Accessibility acceptance

- WCAG 2.2 Level AA target for the delivered interface; minimum text contrast 4.5:1 and large-text contrast 3:1; visible focus, complete keyboard control and remappable or equivalent controls, labels/instructions for screen readers and non-colour-only indicators.
- Reduced motion, pause/restart, audio-free equivalents, scalable text, high-contrast settings and non-punitive time limits. Canvas/Phaser games require alternative accessible controls or meaningful equivalent presentation where direct graphical play is otherwise inaccessible.
- Colouring exports/private drawings require explicit publication consent. Companion simulation remains private, bounded, tolerant of absences and does not demand continuous connectivity.
- Compliance must be demonstrated in later app/individual-game integration using real browser and assistive technology tests, not this policy verifier.

## Offline and storage acceptance

- Every game defines guest core-play offline readiness and local guest saves. Once its approved game bundle/assets have been installed, network/RPC/indexer failure cannot interrupt ordinary guest core progression; first-ever download cannot be claimed available without connectivity.
- Version-pinned integrity-validated immutable assets, per-game LRU eviction within a documented 100 MiB aggregate cache budget, deterministic state migrations and explicit recovery when space is exhausted or data corrupt. Private drawings and companion data are never stored in service-worker caches or silently uploaded.
- Service workers install only in secure contexts under user-authorized installation policy; no remote executable scripting authority. Optional cloud sync, wallet, live leaderboard, entitlements and economic claims must fail closed offline while local play continues.
- Browser-generated results remain local/unverified offline. Service workers and game content cannot invent canonical Gaming Protocol or score authority.

## Eleven-game-specific requirements

All eleven identities are included exactly once in the policy. All must support desktop/mobile browser access, offline core guest play after asset acquisition and per-game accessible controls. Specific controls: 420Colouring Book private consent and bounded exports; 420Buddy nonpunitive bounded-clock behavior; Where's Dave? zoom/pan alternatives. All eleven individual implementations, runtime tests, actual browser certification and live deployment are subsequent roadmap milestones.

## Requirements-to-evidence gap analysis

| Requirement | ARC-0.5 evidence | Later implementation evidence |
|---|---|---|
| Browser/version matrix and minimum viewports | Frozen platform manifest + deterministic negative verifier | Browser automation and responsive screenshots |
| Desktop/mobile input parity and interruptions | Frozen interaction requirements | Keyboard/touch/orientation/background regression |
| WCAG 2.2 AA and alternatives | Frozen criteria + verifier | A11y automation and manual assistive-tech qualification |
| Guest offline and safe cache/storage | Frozen offline contracts + verifier | Service worker/browser offline replay, migrations, quotas |
| Game-specific coverage | Canonical ARC-0.4 identity cross-check | Eleven per-game acceptance suites |
| Wallet/Registry independence | Manifest and no-authority checks | Real disconnected/revoked/fault behavior |
| Production/device support | NOT demonstrated | Approved browser/device matrix and ARC-TN release gates |

## Qualification contract

One Arcade-owned Level 1 node verifier and negative fixtures only. The identity roster and the original ARC-0.4 implementation/certificate must not change. No Level 2 milestone is invoked and no global Level 3 checks belong to this definition step.

**Exit criteria:** documented platform/version policy; desktop/mobile behavior and viewport thresholds; WCAG and per-game accessible-input guarantees; offline asset/save/failure policy; all eleven identities bound to same canonical list; negative tests to reject missing games, downgraded requirements, wallet-dependent/offline reward claims and loosened integrity/consent; actual scoped CI success against the exact implementation SHA.

**External work:** live browser/device compatibility and deployed offline evidence cannot be marked passed before running actual app/device tests. Release/security approvals and canonical protocol authority remain later gates.
