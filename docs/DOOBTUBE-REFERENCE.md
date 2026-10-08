# DoobTube — technical reference

Roadmap owner: **DOOBTUBE-10 — Documentation, deployment and operator closeout**

## 1. Architecture/component map

```text
Browser / user
   |
   +-- DoobTube web (replaceable presentation)
   |      |
   |      +-- DoobTube /v1 feed + preferences
   |      +-- 420Media API composition
   |
   +-- injected Wallet
          |
          +-- Wallet / Smart Account authority

DoobTube backend/control plane
   |
   +-- SQLite app state
   |      +-- idempotency
   |      +-- preferences
   |      +-- durable jobs
   |      +-- rebuildable feed projection
   |      +-- opaque livestream recovery state
   |
   +-- canonical dependencies
          +-- ProtocolRegistry
          +-- Wallet / Smart Accounts
          +-- 420Media
          +-- optional 420Identity
          +-- 420Rights
          +-- 420Storage / Resource
          +-- 420Search
          +-- 420Notifications

420Media owns transitive Pay + Compute composition.
```

DoobTube is not protocol authority.

## 2. Contracts

### DoobTube-owned contracts

**None in V1.**

There is no DoobTube:

- Solidity namespace;
- ABI;
- predeploy;
- frozen/reserved address;
- deployment graph;
- settlement/custody contract;
- upgradeable proxy;
- signing domain.

External protocol contracts/services remain independently authoritative.

## 3. Registry and service identities

DoobTube does **not** receive its own protocol/service Registry identity in V1.

Required canonical service identities:

| Dependency | Service ID | Disposition |
|---|---|---|
| ProtocolRegistry | `420/service/protocol-registry/v1` | direct required |
| Wallet | `420/service/wallet/v1` | direct required |
| Smart Accounts | `420/service/smart-accounts/v1` | direct required |
| 420Media | `420/service/media/v1` | direct required |
| 420Identity | `420/service/identity/v1` | direct optional |
| 420Rights | `420/service/rights/v1` | direct required |
| Storage/Resource | `420/service/resource-protocol/v1` | direct required |
| Search | `420/service/search/v1` | direct required |
| Notifications | `420/service/notifications/v1` | direct required |
| Pay | `420/service/pay/v1` | Media-transitive |
| Compute Market | `420/service/compute-market/v1` | Media-transitive |

Do not add a new DoobTube service identity without a later explicit architecture decision.

## 4. Roles and permissions

### Anonymous browser user

Allowed:

- public discovery;
- public Search;
- eligible public playback;
- creator/channel presentation.

No Wallet authority.

### Wallet user / creator

Wallet authority is required for application mutations.

DoobTube backend capabilities include:

- `doobtube.preferences`
- `doobtube.operator.rebuild`
- `doobtube.operator.metrics`

Media-specific capabilities remain Media-owned, including upload, livestream, notifications, report, appeal and moderation capabilities.

### Optional Identity

Identity supplies optional profile/controller presentation only.

Identity cannot replace Wallet signing or Smart Account execution.

### Moderator

Moderator authority is 420Media-domain scoped.

Moderator actions cannot:

- transfer ownership;
- rewrite Rights;
- move funds;
- sign Wallet actions;
- invoke protocol Arbitration automatically.

### Operator

A DoobTube operator may:

- inspect health/readiness;
- read qualified metrics;
- request projection rebuild when authorized;
- manage deployment/runtime configuration outside repository secrets;
- execute documented recovery.

Operator authority does not grant Wallet, Rights, Storage, Pay or Compute authority.

## 5. DoobTube API

Stable version: **v1**

Implemented app routes:

- `GET /v1/health`
- `GET /v1/readiness`
- `GET /v1/feed`
- `GET /v1/preferences`
- `PUT /v1/preferences`
- `POST /v1/control/rebuild`
- `GET /v1/metrics`

Common response:

```json
{"version":"v1","data":{}}
```

Error form:

```json
{"version":"v1","error":{"code":"...","message":"..."}}
```

Mutation idempotency uses:

- `Idempotency-Key`
- actor
- operation
- semantic request hash

Maximum page limit: 100.

Cursor format is opaque to clients.

## 6. 420Media API interfaces consumed by DoobTube

Current V1 composition uses Media routes including:

- compatibility/capabilities;
- asset list/detail;
- public Search;
- upload prepare;
- livestream create/status/start/stop;
- notification subscription;
- moderation report;
- moderation appeal.

Canonical exact schemas remain owned by 420Media.

DoobTube must not fork those schemas into a second authority.

## 7. Events and projections

There are no DoobTube-owned contract events.

Backend projection input is represented by `ProjectionEvent`:

- media asset ID;
- block height/hash/parent;
- finalized height;
- Media state;
- visibility;
- Rights authorization;
- title;
- creator reference;
- observed timestamp.

Feed projection is rebuildable/derived.

A projection cannot widen PRIVATE/UNLISTED visibility or override canonical Media/Rights state.

## 8. Persistence schemas

Current DoobTube SQLite schema version: **2**

Schema v1:

- `meta`
- `idempotency`
- `preferences`
- `jobs`
- `projection_blocks`
- `feed_items`

Schema v2 adds:

- `media_sessions`

The runtime refuses a database whose schema version is newer than the runtime.

Migrations are forward-only inside the application Store.

## 9. State machines

Canonical state-machine definitions remain in:

`docs/DOOBTUBE-PRODUCT-SCOPE.md`

Key state domains:

- session/authority;
- upload/publication;
- playback;
- livestream;
- subscription;
- report/moderation/appeal;
- delete.

Operationally important rule:

**transport success is never canonical READY.**

Canonical Media/Storage/Rights state wins.

## 10. Security assumptions

Canonical threat review:

`docs/DOOBTUBE-SECURITY-ABUSE-MODERATION.md`

Key assumptions:

- Wallet/private signing remains outside DoobTube;
- no DoobTube custody;
- app is replaceable/non-authoritative;
- raw media remains off-chain;
- Search and feed are derived;
- optional Identity cannot manufacture authorization;
- Rights gates public publication;
- Storage owns canonical object readiness;
- Pay/Compute remain transitive through Media;
- live deployment requires external secret manager, egress policy, scanner and rate limiting.

## 11. Known limitations

Repository V1 does not provide:

- comments/reactions;
- paid subscriptions;
- PPV;
- tips;
- ads/revenue sharing;
- token-gated media;
- raw media on-chain;
- native mobile client;
- qualified delete/export backend endpoints;
- production authentication gateway;
- production endpoints/TLS;
- public-testnet evidence;
- production scanner/egress/monitoring evidence.

These limitations are explicit and must not be hidden by UI or deployment configuration.

## 12. Release ownership

- DOOBTUBE-10 — docs/deployment/operator closeout.
- DOOBTUBE-11 — repository Level 3 exact-head closeout.
- DOOBTUBE-12 — production-equivalent public-testnet qualification.
- DOOBTUBE-13 — Genesis/production release.
