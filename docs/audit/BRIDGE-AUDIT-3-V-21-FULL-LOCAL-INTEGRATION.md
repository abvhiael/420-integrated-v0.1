# BRIDGE-AUDIT-3.V.21 — Full Local Bridge Integration

Repository implementation and local-EVM integration, 2026-11-15 (America/Regina).
Main baseline: `97413f2eea862d5f2ec3117313cd3beb15a634f4`.
Required dependency: V.20 / PR #1174 at `b1d2abc7a5d7797042d901e811e268247d2db6e1`, itself dependent on V.19 / PR #1173. Both were unmerged when this step started. Native CCTP implementation, historical evidence and compiled native Circle contracts are reused from V.14 / PR #1168 at `0a677dc9c7eedc2f56c5b35141ae770a2e13e679`, with exact original checksums in IMPORTED-SOURCES.json. No additional consensus or issuer-signature implementation is introduced.

## Nine-stage local lifecycle

| Stage | Actual exercised infrastructure and evidence |
| --- | --- |
| 1. Authentic source blockchain evidence | Original Base-to-Ethereum CCTP message and two-signature Circle attestation. Original historical Ethereum receiveMessage input and successful USDC mint/Transfer logs independently corroborate the bytes, recipient, nonce and 51,757 USDC delivered amount. |
| 2. Cryptographic finality and inclusion verifier | Pinned native Circle MessageTransmitterV2 bytecode executes threshold/signature/nonce and native message checks. This is the previously qualified issuer-attestation verification model, not a source block-header SPV light client or an RPC-only finality assertion. |
| 3. Identity and qualification | Actual BridgeVerifierRegistry420 approval binds adapter, native proxy runtime and implementation identities, minter/token identities, configured keys/threshold, native authorities and public security/configuration state. Production approval lists remain empty. |
| 4. Chain-specific adapter | Existing USDCCCTPAdapter invokes actual native MessageTransmitter, TokenMessenger and TokenMinter implementations. The adapter's existing signature, domain, peer, nonce and actual balance-change enforcement is retained. |
| 5. Canonical envelope and domain | Canonical ABI `(message, attestation)` only; exact raw bytes and source/destination domains, messenger, token, recipient, finality and amount are authenticated. Trailing data and cross-domain substitution fail. No second protocol envelope or proof system is invented. |
| 6. Gateway and routes | Production GatewayRouter420 and BridgeRouteRegistry enforce current canonical chains, route tuples, qualified consumer/verifier and runtime identities before and after execution. |
| 7. Replay and risk | Native issuer nonce, adapter nonce, router source-message replay, transfer replay, route/asset limits and TVL are checked together. Late failure rolls them back with native delivery and adapter receipt state. |
| 8. Transfer lifecycle | CREATED through VERIFIED, DESTINATION_PENDING and COMPLETED run through the canonical router, using immutable source transaction/message and exact original qualification binding. |
| 9. Authorized settlement | Native minter actually calls the local token and adapter checks recipient balance delta before recording a per-message delivery receipt. The router validates its token, recipient, amount and evidence against the canonical asset and verified transfer before completing. An operator assertion or proof-only adapter cannot fabricate completion. |

## Settlement integration

`acceptInboundAndSettle(adapterId, proof)` atomically verifies, executes native destination delivery, admits the transfer and completes its lifecycle. Any later failure reverts the entire transaction, including native issuer/token state. Existing `acceptInbound` remains available for proof acceptance/native delivery without immediate completion. `completeInboundSettlement(transferId)` completes an existing native-delivery receipt without minting again or charging risk again. It also accepts a legitimate DESTINATION_PENDING notification, and rejects unknown, outbound, failed, disputed, completed, suspended or revoked transfers through the existing state and admission guards.

`IBridgeSettlementEvidence420` is an authenticated-adapter receipt interface. It is never an independent trust root. The current approved adapter runtime must have qualified delivery semantics; its receipt is bound to the canonical token, transfer recipient, amount and message. USDCCCTPAdapter records the receipt only after the pre-existing native issuer execution and balance/nonce checks succeed. Registry qualification, exact route and original transfer bindings remain authoritative at completion. Settlement completion in BridgeTransferRegistry now requires the canonical router, closing the previous trusted-operator assertion path.

Proof-only adapters do not acquire a mint or release facility. They may reach VERIFIED using their existing supported evidence but cannot become COMPLETED without a real qualified delivery receipt. No unapproved synthetic BTC token, custody script, issuer role or mint authority is introduced. Outbound native CCTP burn is exercised from actually received local balances and remains SOURCE_PENDING until authentic destination acknowledgement is available; the inbound-completion API cannot label it settled.

The generic lifecycle graph and emergency controls remain intact. Route suspension, verifier revocation, stale configuration, native issuer pause and token mapping/implementation substitution prevent delivery or delayed completion. Existing governed pause/dispute/refund controls remain available. Completed historical records are not rewritten by later suspension.

## Authenticity and local reconstruction limits

The complete success case is a faithful local reconstruction of the historical **Base domain 6 to Ethereum domain 0** protocol path, on local EVM chain ID 1. The recipient, message, amount and original issuer signatures are unchanged. Native Circle proxy, MessageTransmitter, TokenMessenger and TokenMinter code is pinned upstream bytecode from `circlefin/evm-cctp-contracts` commit `a92a2b4e7e6ef99bf0b05dca71780f5ec190e729`, built using solc 0.7.6 with 100,000 optimizer runs and retained original license/checksums.

Proxy runtime placement and initialization are explicit test reconstruction. Local governance/Genesis dependencies and the token are controlled test doubles. The token is not real deployed USDC; no production balances are moved. Native signature checking and message execution are not verifier stubs or locally signed certificates. The two enabled native attesters correspond to the original recorded issuer public keys. The test uses public historical attestations, not issuer signing credentials.

The source-finality trust model is Circle attestation. Historical RPC/explorer records corroborate the transaction but are not substituted for issuer signature verification. This is genuine historical issuer gateway evidence, not an unrelated payment relabelled as 420 gateway authorization. No test asserts an authentic historical transfer to 420Chain, Circle approval of a 420Chain domain, or deployed 420Chain native-USDC/mint authority. Those remain the existing issuer/testnet prerequisites from V.14. Other unavailable chain-specific gateway evidence and prior chain qualifications retain their original limitations.

`verify-bridge-full-local-evidence.py` independently decodes the raw message and historical destination transaction ABI and checks the actual mint Transfer log using only the Python standard library. INDEPENDENT-EXPECTED.json records the exact original transaction, recipient, amount, fee, nonce and checksums. Native Circle parsing/execution is independent of the adapter's Solidity parser. Prior historical signature/bytecode qualification remains attributed to its original SHA rather than being rerun wholesale.

## Qualification scope

The targeted runner selects only the new full local lifecycle/boundary/invariant owners and affected router, admission, transfer lifecycle, Bitcoin gateway and Pay/Swap regression owners. No unrelated imported suites are selected. Fuzz tests mutate genuinely signed evidence and reject counterfeit amounts. Stateful invariants combine genuine replay attempts, qualification rotation/revocation and route suspension with independent expected delivery, nonce, supply, lifecycle and risk state.

Successful inbound delivery is reconciled against authorized amount and actual observed local recipient/fee balances. The outbound accounting case burns from the historical recipient's genuinely replayed local credit and reconciles remaining balances and route/asset TVL. Explicit tests reject forged amounts/recipients/signatures, wrong domains, noncanonical envelopes, replay, suspended/revoked routes, changed attester policies, changed native implementations/token mappings, lying/failed token mint, unhealthy accounting, late risk/transfer/settlement failures and unauthorized completion. A synthetic-token funding case tests outbound request state separately; it is not historical destination acknowledgement.

Original V.19/V.20 evidence remains in its original commits. V.21 changes the legacy placeholder test to cover the three still-unwired placeholders; the native CCTP adapter now has real integration and its default inactive state is checked separately. Existing lifecycle tests use the canonical router actor when exercising successful completion; no transition assertions are weakened.

Actual run counts, tool versions, exact input manifests, production sizes and diagnostic logs are retained in full-local-integration-qualification/. Test harness code-size limits are elevated; production runtimes are separately asserted against EIP-170. No live deployment, governance transaction or production approval is claimed.

Available main and the supplied list do not identify a successor after V.21. No subsequent step is invented or started. Merge status and the exact published qualification SHA are reported in the associated pull request.

## Verified local results

102 distinct cases qualified: 98 passing cases in the main batch, two proof-only settlement boundary cases, and two affected-case passes after harness corrections. Three fuzz tests execute 2,500 runs each, 7,500 runs total. The two invariants execute 128 runs at depth 64 each, 16,384 calls total with zero handler reverts. All compiled production runtimes satisfy EIP-170; largest is 22,063 bytes. Native protocol fixture checksums and independent historical transaction/log corroboration pass.

The retained diagnostic failures were test harness issues. After replacing the native implementation code, the rejection was correct but the test then tried to decode a getter through that deliberately replaced code; it now restores original code only for post-rejection storage inspection. The burn test impersonated the recipient before evaluating an external adapter-ID getter, which consumed the one-call impersonation; it now evaluates that getter before impersonation. Neither correction changes production code or weakens the intended assertions. Only those two cases were rerun. Original logs and exact pre-correction source snapshots are retained and checksum-verified. All other tested sources are unchanged.

The original successful native completion used 8,240,433 test gas including the supply-reconciliation assertions; the received-balance burn/accounting case used 12,882,895. These are measured local test costs, not production throughput promises. Historical source signatures and current admission are both required; no signing key or artificial finality proof is generated for the success case.
