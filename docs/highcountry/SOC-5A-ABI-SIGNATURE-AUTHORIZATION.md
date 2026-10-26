# SOC-5A — Canonical social ABI, wallet authorization and emergency qualification

## Scope and authoritative contracts

The only authorized High Country social actions are defined in `SOC5A_ABI` and checked against these canonical Solidity interfaces:
- `OrganizationRegistry`: create, invite/revoke, join, requestLeave, remove, proposeAdmin, acceptAdmin
- `OrganizationAuthority`: delegate and revoke (bounded, noncustodial roles only)
- `CooperativeRegistry`: create, enroll, withdraw
- `CooperativeGovernance`: propose, vote, cancel
- `GovernanceExecutor`: execute a policy-only approved proposal

All call selectors and fixed-width argument types are verified against checked-in Solidity in the SOC-5A ABI test. Unknown selectors and all financial/treasury transfers are prohibited; no social permission can release custody, BUDS, or native $420.

## Wallet signing

The server produces an exact canonical `{from,to,data,chainId,value:0}` intent after checking the registered principal, linked wallet and canonical state. The browser requires a caller-supplied player-controlled wallet `signTransaction` method; it does not hold a private key. The serialized EVM transaction is supplied separately from the original unaltered authorized arguments. The chain adapter independently decodes the signed EIP-1559 (or equivalent EVM) envelope, cryptographically recovers the signer, validates nonce/chain/to/input/value **before broadcast**, then checks the returned transaction hash against the locally computed Keccak-256 of the signed bytes and verifies the observed transaction details. The bearer principal and wallet must remain equal at authorization and submission. Replays and revoked/changed authority are rejected. The authorized operation cannot attach a nonzero ETH transfer.

EOA-serialized transaction signing is the supported SOC-5A transport. Contract-account/4337 execution requires a separately specified and independently verified user-operation transport; it is not silently handled as an EOA signature.

## Authorization and emergency semantics

Permits are fail-closed server-side canonical reads. They are not powers or settlements. A bounded, expiring proof links actor, action, contract arguments and canonical policy. Permissions are rechecked before signed submission and the actual Solidity contract rechecks them at execution.

The adapter pins the exact keccak domains `HC.EMERGENCY.ORGANIZATION_GOVERNANCE` and `HC.EMERGENCY.COOPERATIVE_GOVERNANCE`; it rejects incorrect configuration, queries `r04DomainOpen` on the target pinned-bytecode contract, and also respects configured global emergency restrictions. Methods without a Solidity `r04Unrestricted` modifier (member departure, administrator removal, delegation revocation, cooperative withdrawal and proposal cancellation) are not incorrectly denied by the emergency gate, although their own canonical authorization checks remain mandatory.

Invitation expiry, active membership, administrator authority, successor acceptance/deadlines, pending obligations, cooperative consent, 64-seat bounds, proposal electorate and vote eligibility, cancellation window and executable timelocks are verified from canonical pinned contract state, subject to final Solidity execution.

## Acceptance and independent gates

SOC-5A Level 1 requires exact-SHA module syntax, static ABI verification, real cryptographic EIP-1559 signer recovery, an approved signed transaction fixture, deliberate wrong signer/chain/target and tampered calldata rejection, emergency restriction and incorrect domain rejection, unauthorized direct server access and retained High Country client/gateway tests. The scoped `highcountry-social-chain-adapter.yml` workflow checks these on a single SHA.

This does **not** qualify SOC-5B durable PostgreSQL, SOC-5C local EVM/event indexer or SOC-5D restart/reorg lifecycle. No live or local deployed transaction history is claimed solely from SOC-5A.
