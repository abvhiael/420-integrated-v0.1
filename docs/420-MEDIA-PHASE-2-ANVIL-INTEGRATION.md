# 420Media Phase 2 — Anvil Integration Gate

This gate validates the Phase 2 Ethereum adapter against live Phase 1 contracts deployed to a local Anvil chain.

## Coverage

The harness deploys `MediaCapabilityRegistry420`, `MediaOperatorRegistry420`, `MediaSLA420`, `MediaSettlement420`, and `MediaJobMarket420`; binds their Phase 1 dependencies; registers and activates an operator/capability; creates one canonical `CREATED` job and one canonical `FUNDED` job; and then runs the Go adapter against the live JSON-RPC endpoint.

The Go integration test proves:

- `JobCreated` log discovery through `eth_getLogs`;
- canonical `jobs(bytes32)` re-read through `eth_call`;
- Solidity status translation into stable node statuses;
- operator acceptance through the signer interface;
- canonical operator binding after acceptance;
- funded-state and amount decoding;
- `markRunning` transaction submission;
- `commitResult` transaction submission; and
- canonical post-transaction status re-reads.

The test-only Anvil signer uses unlocked ephemeral Anvil accounts. No test private keys are committed to the repository.

## Invariants

- `MEDIA-NODE-INV-036`: live event discovery must re-read the deployed Phase 1 job contract before returning work.
- `MEDIA-NODE-INV-037`: adapter lifecycle writes must produce the expected canonical Phase 1 status transitions on a real EVM node.
- `MEDIA-NODE-INV-038`: integration tests must cross the `Signer` interface rather than directly mutating contract state for node-owned transitions.
- `MEDIA-NODE-INV-039`: repository integration fixtures contain no private signing keys; ephemeral Anvil signing uses unlocked local-only accounts.

The dedicated GitHub Actions workflow is `.github/workflows/420media-anvil.yml`, and the local entrypoint is `scripts/420media-anvil-integration.sh`.
