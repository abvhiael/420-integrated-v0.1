# GEN-SVC-3 / 420Travel — remaining Genesis implementation roadmap

Updated: 2026-09-20. Working branch: `feature/gen-svc-3-travel-implementation`, PR #356. Baseline implementation commit: `934311336fa197a6d92bd0f5aee7b98371517daf`. At that baseline dedicated GEN-SVC-3 Travel run #93 and repository-wide Qualification #5108 completed successfully. **Passing CI is not a live deployment or production acceptance. PR remains open.**

## Current implemented foundation (do not rebuild)

- Public `/travel`, `/travel/events`, fresh public place pages and a map/list `/travel/map` mounted in the development server. Map draws only explicitly published exact-public pins; approximate areas remain list-only. Public Location/Events feed must be configured; no sample records masquerade as live data.
- Opt-in `HandlerWithQualifiedJourneys` composes authenticated trip creation/listing/editing, owner-facing editor links and unlisted share/revoke controls, authenticated business-claim submission, and read-only Reputation-verified reviews when *each* corresponding trusted adapter is supplied. Default `cmd/420travel` does **not** configure Identity, private persistence, claim verification or review service.
- Existing development adapters: Identity session boundary; owner-scoped local and SQL Trips; hashed, expiring share grants; SQL claim-review/audit foundation; public Location/Events readers; Reputation service review adapter. These are **not proof of live production wiring**, multi-instance correctness or external revocation acceptance.
- Trip and share route tests, privacy tests, Go vet and build pass dedicated CI at baseline. Repo-wide qualification is a separate CI workflow. See `GEN-SVC-3.11.10-RELEASE-GATES.md` for acceptance evidence requirements.

## GEN-SVC-3.11.10.1 — finish real user journeys [BUILD]

- Add one-click `Save to trip` actions from a *currently public* place and event page, with authenticated session, owner-scoped trip picker, CSRF, body limits, deduplication and optimistic-concurrency protection. Server must re-fetch current authoritative public references before saving; an invalid or withdrawn place/event cannot be added by client-supplied IDs. Keep editing by ID as an explicit manual fallback until qualified.
- Complete trip detail/edit presentation: add/remove places/events with live public titles, reorder/empty states, visibility explanation, owner-only edit/delete, accessible validation/error and stale-version conflict handling. Never expose owner IDs or private trip IDs on unauthenticated routes.
- Finish unlisted sharing UX: authenticated single-display of newly minted bearer URL, copy/share instructions, revoke-all and regeneration, expiry text, and clear private/public/unlisted semantics. Do not place tokens in referrers, analytics, logs or caches; never advertise sharing when DB grant store or current publication verifier is absent. Implement separately authorized PUBLIC trip projection/listing only after privacy and publication policy review.
- Make claim submission/status discoverable from public place pages for logged-in users only when Identity and provenance-backed ClaimRepository are ready. Provide accessible own-claim status and reviewer workflow behind independent reviewer authorization. A claim approval alone must never grant place editing authority.
- Show public review links only when the trusted Reputation reader and live evidence checks are ready. Reviews must remain read-only through Travel unless a separately qualified Reputation submission flow exists.
- Acceptance: route/browser tests for each action, keyboard and narrow-viewport review, no-JS list fallback, cross-owner and anonymous denials, upstream-failure fail-closed behavior. Record actual test outputs and commit.

## GEN-SVC-3.11.10.2 — wire real services and multi-instance storage [BUILD + INTEGRATE]

- Implement deployable configuration and startup readiness checks for **live** 420Identity session introspection, trusted public Location/Events, shared PostgreSQL, provenance-backed Registry/Verify/Identity claim adapter, and 420Reputation. Fail startup or leave individual dependent routes disabled if their required trust/availability checks fail. Never accept user-supplied verified flags, reviewer identity or arbitrary URLs as authority. Keep booking/DOOBR transactions disabled.
- Apply/checksum SQL migrations 001 Trips, 002 shares, 003 claims. Use least-privilege DB role, TLS, connection/statement timeouts and transaction-safe CAS. Run two independent Travel processes against one PostgreSQL database; verify cross-process create/edit/delete, visibility transitions, share issuance/revocation/expiry, and claim-review audit consistency.
- Provide a production `PublishedTripVerifier` rechecking *each* referenced place/event against current authoritative public projections for every shared/public read; handle withdrawals and partial service failures without showing stale records. If external APIs lack required revocation or snapshot guarantees, keep affected sharing/public features disabled.
- Connect real ClaimProvenance and independently authorized reviewer adapter to current Registry/Verify/Identity facts, including issuer, owner, claim conflict and revocation checks; do not equate a pending or approved claim with delegated Location edit permission.
- Connect the real Reputation service and current moderation plus interaction-evidence verifier; prove that hidden or revoked reviews disappear, and service outage does not display stale verified badges.
- Acceptance: endpoint/version inventory, nonsecret staging configuration, test results from *actual* services and multi-instance DB, documented disabled-feature matrix. Mocks alone cannot close this milestone.

## GEN-SVC-3.11.10.3 — privacy, concurrency, revocation, recovery [QUALIFY]

- Two authenticated owners and an anonymous browser: test read/create/edit/delete, claim status/review and shares across tenants; invalid IDs, cookie/audience/expiry/revocation, CSRF, Origin/Host, HTTP method and oversized form protections.
- Verify link expiry, revoke-all across two processes, visibility PRIVATE/PUBLIC/UNLISTED transitions, reference withdrawal after issuance, event/venue revocation, claim proof/authorization revocation, reviewer self-approval denial, hidden reviews and revoked interaction evidence. Prefer fail-closed on all dependency outages.
- Test simultaneous trip updates and delete/edit races against real PostgreSQL, process crashes, rolling restart, backup encryption/restore, transactional migration application and failure/retry, DB/service outage and recovery. Record observed RTO/RPO rather than guessing.
- Acceptance: timestamped negative tests and logs with secret redaction; documented durability, incident, restore and migration rehearsal results. Any unresolved privacy breach is a release blocker.

## GEN-SVC-3.11.10.4 — staging UX, security and operations [QUALIFY]

- Deploy exact immutable commit to HTTPS staging with real configured trusted services; capture hostname, service revisions, migration checksums and access-controlled evidence (no credentials in repo). Verify public and authorized user journeys on desktop and mobile browsers, keyboard-only and screen reader, zoom/reflow, form errors, contrast, navigation, focus, slow-network/offline behavior and no-JavaScript map list.
- Qualify security headers and cookie attributes, CSP, authentication/rate limits, dependency TLS, no sensitive data in cache/referrer/log/trace, health/readiness and error budgets, dashboards/alerts, security and accessibility findings, backup/restore and operator runbooks. Verify the staging binary is the tested SHA, not a mock or a local shell.
- Acceptance: reproducible deployment and browser/test evidence with dated results, security/a11y sign-off and incident ownership. Failing or unverified checks remain OPEN.

## GEN-SVC-3.12 — reconciliation and main-branch closeout [BLOCKED UNTIL ABOVE]

- Reconcile actual Genesis scope, mark completed features against source/test evidence, and explicitly defer any non-Genesis booking, DOOBR transaction, broader public sharing or other features requiring new protocol authority. Update README, release gates and PR description so they no longer describe completed work as future work.
- Reconcile PR #356 with current `main`; run dedicated Travel, repository-wide, SQL multi-instance, live dependency, privacy/recovery and deployed acceptance against the exact merge candidate. Record all commits and reports; fix failures before merge.
- Merge only when required independent release checks pass and an authorized release decision accepts any documented deferrals; then verify final `main` SHA and its checks. Passing PR CI alone does not authorize a Genesis production launch.

**Immediate next implementation:** GEN-SVC-3.11.10.1 one-click save-to-trip with current-public authorization, followed by complete trip/share UI. **Current release status:** development-stage, not production-qualified; no verified live staging acceptance at baseline.
