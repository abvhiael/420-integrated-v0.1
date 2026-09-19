# Bong Goggles BG-19.12 — frontend security and privacy hardening

## Implemented on BG-19 branch

- The shared design system now rejects unsafe external handoff URLs: only absolute HTTPS URLs without credentials, control characters or backslashes are eligible for rendered links. HTML escaping is not treated as URL validation. Untrusted raw `attrs` are ignored rather than interpolated into an anchor. External handoffs use `noopener noreferrer`.
- Client telemetry redacts **all free-form string values**, including nested strings, URLs and error messages, regardless of the field name; recursively redacts sensitive field names; caps collection size and depth; and constrains event names to a short static identifier. This intentionally sacrifices debugging detail in favor of avoiding private message, Wallet/session and query-token disclosure.
- `bong-goggles/web/test/security-hardening.test.js` exercises malicious URL schemes and injected attributes, nested secrets and string leakage, event-label injection, collection bounds and circular values.

## Explicit remaining release blockers — do not mark BG-19.12 production-secure yet

1. Audit and harden `buildWalletHandoffUrl` return-URL origin, query/fragment and credential handling, including redirect/replay tests; do not pass arbitrary current URLs with sensitive query parameters to external Wallet services.
2. Audit every HTML-rendering caller that passes dynamic `card.body`, `footer`, `emptyState.action`, media URLs or interpolated attributes, including profile/feed/community/discovery/games/operations/settings and private Messenger surfaces. HTML escaping by one shared helper alone is not a complete XSS audit.
3. Review exact configured service origins, CSP deployment **HTTP headers** (including `frame-ancestors`), Trusted Types applicability, COOP/referrer policy and production hosting redirects. A CSP meta tag does not implement `frame-ancestors`.
4. Enforce CSRF/auth/session assumptions at qualified service boundaries; verify Wallet transaction targets, ABI, chain and signer at the actual dispatch point, not only in presentation-intent objects.
5. Qualify signed media delivery URLs against approved origins and expiry; verify no token, private content, sensitive Messenger payload or secret enters client logs, telemetry, URLs, notification bodies, source maps or build output.
6. Perform dependency lockfile and supply-chain scanning, browser security testing, deployment header inspection, route/deep-link fuzzing, malicious projection testing and actual end-to-end signed-transaction rejection tests.

Passing web/unit/qualification workflows validates the committed change set; it does not establish the unresolved release blockers above. BG-19.14 and BG-19.15 must not infer production security from presentation-only CI.
