# 420 Attention user guide

Users can enable or revoke global or campaign-specific consent, inspect active campaigns, review campaign economics and verifier identity, monitor committed proofs, view reserved rewards and claim eligible rewards.

Campaign-specific consent overrides global consent once it exists. Proofs cannot be accepted outside the active campaign window or without current consent.

A notification or UI badge saying a reward is available is not the reward itself; canonical Attention state determines reservation and payment.

## Browser client

The deployable repository client is `attention/web/`.

The client supports:

- Wallet connection with exact-chain validation;
- campaign discovery and campaign economics/verifier inspection;
- global and campaign-specific consent review;
- proof and reward lookup;
- reward claim review;
- sponsor campaign creation, funding, activation, pause, close and cancellation;
- explicit transaction target/value/calldata review;
- Wallet simulation before submission;
- pending/included/confirmed/reverted/reorged transaction state.

The browser never becomes Attention authority. It consumes a non-canonical projection that must carry canonical source provenance, and it sends only an explicitly reviewed transaction to an injected EIP-1193 Wallet.

The committed runtime is intentionally fail-closed before testnet materialization: chain ID, projection API and registry-resolved Attention component addresses are unresolved, while all state-changing feature flags are disabled. Later deployment work must materialize those values from qualified testnet/Genesis authority rather than hard-coding guesses.

Raw behavioral telemetry, private audience dossiers, Wallet keys and provider credentials must never be supplied to the browser client.
