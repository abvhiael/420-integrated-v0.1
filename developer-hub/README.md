# 420 Developer Hub

The 420 Developer Hub is the developer-facing control plane for 420 Integrated.

It exists to make the ecosystem discoverable, testable, integrable, deployable, verifiable, publishable, observable, qualifiable, and release-ready without becoming a new source of protocol authority.

## Roadmap status

The planned implementation roadmap from **DEVHUB-0 through DEVHUB-19 is COMPLETE**.

The final implementation phase, DEVHUB-19 production launch readiness and candidate closeout, was merged by PR #211. The closeout record is maintained in `../docs/DEVELOPER-HUB-ROADMAP-CLOSEOUT.md`.

Implementation completion does not mean public testnet or mainnet launch is automatically ready. Real deployment remains gated by independent release evidence, exact release-candidate qualification, environment configuration, operator procedures, and the appropriate protocol/Registry/governance authorities.

## Delivered surfaces

The Hub now includes:

- network/environment discovery;
- canonical contract catalogue and interface discovery;
- TypeScript SDK and Wallet/smart-account developer integration;
- local/devnet bootstrap;
- Developer Hub CLI and project templates;
- faucet/test-account support for eligible non-production networks;
- deployment and verification orchestration;
- 420Indexer integration with explicit projection/non-authority boundaries;
- protocol integration guides;
- app registration and AppStore publishing workflows;
- dashboard surfaces;
- logs, events, diagnostics, and debugging;
- off-chain application identity and API credential lifecycle;
- service-health/status aggregation;
- security/developer qualification;
- production launch-readiness aggregation and exact release-candidate closeout binding.

## Non-authority rule

The Hub may aggregate, validate, render, orchestrate, qualify, and hand off canonical services and evidence. It must not silently replace 420 chain state, protocol registries, 420Indexer projection boundaries, 420Verify, 420 Wallet authority, application registry/AppStore state, governance authority, finality/settlement authority, security certification, or release activation authority.

## Repository landmarks

- `schema/network-manifest.schema.json` — machine-readable network configuration contract
- `manifests/local.example.json` — safe non-production example
- `src/` — Developer Hub runtime/control-plane modules
- `dashboard/` — read-oriented developer dashboard surfaces
- `qualification/` — developer qualification profiles/evidence examples
- `test/` — DEVHUB invariant and hostile-state regression coverage
- `../packages/420-sdk/` — shared developer SDK
- `../packages/420-cli/` — Developer Hub CLI surfaces
- `../docs/DEVELOPER-HUB-DEVHUB-0.md` through `../docs/DEVELOPER-HUB-DEVHUB-19.md` — phase records
- `../docs/DEVELOPER-HUB-ROADMAP-CLOSEOUT.md` — final roadmap disposition and deployment-time follow-ups

## Test

```bash
cd developer-hub
npm test
```

## Next

There is no planned DEVHUB-20 implementation phase.

Future work belongs to one of four categories: concrete deployment/configuration, maintenance/defect remediation, compatibility changes required by an upstream protocol/service change, or a separately approved roadmap extension.
