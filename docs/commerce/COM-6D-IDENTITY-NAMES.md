# COM-6D — Identity / Names

Canonical parent: COM-6 Merchant operations, credentials/names. COM-6D is a substep, not a replacement roadmap number.

Repository canonical contracts: contracts/src/apps/Identity420.sol and contracts/src/apps/Names420.sol; each reports protocolVersion 3. Payment/merchant authority stays exclusively in Pay MerchantRegistry420, not merchant profile badges or .420 name claims.

The optional read-only Identity/Names adapter is commerce/src/identity-names.mjs. An approved operator-supplied binding must provide exact chain, distinct contract addresses, approved deployed code hashes and protocol version. Every merchant integration read uses one finalized RPC block; it validates code/version and ties the active Identity profile controller to the canonical Pay merchant controller. An explicitly configured credential type must pass hasValidCredential to display CREDENTIAL_VALID; profile ownership alone is only PROFILE_CONTROLLER_MATCH. Reverse Names resolution is rechecked against forward resolution, expiry and profile claim; the result uses a label hash, never a fabricated human-readable name. Missing optional config returns NOT_VERIFIED. Identity or Names never authorize store changes, payout, refunds or approvals.

Service/SDK/browser retain existing merchant signed permission boundaries and display statuses only. The tests in commerce/test/com6d-identity-names.test.mjs cover positive profile/name/credential, expiry, revocation/inactive profile, absent reverse entry, wrong bytecode, disabled or aliased binding, no optional integration and store IDOR. No Solidity code, canonical Genesis addresses or frozen ABI changed; only app-specific Level 1 service/browser tests are required, not repository-wide Level 3.

This is not real-world Identity/Names/Verify acceptance. A config flag does not establish ProtocolRegistry publication, human-readable label attestation, provider-issued trust class or a live on-chain credential; these remain testnet/release gates. COM-6E analytics and the later complete COM-6 phase milestone remain outstanding. Next top-level canonical step after COM-6 is COM-7 Security/ops.

Level 1 exact-SHA evidence to be appended only after required workflows finish.
