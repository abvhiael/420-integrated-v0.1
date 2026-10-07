# 420 Attention / Cannaseur web client

This directory is the deployable browser client for ATTENTION-AUDIT-6.

The browser is **not canonical protocol authority**. It renders canonical/rebuildable projections, requires explicit EIP-1193 Wallet connection for participant/sponsor actions, validates the configured chain, validates transaction-review provenance and target addresses, simulates each reviewed transaction, and then delegates signing to the user's Wallet.

The committed `runtime-config.json` intentionally fails closed before production-equivalent testnet materialization:

- chain ID is unresolved;
- the non-canonical Attention projection/API URL is unresolved;
- registry-resolved Attention component addresses are unresolved;
- consent, reward-claim and sponsor mutation feature flags are disabled.

Those bindings belong to later ATTENTION-AUDIT-7/8 work and must not be invented here.

## Supported user workflows

- inspect campaigns and committed economics;
- inspect account consent/proofs/rewards through the projection API;
- prepare global/campaign-specific consent changes;
- inspect and claim a reserved reward;
- sponsor create/fund/activate/pause/close/cancel campaign actions;
- explicit transaction review, simulation, submission and confirmation/reorg/revert state.

No raw behavioral telemetry, targeting dossier, Wallet secret, private key, provider credential or arbitrary transaction capability belongs in browser runtime configuration.

## Qualification

```sh
cd attention/web
npm run qualify
```

Build output is written to `attention/web/dist`.
