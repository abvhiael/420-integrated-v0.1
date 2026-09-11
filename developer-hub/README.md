# 420 Developer Hub

The 420 Developer Hub is the developer-facing control plane for 420 Integrated.

It exists to make the ecosystem discoverable, testable, integrable, deployable, verifiable, and publishable without becoming a new source of protocol authority.

## DEVHUB-0 scope

This initial phase freezes:

- authority boundaries
- source-of-truth rules
- network manifest contract
- initial repository layout
- architecture invariants

## Non-authority rule

The Hub may aggregate, validate, render, and orchestrate canonical services. It must not silently replace 420 chain state, protocol registries, 420Indexer projections, 420Verify, 420 Wallet authority, or application registry/app-store state.

## Layout

- `schema/network-manifest.schema.json` — machine-readable network configuration contract
- `manifests/local.example.json` — safe non-production example
- `test/architecture-contract.test.mjs` — DEVHUB-0 invariants

See `../docs/DEVELOPER-HUB-DEVHUB-0.md` for the architecture freeze.

## Test

```bash
cd developer-hub
npm test
```

## Next

DEVHUB-1 implements network/environment discovery on top of this contract.