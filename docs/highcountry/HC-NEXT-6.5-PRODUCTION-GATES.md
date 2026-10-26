# HC-NEXT-6.5 canonical production adapter — integration evidence

The exact-wallet signed-transaction adapter calls pinned canonical social contracts using finalized RPC, broadcasts a wallet-provided raw transaction and checks transaction signer, calldata, target, chain ID and zero ETH transfer. Signed transaction bytes must be produced by the actual player's signer; this adapter does not hold member private keys.

**Not yet production equivalent.** Canonical `snapshot` and `history` deliberately reject requests until a deployment-verified indexed event reader with consent/membership visibility is provided. Several operations (delegations, complex governance permissions) remain unimplemented in the strict permission allowlist. The UI must collect wallet-signed transaction consent and align fields with the canonical Solidity ABI. The PostgreSQL migration is committed but is not executed on any named infrastructure: a privileged installer must create the correct tenant-isolated role and explicit scope-bound RLS policy. It must not trust a client-settable Postgres configuration variable.

Level 2 is blocked on independent network receipts, a provisioned database, persisted operation restart recovery, finalized event indexing, and adversarial RLS/reorg tests. Unit tests or mock RPC checks may not be used as evidence that those deployments occurred.
