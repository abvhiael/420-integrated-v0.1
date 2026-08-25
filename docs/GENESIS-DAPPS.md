
# 420 Integrated Genesis dApps — Frozen Decision

Genesis Application Decision #1 is frozen.

Genesis suite:
- 420 Wallet
- 420 Explorer
- 420 Registry
- 420 Names
- 420 Identity
- 420 Swap
- 420 Bridge
- 420 Stake
- 420 Governance
- 420 AI
- 420 Attention
- 420 Status
- 420 Faucet (testnet only)

## Contract readiness

Protocol-state contracts now exist for every genesis dApp that requires on-chain state.

Wallet, Explorer and Status are deliberately contract-free as applications. They consume canonical
chain/system data and discover protocol services through 420 Registry.

420 Stake explicitly has delegation disabled at genesis.

420 Names is a presentation alias system and does not replace canonical ProtocolRegistry identities.

420 Bridge is proof-verifier based, replay-protected and pausable by governance; it exposes no
unbacked administrator mint function.

420 Faucet is explicitly testnet-only.

## Remaining deployment gate

Source readiness is not the same as deployed readiness. The remaining Step 6 deployment gate is to:
1. freeze the new candidate application addresses within 0x0420-0x04FF;
2. compile the Solidity suite with the pinned compiler;
3. run Foundry tests and security review;
4. generate bytecode and initial storage;
5. inject those artifacts deterministically into genesis;
6. verify every reserved address/code hash from the generated genesis.

Until those steps pass, the contracts are genesis-ready source definitions but not yet a frozen
mainnet deployment image.
