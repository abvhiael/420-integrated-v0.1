---
title: APPSTORE-9 Genesis frontend
status: qualified implementation
---
# APPSTORE-9 — Genesis frontend

APPSTORE-9 adds the dependency-free Genesis user interface for 420AppStore. The frontend is an embedded static web package under `appstore/web` and consumes only the read-only APPSTORE-7 `/v1/apps*` discovery API.

## Required views

The Genesis shell provides browse, category discovery, search, application detail, canonical contract/version provenance, requested permissions and capability scopes, security evidence and warnings, sponsorship/featured labels, direct Registry/Explorer/Verify/application links, and Open in 420Wallet handoff context.

## Authority boundary

The frontend is presentation-only. It does not sign transactions, hold keys, grant capabilities, approve token spending, mutate Registry state, create application legitimacy, or bypass Wallet/Smart Account confirmation. Canonical Registry/chain fields remain visibly separate from noncanonical catalogue presentation metadata.

## Failure behavior

Catalogue/API failure renders a degraded-state message rather than fabricating application state. The UI explicitly preserves the invariant that direct Registry, Explorer, Wallet and application interaction remain independent of AppStore availability.

## Browser hardening

The embedded handler is GET/HEAD-only and emits `X-Content-Type-Options`, `Referrer-Policy`, a restrictive `Permissions-Policy`, and a Content Security Policy that prevents framing, objects, foreign scripts and cross-origin API connections. The responsive shell remains usable at narrow widths and uses semantic navigation, forms, headings and live status regions.

## Qualification expectations

APPSTORE-9 tests verify that the Genesis shell and static assets are embedded, the frontend remains read-only, security headers are present, and required API/view concepts including Registry, Explorer, Verify, permissions/security context and Open in 420Wallet are represented.
