# RR-4 — Identity & Permissions

## Canonical definition

**RR-4 — Identity & Permissions**

> Production 420Identity/Wallet sessions, scoped author/publisher/moderator capabilities, revocation/expiry, no public reliance on `X-420-Actor`.

RR-4 is an **authority milestone** because it replaces the RR-3 development actor-injection boundary with a verified session/capability boundary. It therefore requires ordinary Level 1 qualification plus retained ReeferReview Level 2 integration qualification. Level 3 remains RR-10.

## Authority model

ReeferReview does not mint wallet sessions, invent identity credentials, or become capability authority.

A deployment-supplied trusted Wallet/420Identity session verifier is responsible for validating the bearer credential and returning already-verified claims. The ReeferReview service then independently enforces:

- non-empty session ID and subject;
- syntactically valid wallet address;
- exact ReeferReview audience `420/service/reefer-review/v1`;
- expected chain ID and network;
- expiry;
- revocation;
- current 420Identity-active subject state as asserted by the trusted verifier;
- bounded issue-time sanity;
- required action capability;
- publication ownership where author authority is used;
- viewer visibility grants where restricted audience membership is required.

The verifier boundary is intentionally abstract because live deployment composition and external dependency qualification remain later REEFER-AUDIT-7/RR-9 work. No fake on-chain session protocol, Identity420 write path, capability registry address, or production deployment is introduced here.

## Capabilities

- `reefer.author` — create drafts; edit, publish and tombstone the subject's own publication; inspect own revisions/moderation history.
- `reefer.publisher` — publisher/editorial authority across publications; includes publish/edit/tombstone and moderation access.
- `reefer.moderator` — moderation actions and moderation/revision inspection; does not create or edit author content.

Capability possession alone never changes publication ownership.

## Session lifecycle

A verified session contains:

- session ID;
- canonical subject;
- wallet;
- audience;
- chain ID;
- network;
- issued-at;
- expires-at;
- revocation state;
- current Identity-active state;
- scoped capabilities;
- optional verifier-derived visibility grants.

Requests fail closed when the session is absent, malformed, expired, revoked, wrong-audience, wrong-chain, wrong-network, or lacks the required capability.

## HTTP boundary

Protected endpoints use `Authorization: Bearer <session>`.

`X-420-Actor` is not consulted for authentication or authorization.

Protected routes:

- `POST /v1/publications` — author or publisher;
- `PUT /v1/publications/{id}` — author or publisher, then ownership/service authorization;
- `POST /v1/publications/{id}/publish` — author or publisher;
- `POST /v1/publications/{id}/tombstone` — author or publisher;
- `POST /v1/publications/{id}/moderate` — moderator or publisher;
- `GET /v1/editorial/publications` — author/publisher/moderator;
- `GET /v1/publications/{id}/revisions` — author/publisher/moderator plus service authorization;
- `GET /v1/publications/{id}/moderation` — author/publisher/moderator plus service authorization.

Public news, public publication lists and anonymous PUBLIC/UNLISTED article reads remain public. Supplying a bearer session to an otherwise public article read enables viewer-aware restricted access.

## Browser boundary

The web application requests a session from deployment-provided `window.ReeferReviewWalletSession`.

The browser:

- requests the ReeferReview audience and scoped capabilities;
- keeps the resulting bearer token **memory-only**;
- never writes it to localStorage or sessionStorage;
- sends it only in `Authorization: Bearer`;
- clears local session state on sign-out;
- fails closed when a qualified Wallet gateway is unavailable.

The global gateway is a deployment integration seam, not a browser-side authority implementation.

## Typed client

The Go client now accepts a `SessionTokenProvider`.

Protected methods retrieve the token at request time and fail before transport if no verified session token is available. The client does not mint, persist or refresh credentials and never sends `X-420-Actor`.

## Security invariants

RR-4 qualification must prove:

1. missing sessions fail closed;
2. unknown verifier tokens fail closed;
3. expired sessions fail closed;
4. revoked sessions fail closed;
5. audience mismatch fails closed;
6. chain/network mismatch fails closed;
7. malformed wallet/session claims fail closed;
8. future issue-time claims beyond tolerance fail closed;
9. moderator capability cannot create author content;
10. author capability cannot edit another author's publication;
11. author capability does not grant moderation;
12. spoofed `X-420-Actor` does not authenticate;
13. restricted visibility is not inferred merely from an active session;
14. verifier-derived visibility grants are required for follower/community/organization scopes unless publisher authority applies;
15. browser bearer credentials are memory-only;
16. typed client protected methods require the session provider;
17. retained RR-1/RR-2/RR-3 behavior still passes.

## Exit criteria

RR-4 is COMPLETE only when:

- the verified session model and verifier boundary exist;
- HTTP actor derivation comes only from verified session claims;
- author/publisher/moderator capability scopes are enforced;
- expiry/revocation/audience/chain/network validation is implemented;
- the browser no longer uses arbitrary actor input or browser persistence for the session;
- the typed client uses bearer sessions and no legacy actor header;
- exact-head Level 1 passes;
- because RR-4 is an authority milestone, retained app Level 2 passes on the same exact implementation SHA;
- durable evidence is committed.

## Next canonical step

**RR-5 — Durable Storage & Rights**
