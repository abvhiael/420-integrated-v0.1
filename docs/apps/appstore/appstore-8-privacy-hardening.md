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

The package provides a fixed-window public-request limiter that uses an operator-selected abuse-control key rather than wallet/account identity. This is intentionally separate from launch/install history so rate limiting does not create a public behavioral ledger.

## Dependency and degraded-mode behavior

Registry and RPC are required to claim current canonical service identity and implementation state. If either is unavailable, AppStore enters `BLOCKED` canonical mode and must not present stale catalogue fields as current canonical facts. A persisted catalogue may still support clearly degraded browse behavior where appropriate.

Search, Verify and catalogue-store failures produce `DEGRADED` operation where possible. Missing optional evidence is omitted and disclosed; it is never fabricated. Verify outage means AppStore cannot claim current verification evidence. Store outage prevents cached browsing but does not change Registry or chain state.

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
