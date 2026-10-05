---
title: APPSTORE-7 discovery API and application views
audience: [developer, operator, auditor]
category: application
status: development
version: current
---
# APPSTORE-7 — discovery API and application views

APPSTORE-7 exposes the first public discovery/view-model surface for 420AppStore while keeping canonical Registry data structurally distinct from catalogue presentation metadata.

## Endpoints

- `GET /v1/apps` — ranked browse response with pagination and optional `category`, `active`, `featured` and `sponsored` filters.
- `GET /v1/apps/search?q=...` — noncanonical discovery search over service identity, description and categories with the same filters and pagination.
- `GET /v1/apps/categories` — deterministic category list derived from catalogue metadata.
- `GET /v1/apps/{serviceID}` — application detail view containing Registry-derived canonical identity/version/implementation fields, catalogue curation, security evidence/warnings, Wallet handoff context and direct provenance links.

## Canonical boundary

Browse/search ordering, category membership, featured placement, sponsorship, ratings and descriptions remain catalogue presentation data. Responses carry an explicit discovery disclaimer. The `canonical` portion of the listing continues to originate from the APPSTORE-2 Registry projection and is never regenerated from search or editorial metadata.

The API rejects application views whose security evidence refers to a different service/version than the canonical listing. This prevents cross-app provenance from being silently attached to a result.

## Runtime composition

`appstore/api/composition.go` is the production composition boundary used before the public handler is mounted in APPSTORE-AUDIT-5.

- the finalized APPSTORE-3 catalogue supplies service identity, latest version, implementation and all Registry provenance;
- optional operator input supplies only curation metadata, sourced security evidence, Wallet request metadata and Registry/Explorer/Verify/direct links;
- operator JSON is decoded with unknown-field rejection so hidden authority-bearing Wallet fields cannot be ignored;
- unknown or duplicate service IDs fail closed rather than manufacturing catalogue legitimacy;
- curation service-ID mismatches and canonical-field override attempts fail closed;
- security evidence is rebound to the canonical service/latest version and still passes APPSTORE-5 claim/provenance validation;
- Wallet chain ID and service ID are constructed from the canonical runtime/catalogue rather than accepted from operator input;
- Wallet/direct URL disagreement, unsafe/private URLs, private launch/install fields and confirmation-bypass requests fail closed;
- the retained view set swaps atomically only after the entire replacement composition validates.

## Direct interaction and outage boundary

Detail responses preserve links to Registry, Explorer, Verify and the application's direct URL, plus the APPSTORE-6 Wallet handoff presentation. AppStore therefore remains a discovery layer: an AppStore outage or delisting does not create a protocol-level block on direct Registry, Explorer, Wallet, RPC or application interaction.

## Query behavior

Results use deterministic APPSTORE-4 ranking. Pagination defaults to 20 items and caps client-requested limits at 100. Category matching is case-insensitive. Search is intentionally a noncanonical convenience layer and does not alter Registry legitimacy or active/deprecated state.
