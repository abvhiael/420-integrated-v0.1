# Migration Testnet — deferred network qualification roadmap

Status: **deferred from MIG-1**, NOT deployed or network-qualified. The existing `deployments/gaming/testnet.runtime.json` explicitly has a null chain ID and unresolved contract addresses. Do not substitute guessed addresses, game IDs or RPC URLs.

## MTN-0 — immutable prerequisites (Level 1)
- Record the chain genesis/network identity, numeric chain ID, RPC and witness endpoints, RPC TLS policy, funded operator keys held outside Git, deployment transaction and code hashes.
- Approve Genesis gaming catalog registration, including **MadBuds** if intended: no provisional on-chain game ID may be represented as registered.
- Maintain exact game-ID domains for High Country, Green Road, Budtender, and Smoke & Chrome.

## MTN-1 — deployment manifest and environment isolation (Level 1)
- Deploy games, identity, entitlement, cross-game, claims, bridge and migration contracts using recorded compiler/version and admin authorities.
- Populate and sign environment-specific manifest with chain ID, RPC and API endpoints, contract addresses and verified code hashes.
- Validate with `validateGamingDeployment420`, reject zero/noncontract addresses, wrong-chain RPC, missing hashes, and replay across environments.
- No private keys, bearer tokens or secrets in repository manifests.

## MTN-2 — real wallet/session compatibility (Level 1)
- Test EIP-1193 connect/disconnect, chain changes, rejected access, revoked authorization, guest/no-wallet state and stale session.
- Verify no gameplay-state mutation on RPC timeout, chain mismatch, entitlement denial, or wallet disconnect.
- Confirm retries apply only to idempotent reads; never silently retry signatures, transactions or reward claims.

## MTN-3 — claims/entitlements and adversarial settlement (Level 2)
- Verify authenticated player identity, scope-bound entitlement fetches, game-specific claim evidence and exactly-once claims.
- Cover forged or cross-game proofs, expired/revoked entitlements, network replay, simultaneous submissions, reorgs, reversals and provider outages.
- Reconcile canonical Genesis ledger effects and invariant checks with testnet receipts.

## MTN-4 — independent game acceptance (Level 2)
- Each extracted game installs a **version-pinned published SDK** from outside Genesis, builds without monorepo-relative source imports, and executes offline + testnet scenarios.
- Archive package integrity digest, game commit, SDK package version, chain configuration digest and run IDs.

## MTN-5 — final migration testnet qualification (Level 3)
- One evidence-only closeout after MTN-0 through MTN-4 pass with exact-SHA traceability and no redundant global reruns.
- Record owner signoff, deployed chain ID and contract code hashes, failure/recovery matrix and immutable CI evidence.

**Exit:** Real deployed and independently reproducible network integration. Until then MIG-1's contract compatibility may qualify, but no claim of live testnet readiness is authorized.
