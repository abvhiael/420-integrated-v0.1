---
title: APPSTORE-8 Privacy, Abuse Resistance and Failure Recovery
audience: [developer, operator, security]
category: application
status: development
version: current
---
# APPSTORE-8 — privacy, abuse resistance and failure recovery

APPSTORE-8 hardens the Genesis catalogue without turning 420AppStore into a surveillance, identity or execution authority.

## Privacy boundary

The catalogue rejects private Identity fields, raw or encrypted Messenger/Commons/Resource payloads, raw Attention telemetry, installation history, launch history, private keys, seed phrases and mnemonic material from presentation metadata. Public discovery/ranking may operate on curated public fields, but launch and installation history are not exposed as public catalogue state.

## Metadata and media limits

Genesis limits bound descriptions, presentation maps, presentation values, screenshot counts and URL length. Oversized or malformed metadata fails closed rather than being truncated into ambiguous state. Screenshot and public provenance links must use public HTTPS URLs; credential-bearing URLs, loopback targets, `.local` hosts and insecure HTTP links are rejected.

## API boundary enforcement

`appstore/api.New` applies the APPSTORE-8 hardening policy before a view becomes discoverable. A listing with private presentation fields or hostile public links is rejected as an invalid view. This complements APPSTORE-4 canonical-field protections and APPSTORE-6 Wallet authority protections.

## Abuse resistance

The package provides a fixed-window public-request limiter. Production applies it only to `/v1/apps*` and keys it from the request transport address in memory; it does not require Wallet/account identity and does not persist launch/install history. Health/readiness and the static frontend are not rate-limited by this control.

## Dependency and degraded-mode behavior

Registry and RPC are required to claim current canonical service identity and implementation state. If either is unavailable, AppStore enters `BLOCKED` canonical mode and must not present stale catalogue fields as current canonical facts. A persisted catalogue may still support clearly degraded browse behavior where appropriate.

The production public service evaluates these dependency rules on every readiness/API request. Registry/RPC loss produces `BLOCKED` canonical mode and `/v1/apps*` returns 503 rather than stale canonical claims. Optional Verify loss produces `DEGRADED` mode: browse/search remain available, but `VERIFICATION` evidence is removed from the served view until Verify is ready again. The in-process browse/search surface is treated as available while the process is healthy. Store loss prevents browse eligibility but never changes Registry or chain state.

## Qualification expectations

APPSTORE-8 tests prove that:

- private/encrypted/raw telemetry and launch/install-history fields are rejected;
- oversized descriptions, presentation values and screenshot collections fail closed;
- hostile schemes, local-network targets and credential-bearing URLs are rejected;
- public HTTPS links remain accepted;
- Registry/RPC outages block canonical claims;
- optional Search/Verify outages degrade rather than fabricate results;
- rate limiting does not require wallet or account identity.

These controls preserve APP-INV-010 through APP-INV-013: private data stays outside the public catalogue, AppStore does not become an execution/custody authority, AppStore failure cannot revoke direct chain/application access, and alternative catalogue clients remain possible.
