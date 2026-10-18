# LIFTd — Milestone C repository-local exit

**Requested outcome:** all locally reproducible security, permission, integration and accessibility defects resolved; independent device and accessibility acceptance external.

**Important canonical distinction:** the locked `LIFTD-ROADMAP.md` contains no milestone named C; official M-L03-B still requires externally accepted official-testnet and operational evidence. This is **a supplemental local Milestone C evaluation**, not a renumbered canonical milestone or live authorization.

## Consolidated requirement / evidence matrix
| Category | Current implementation and controls | Required local Level 2 review |
|---|---|---|
| Identity, session, account takeover and revocation | PT-09 consent guard reauthorizes post-I/O session including action, exact resource, device and recovery epoch; retained Identity tests | Retained app security and adversarial tests |
| Driver, vehicle, permission / scope | Signed Registry/transport eligibility, role and trip scoping, separate authorities, PT-07 pilot default disabled | Retained eligibility, dispatch, cross-trip and negative tests |
| Financial security and races | Payment ID, direct settlement binding, replay/idempotency, database fencing and recovery queues | Retained payment/dispatch/worker tests plus scoped real PostgreSQL worker suite |
| Privacy, safety and recovery | PT-06 retention and erasure, PT-08 recovery and protected holds, PT-09 compromised-provider, incident/operator controls | App regressions and PostgreSQL privacy retention |
| Accessible rider/driver/operator | PT-10 improved keyboard focus, form errors, mobile layout; Chromium/axe authenticated role checks | Retained web regression and focused accessibility/device tests; preserve already qualified real-browser PT-10 evidence at its original SHA |
| Release constraints | Unauthenticated/public traffic disabled; testnet/production permissions remain gated | No live enablement or acceptance claimed |

**Test inventory ownership:** this milestone workflow executes app and web tests plus retained PostgreSQL privacy and recovery tests. The independent real Chromium/axe PT-10 browser qualification remains preserved at its original qualified SHA (run #39096822726); no browser inputs are changed by this milestone and duplicating the full Chromium installation provides no additional evidence.

**External status:** Independent Windows screen-reader and iOS/Android assistive-technology testing, real provider failures, official-testnet payments/finality/issuer authority, independent operations/security and production pilot remain **NOT ACCEPTED** under existing `LIFTD-TESTNET-ROADMAP.md` tracks TN-0–TN-6 and LIFTd-TN-A11Y. Local PASS is not an independent security or WCAG certificate.

**Canonical next step:** follow existing L03.9 → L03.10 → M-L03-B → L03.11 → L03.12 without changing their exit meanings. Level 3 must not be run.
