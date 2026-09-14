# 420 Developer Hub — DEVHUB-9 Deployment Workflows & Initial Control Surface

## Status

DEVHUB-9 introduces the first Developer Hub deployment workflow. The Hub validates and plans deployment work, binds it to a canonical selected network, and exposes a developer-facing control view. It does **not** become a deployment signer, private-key store, 420Verify authority, Registry authority, or proof of canonical deployment state.

## Scope

DEVHUB-9 adds:

- a versioned deployment-request contract;
- artifact provenance requirements;
- canonical network and chain-ID binding;
- canonical RPC selection from DEVHUB-1 network discovery;
- explicit external signer/executor boundaries;
- staged deployment lifecycle metadata;
- a non-authoritative receipt recording step;
- a machine-readable deployment control view;
- CLI commands for deployment planning and control rendering.

Actual contract-specific deployment adapters remain project/runtime code. DEVHUB-9 does not replace existing qualified deployment scripts such as protocol-specific Foundry or client deployment tooling.

## Deployment request

A DEVHUB-9 request uses `schemaVersion: 1.0.0` and contains:

- `project` — stable developer project identifier;
- `chainId` — explicit decimal chain ID;
- `artifact.contract` — contract name;
- `artifact.path` — repository-relative build-artifact path;
- `artifact.sha256` — non-zero SHA-256 provenance hash;
- `deployer` — public EVM address only;
- `executor` — `420-wallet` or `project-adapter`;
- `constructorArgs` — constructor argument array;
- `requestVerification` — whether the later 420Verify stage is expected;
- `requestRegistration` — whether the later Registry/AppStore stage is expected.

`developer-hub/deployment/request.example.json` is the checked-in example shape. Its addresses and artifact hash are illustrative only; a real workflow must use the exact qualified artifact and intended deployer.

## Planning boundary

`createDeploymentPlan420()` consumes a DEVHUB-1 discovered network and a validated deployment request.

It fails closed when:

- the selected network has no canonical HTTP RPC endpoint;
- request chain ID differs from selected network chain ID;
- verification is requested but the selected network has no `services.verify` endpoint;
- the artifact path escapes the repository-relative namespace;
- artifact SHA-256 is malformed or all zeroes;
- the deployer is malformed;
- the executor is not an approved external boundary;
- the selected environment is `mainnet`.

Mainnet deployment is deliberately disabled in DEVHUB-9. Production deployment must wait for the later production-launch qualification rather than being enabled by an early Developer Hub convenience path.

## Deployment stages

The initial plan exposes five stages:

1. **preflight** — Developer Hub request/network validation;
2. **deploy** — external signer/executor submission;
3. **receipt** — canonical chain/RPC confirmation;
4. **verify** — 420Verify-owned verification workflow;
5. **register** — 420Registry/420AppStore-owned publication/registration workflow when requested.

The Hub can describe and orchestrate these stages. It does not inherit their authority.

## Signer boundary

The deployment control surface accepts only a public deployer address. It does not accept, generate, import, derive, persist, print, or request:

- raw private keys;
- mnemonics or seed phrases;
- keystore passwords;
- session keys;
- smart-account authorization secrets.

A `420-wallet` executor means the plan must be handed to the qualified 420 Wallet/smart-account path. A `project-adapter` executor means a separately qualified project deployment adapter owns submission. In both cases, `requiresExternalSignature: true` remains explicit.

## Receipt boundary

`recordDeploymentReceipt420()` can record an externally supplied transaction hash, contract address, and chain ID. That state is intentionally labeled:

`RECEIPT_RECORDED_REQUIRES_RPC_CONFIRMATION`

and retains:

`canonicalDeploymentProof: false`

until a later canonical RPC confirmation flow is implemented. An operator-, wallet-, or adapter-supplied receipt is not silently promoted into canonical chain truth.

## Initial control surface

`createDeploymentControlView420()` is the first deployment UI/control model. It produces a stable machine-readable view containing:

- project and selected network;
- deployment status;
- signer boundary;
- stage statuses and authorities;
- explicit secret-custody state;
- canonical-proof state;
- a deterministic `nextAction`.

DEVHUB-9 exposes this through the CLI. A richer browser dashboard can consume the same control model in later Developer Hub dashboard phases rather than creating different deployment semantics.

## CLI

DEVHUB-9 adds:

```text
420 deploy plan REQUEST_JSON [--manifest PATH] [--catalogue PATH]
420 deploy view REQUEST_JSON [--manifest PATH] [--catalogue PATH]
```

`deploy plan` validates and emits the deployment plan. It does not submit a transaction.

`deploy view` emits the initial control-surface model and, for a new valid request, reports:

`HAND_OFF_TO_EXTERNAL_SIGNER`

as the next action.

There is deliberately no `--private-key` option and no DEVHUB-9 CLI command that silently executes a mainnet deployment.

## Existing deployment tooling

420 Integrated already contains contract- and application-specific deployment flows, including Foundry scripts and project deployment scripts that construct real deployment manifests. DEVHUB-9 sits above those mechanisms as the common planning/control layer. It does not rewrite qualified protocol-specific deployment mechanics into a generic privileged deployer.

## Invariants

- **DEVHUB-INV-054** — every deployment request binds to an explicit chain ID and selected canonical network; mismatches fail closed.
- **DEVHUB-INV-055** — canonical RPC comes from selected network discovery and is not inferred from project names or deployment labels.
- **DEVHUB-INV-056** — deployment artifacts carry an explicit repository-relative path and non-zero SHA-256 provenance identifier.
- **DEVHUB-INV-057** — Developer Hub stores and displays public deployer identity only; secret signing material is outside DEVHUB-9.
- **DEVHUB-INV-058** — deploy execution requires an explicit external signer/executor boundary.
- **DEVHUB-INV-059** — externally supplied transaction receipts do not become canonical proof without canonical RPC confirmation.
- **DEVHUB-INV-060** — 420Verify remains authoritative for verification and Developer Hub only orchestrates/displays that stage.
- **DEVHUB-INV-061** — 420Registry/420AppStore remain authoritative for requested registration/publication stages.
- **DEVHUB-INV-062** — DEVHUB-9 mainnet deployment is disabled until production-launch qualification.
- **DEVHUB-INV-063** — the control view and CLI expose the same deployment lifecycle semantics; UI convenience may not bypass workflow gates.

## Exit criteria

DEVHUB-9 is complete when:

1. a versioned deployment request is validated fail-closed;
2. deployment planning binds to canonical network/RPC state;
3. artifact provenance is explicit;
4. signer custody remains outside Developer Hub;
5. deployment/receipt/verify/register authority boundaries are machine-readable;
6. supplied receipts remain non-authoritative pending chain confirmation;
7. CLI planning and control-view commands are qualified;
8. mainnet execution remains unavailable through DEVHUB-9.

## Next

DEVHUB-10 adds contract verification orchestration against 420Verify and canonical source/bytecode evidence, consuming DEVHUB-9 deployment results without redefining verification authority.
