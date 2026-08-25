# 420 Contract Dev Environment

This is the shared Solidity development and verification environment for every 420 Integrated
genesis smart-contract suite.

## What GitHub Actions is

GitHub Actions is GitHub's hosted automation/CI service. Workflow YAML files under
`.github/workflows/` tell GitHub to create a clean runner and execute the repository's build/test
commands. For 420 Integrated, the workflow installs Foundry and Go, builds Solidity, runs tests,
fuzzing/invariants, generates coverage, and uploads verification artifacts.

## Reuse across genesis suites

The environment is deliberately not specific to 420Pay. The same commands are used for:

- 420Pay
- 420Swap
- 420Bridge
- ValidatorRegistry / Stake420
- RewardController and treasury contracts
- Governance / GovernanceTimelock
- PublicDistributionVault / auctions / oracle integrations
- FounderVestingRegistry
- Protocol/Name/Identity registries
- AI job/escrow/reputation contracts
- any additional approved genesis predeploy contract

Each suite adds tests under `contracts/test/`; `contracts-verify.sh` executes the full repository.

## One-command verification

From a machine with Foundry installed:

```bash
make contracts-verify
```

For the heavier CI profile:

```bash
make contracts-ci
```

## Docker

```bash
docker build -f Dockerfile.contracts -t 420-contract-dev .
docker run --rm -it -v "$PWD:/workspace" 420-contract-dev
make contracts-verify
```

## VS Code / Dev Containers

Open the repository in VS Code with the Dev Containers extension and select "Reopen in Container".
The `.devcontainer` configuration builds the same contract environment.

## Verification profile

Development:
- Solidity 0.8.24
- EVM Cancun
- optimizer enabled, 200 runs
- fuzz runs: 10,000
- invariant runs: 512
- invariant depth: 128

CI:
- fuzz runs: 50,000
- invariant runs: 2,048
- invariant depth: 256

These are minimum internal-hardening values, not a substitute for external audit.

## Generated evidence

`artifacts/contracts/` receives:
- tool versions
- Go-test output
- static verification output
- Foundry build output
- Foundry test output
- coverage summary
- SHA-256 hashes of generated Foundry artifacts
- runtime-bytecode build manifest

These files become part of the pre-genesis evidence package.

## Genesis rule

No genesis smart-contract suite is promoted to production-ready merely because its Solidity compiles.
Every security-sensitive suite must pass the common environment, complete suite-specific
fuzz/invariant coverage, survive testnet integration, and satisfy the external-audit release gate.
