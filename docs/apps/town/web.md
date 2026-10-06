# 420Town user-facing web application

TOWN-AUDIT-8 implements the repository-side 420Town browser application under `town/web`.

## Trust boundary

The browser is never Town authority.

- Community discovery comes from 420Search using the `public_town` domain and remains non-authoritative.
- Community feed/content/moderation operations use the versioned Town `/v1` API.
- Community ownership, membership, roles, subscriptions and entitlements are read from and written to canonical `TownAuthority420`.
- Authority-bearing writes are sent only through an EIP-1193 wallet after wallet, chain and contract-target validation.

The web app must not infer canonical membership, role, subscription or entitlement state from Search, cached feed data or presentation state. The repository does not define a canonical mapping from opaque Town application `ObjectID` values to the `bytes32` community key used by `TownAuthority420`; therefore existing-community authority actions require an explicit canonical `bytes32` authority key instead of hashing the application ID.

## Implemented workflows

The browser supports:

- public community discovery;
- open community/feed;
- create community;
- join community;
- leave community;
- create post;
- create thread;
- create comment/reply;
- vote up/down on posts;
- report content/users;
- moderator HIDE, LOCK, SUSPEND, RESTORE and MODERATOR_DECISION actions;
- member removal;
- moderator/admin role assignment;
- canonical membership display;
- subscription state display and activation;
- entitlement state display and grants.

## Wallet and network safety

Authority-bearing actions require all of the following:

1. an EIP-1193 wallet;
2. a valid connected account;
3. the configured expected chain ID;
4. a materialized canonical TownAuthority420 address;
5. exact transaction target pinning to that configured address;
6. syntactically valid calldata.

Wrong-network, unresolved-authority, unexpected-target and missing-wallet states fail closed before `eth_sendTransaction`.

Canonical authority reads use `eth_call` against the configured TownAuthority420 address.

## API session and idempotency

Content/moderation writes use the Town `/v1` API and include a generated `Idempotency-Key`.

An API session token, when supplied by the user/session runtime, is held only in memory. The web app does not write it to localStorage, sessionStorage or runtime configuration.

## Runtime configuration

Browser runtime config lives at:

- `town/web/runtime-config.json`
- `town/web/runtime-config.example.json`

The committed production config is intentionally safe to remain unmaterialized before deployment. It contains no privileged credentials and keeps authority transactions disabled until chain ID and TownAuthority420 address are provisioned.

Non-loopback service endpoints must use HTTPS.

## UI state and accessibility

The application explicitly models loading, empty, ready, error and transaction states.

The static shell includes:

- semantic `main` content;
- accessible form labels;
- `aria-live` status regions;
- visible keyboard focus treatment;
- responsive layout;
- reduced-motion handling.

Dynamic Search/feed content is rendered through DOM APIs rather than dynamic `innerHTML` assignment.

## Qualification

From `town/web`:

```bash
npm run qualify
```

This runs the structural browser check and all Node unit tests.

The app-specific 420Town workflow additionally runs the canonical Town web verifier, accumulated Town Go tests/vet, affected service-dependency tests and retained Town Solidity/Rewards regressions on the exact implementation SHA.

## Live limitations

Repository qualification does not claim that `town.420integrated.org`, the Town API, Search API, chain ID or TownAuthority420 deployment are live.

Those deployment bindings and live wallet/network flows remain TOWN-AUDIT-11/TOWN-AUDIT-12 responsibilities.
