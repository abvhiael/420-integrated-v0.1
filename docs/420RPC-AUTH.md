# 420RPC RPC-9 authentication, API credentials and Developer Hub integration

RPC-9 binds public 420RPC traffic to explicit off-chain principals without turning service credentials into protocol identity or on-chain authority.

## Developer Hub contract

420RPC consumes the same credential-record shape defined by DEVHUB-16. The credential service remains responsible for generating, delivering, rotating, revoking and securely storing raw bearer material. Git-tracked Developer Hub metadata stores only a lowercase SHA-256 digest.

The required RPC audience is `420rpc`. Supported scopes are:

- `rpc:read` — metadata and canonical read methods from the RPC-2 public catalogue;
- `rpc:submit` — raw signed transaction submission only;
- `rpc:subscribe` — WebSocket subscribe/unsubscribe lifecycle;
- `rpc:derived` — RPC-8 420Indexer-derived resources;
- `rpc:admin` — service-local override across the preceding 420RPC scopes, never protocol or wallet authority.

A credential must be schema `1.0.0`, chain ID `420`, match the deployed environment, target audience `420rpc`, remain `ACTIVE`, be within its issue/expiry interval, and carry only recognized scopes.

## Bearer verification

The gateway accepts a strict `Authorization: Bearer <secret>` form. The presented secret is SHA-256 hashed locally and compared against credential digests with a timing-safe comparison. The raw bearer secret is not persisted in the RPC-9 credential registry or exposed by snapshots.

DEVHUB-16 credentials are expected to be high-entropy service secrets. The SHA-256 field is retained for exact compatibility with that established lifecycle contract; it is not intended for human passwords.

## Principal and quota binding

Successful authentication yields a stable off-chain principal:

```text
app:<applicationId>:credential:<credentialId>
```

RPC-6 accounting uses the derived client key:

```text
credential:<credentialId>
```

This means credential rotation can intentionally move future traffic to a new quota/accounting identity, while revoked or rotated credentials fail closed.

No bearer token, IP address, wallet address or HTTP connection is itself protocol identity.

## Anonymous access

RPC-9 policy may grant a bounded anonymous scope set. The default testnet policy grants only `rpc:read`, preserving public read compatibility while requiring explicit credentials for submission, subscriptions and derived Indexer reads.

Deployments may narrow anonymous access further. Anonymous access never bypasses RPC-5 validation, RPC-6 resource controls, RPC-4 safety checks or RPC-3 routing qualification.

## Authorization ordering

The intended request path is:

1. parse bearer credentials;
2. authenticate against active Developer Hub-compatible credential records;
3. authorize the requested RPC class/scope;
4. pass the principal-derived `clientKey` into RPC-6 admission;
5. continue through request/safety/routing logic.

Authentication success does not make an otherwise unsupported or privileged method legal. `debug_*`, `admin_*`, Engine API, node-managed signing/account methods and other RPC-5 exclusions remain blocked even for `rpc:admin`.

## Lifecycle behavior

- `ACTIVE` credential in its validity interval may authenticate.
- `ROTATED` fails closed.
- `REVOKED` fails closed.
- expired credentials fail closed.
- not-yet-active credentials fail closed.
- installing an older revision over a known credential ID fails closed.
- a credential ID cannot change its application binding.

The registry is bounded by `maxCredentials` and stores credential metadata/digests only.

## Authority boundary

RPC-9 credentials authenticate access to the off-chain 420RPC service only. They do not create or imply:

- 420 Identity credentials;
- wallet or smart-account signing authority;
- Registry legitimacy;
- governance votes or roles;
- protocol permissions;
- transaction validity;
- consensus, fork-choice, safe or finalized authority.

`rpc:admin` means 420RPC service authorization only.

## RPC-9 invariants

1. Raw bearer secrets are not persisted by the RPC-9 registry.
2. Credential records must remain chain/environment/audience bound.
3. Terminal or expired credentials never authenticate.
4. Scope checks fail closed and cannot broaden DEVHUB-16 grants.
5. Authenticated principal IDs are off-chain service identities only.
6. `rpc:admin` cannot bypass RPC-5 privileged-method exclusions.
7. Anonymous access is explicit policy, not an authentication failure fallback.
8. RPC-6 client accounting may use credential identity but never becomes authentication authority.
