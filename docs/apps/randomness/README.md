# 420 Randomness

420 Randomness is the provider-neutral entropy protocol used by 420Integrated applications that require verified randomness. It is not an oracle feed and it does not permit applications to substitute block data, timestamps, UI randomness, or unverified provider responses when a qualified result is unavailable.

## Canonical components

- `RandomnessRouteRegistry420`: governance-versioned provider route authority.
- `RandomnessProfileRegistry420`: application security profiles and predeclared fallback policy.
- `RandomnessRouter420`: canonical request, frozen-route, proof-verification, fallback and expiry lifecycle.
- `RandomnessRegistry`: immutable request/result record intended for frozen address `0x0428`, bound once to the canonical router.
- `IRandomnessVerifier420`: method-specific proof verification boundary.
- `RandomnessDraw420`: deterministic, domain-separated derived draws.

The canonical application-facing router is Registry-resolved rather than assigned a fixed Genesis address.

## Trust and failure model

A request freezes profile revision, route revision, operator, verifier, method, domain, purpose and deadlines before entropy is knowable. Only the frozen active-route operator may fulfill it and the frozen verifier must accept the proof. Fallback is limited to the predeclared profile. Expired unresolved requests void; consumers must fail closed.

Provider registration does not grant custody, wallet, governance, settlement or unrelated execution authority.

## Build and test

From `contracts/`:

```bash
forge build src/randomness src/interfaces/IRandomnessRouter420.sol src/interfaces/IRandomnessVerifier420.sol
forge test --match-path 'test/Randomness*.t.sol' -vvv
```

Repository qualification also runs `python3 scripts/verify-420randomness-audit.py`.

## Genesis deployment sequence

1. Materialize the canonical `RandomnessRegistry` runtime/storage for `0x0428` from `contracts/src/randomness/RandomnessRegistry.sol`.
2. Deploy `RandomnessRouteRegistry420` and `RandomnessProfileRegistry420` under GovernanceTimelock authority.
3. Deploy `RandomnessRouter420` with the profile registry, route registry and `0x0428` registry.
4. Governance calls `RandomnessRegistry.bindRouter(router)` exactly once.
5. Publish canonical router/component identities through ProtocolRegistry.
6. Configure qualified routes and profiles.
7. Run request/fulfillment/fallback/void smoke tests and verify indexed lifecycle events.

Do not bind `0x0428` until the exact router deployment has been qualified; the binding is irreversible.

## Known repository limitation

A historical `contracts/src/system/RandomnessRegistry.sol` implements a consensus-rotation mirror with the same contract name. It is not the current generalized 420 Randomness registry described by the canonical architecture. Historical Step-6 material that points to that source is stale and must not be used to materialize the `0x0428` application predeploy.

Runtime artifact retention, deterministic predeploy-state materialization, live ProtocolRegistry publication and production-equivalent testnet smoke evidence remain deployment-stage qualification work.
