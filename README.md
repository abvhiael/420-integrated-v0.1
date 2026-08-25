# 420 Integrated v0.1

A clean-room resurrection of the original 420 Integrated / PUFFScoin idea as a modern EVM-compatible Layer-1 network.

## Core idea

420 Integrated is designed as one programmable economy with three permanent issuance purposes:

- 34% Network Security
- 25% Attention Economy
- 25% Development Ecosystem

The execution layer is intended to remain compatible with modern Go-Ethereum/EVM tooling. Consensus is a separate 420-specific component with rotating bonded validators and a path toward permissionless Proof of Stake.

## Current status

This repository is the protocol-design/bootstrap scaffold. Consensus-critical numbers are separated into `config/protocol.json` so they can be reviewed and simulated before being frozen into genesis.

See:

- `docs/ROADMAP.md`
- `docs/PROTOCOL-v0.1.md`
- `docs/OPEN-DECISIONS.md`
- `config/protocol.json`
- `genesis/allocations-template.csv`

## Naming

The public native currency is `420`.

Source-code identifiers should use names such as `FourTwenty`, `Coin420`, or `NativeCurrency`, because Go/Solidity identifiers cannot begin with a digit.

## Rule

No parameter becomes a mainnet constitutional constant merely because it appears in this v0.1 scaffold. We simulate first, test on a local devnet, then explicitly freeze it.
