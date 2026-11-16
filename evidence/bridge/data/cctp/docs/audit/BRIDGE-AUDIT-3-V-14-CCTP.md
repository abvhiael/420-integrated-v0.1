# BRIDGE-AUDIT-3.V.14 — USDC / Circle CCTP

Date: 2026-11-15. Authoritative baseline: `main` at `97413f2eea862d5f2ec3117313cd3beb15a634f4`.

**Repository implementation and historical qualification are complete. Full 420Chain acceptance remains OPEN because Circle does not currently list 420Chain as a CCTP domain or native-USDC chain. USDC routes remain APPROVED_INACTIVE.** No domain, official deployment, USDC issuance authority, private issuer approval or operational 420Chain transfer is invented.

## Scope and authoritative reconciliation

Current `main` contained a 578-byte `USDCCCTPAdapter` whose two transfer entrypoints always reverted. The older open PR #463 head `a1bac7e7ec8f497cd493f14e116ebc01c17b5acf` contains the identical stub blob `176b6acd19441523048bbae1aa88485c5b6a0ec9`. Relevant USDC/CCTP PR searches did not establish a competing qualified implementation. This change starts from current `main`, preserves all other chain-family PRs and evidence, and does not merge legacy roadmap branches.

The unchanged canonical `verification-policy.json` requires Circle CCTP **V2**, official MessageTransmitter/TokenMessenger native burn/mint, and an inactive USDC route when 420 is unsupported. Existing USDC risk limits and launch routes (Ethereum, Base and Arbitrum) remain unchanged. The new configuration records their published source identities and leaves **every 420-side issuer binding null**. The canonical Registry asset ID also remains unassigned; the adapter takes the approved Registry binding rather than inventing a new asset identifier. EVM chain ID `420` is not a Circle domain ID.

| Original requirement | Implemented and qualified | Remaining external condition |
|---|---|---|
| Supported CCTP verification mechanism | Official CCTP V2 MessageTransmitter, TokenMessenger and TokenMinter integration; no substitute signer committee or synthetic-USDC mint | Actual Circle-supported 420 deployments/native USDC are unavailable |
| Authorized issuer attestations | Native threshold, enabled attesters, sorted distinct signatures, raw-message Keccak digest, recovery and low-s checks; five genuine messages authenticated to Circle's published V2 keys | Approved live deployment/key/role reconciliation on 420 |
| Source/destination domains | Explicit Circle domain bindings, local transmitter domain/version checks, peer direction/finality policy and EVM chain binding; domain zero correctly supports Ethereum | Circle has not assigned 420Chain a published domain |
| Messenger/transmitter identities | Pinned local native proxy implementations; messenger/transmitter/minter relationships and live remote-messenger/token-pair checks; issuer-published source identities and destination receipts | Exact official 420 addresses and implementation identities |
| Format, nonce, amount, recipient | V2 header/body wire version 1; bytes32 global nonce; fee-adjusted amount; canonical EVM addresses and intact non-EVM identities; expiry, caller, finality and opaque hook handling | Operational deployed route/asset configuration |
| Attestation replay protection | Native nonce store plus persistent independent adapter nonce store across configuration changes and re-attestation; native/router atomic rollback | Funded 420 end-to-end deployment qualification |
| Authentic historical messages/attestations | Five exact Iris message/attestation pairs, Circle versioned keys and published contract/token identities; four independently observed successful destination transactions and mint/message logs; actual upstream contract replay | No claim those transfers involved 420Chain |
| Confirm 420Chain issuer eligibility | Fresh direct reads of Circle's supported-domain, native-USDC and contract publications establish that 420Chain is not currently listed | Private eligibility/approval correspondence is not present; Circle must establish a supported deployment path before activation |

## Actual implementation

`USDCCCTPAdapter` retains the existing adapter ID, adds the canonical governance/router boundary and defaults inactive. Governance configures the **official** local native USDC, Circle MessageTransmitter/TokenMessenger/minter, issuer support evidence and approved peers. A nonzero evidence reference is retained audit provenance, **not cryptographic proof that Circle approved a chain**. Governance must not use this interface to designate an unofficial USDC/CCTP deployment as canonical.

Each call checks the deployment EVM chain, USDC code identity, native proxy implementation code hashes, native domain/header/body versions and transmitter/messenger/minter relationships. A native implementation or minter change fails closed until qualified configuration is reconciled. Active issuer attester policy is read/enforced by the actual MessageTransmitter; there is no local committee, frozen substitute signer or hardcoded production threshold.

Inbound calls decode the complete authenticated V2 message, check the configured source messenger and USDC token, local destination messenger/domain, recipient, destination caller, finality/expiry and peer direction. The official MessageTransmitter verifies Iris signatures and invokes the official TokenMessenger/Minter. The adapter checks **actual native recipient balance increase** and native nonce consumption, returning the amount **after `feeExecuted`**. It does not mint a synthetic representation or accept a verification boolean. When the recipient is also the issuer fee account, the balance check includes that account's fee allocation while transfer accounting remains net of fees.

Outbound calls pull the user's explicitly approved native USDC through the canonical router, approve only the exact burn amount, invoke actual `depositForBurn`/`depositForBurnWithHook`, and check that all pulled funds were burned and no approval remains. Failures roll back user balances, allowances, counters and router state. The actual GatewayRouter integration qualifies source-pending lifecycle registration and inbound risk accounting, including rollback of the entire native mint/nonce stack when the router rejects risk after verification.

### Identity and protocol details

* CCTP V2 uses **wire header version 1 and burn-body version 1**, not CCTP V1's wire format. The header is 148 bytes and the fixed burn body 228 bytes. V1 messages/keys are not accepted as a fallback.
* Native V2 nonces are globally unique **bytes32** identifiers, assigned **offchain**. The native MessageTransmitter keys replay by nonce alone and reserves nonce zero. The adapter preserves an independent global nonce-consumption map; it does not incorrectly adopt V1's domain/uint64 nonce format or rely only on a changeable message digest.
* Original `MessageSent` source messages contain an unassigned nonce and finality placeholders. An outbound adapter request ID is therefore **not Circle's future nonce**. Correlate the burn transaction and native event through Iris, then retain the assigned nonce/attestation. The router correctly records the outbound request as SOURCE_PENDING.
* The signed wire does **not** carry the original source transaction hash or a source MessageTransmitter address. `VerifiedTransfer.sourceTxId` is the authenticated message Keccak digest, explicitly not a caller-asserted original transaction hash. `sourceMessageId` is the domain-separated global nonce ID. Iris provides the source-transaction correlation for presentation/reconciliation; it is not added to signed bytes or trusted merely because a caller supplies it.
* Remote MessageTransmitter origin is authenticated through Circle's issuer-attestation model: Iris observes its canonical domain transmitter. The adapter's peer transmitter field records the qualified issuer-published deployment identity; it is provenance metadata, **not an additional transmitter address magically present in the signed message**. Local MessageTransmitter identity and code are checked directly. Historical qualification additionally checks official source publications and observed canonical destination emitter/call identities.
* EVM peer addresses require zero-padded 20-byte encoding within bytes32. The explicit peer address model rejects dirty high bits in EVM source senders, outbound recipients and outbound callers. Solana source addresses remain intact; the common 20-byte sender field uses a domain-separated synthetic identifier rather than truncating a native public key. The Solana historical case tests protocol interoperability, not activation of an additional launch route.
* Destination caller is either zero (Circle's permissionless relay semantics) or the adapter's address; the native call sees the adapter, not GatewayRouter, as caller. Directly relayed messages cannot be credited again through the adapter. For atomic router-managed ingestion, source callers can bind the adapter as destination caller. This does not turn zero-caller messages into a second mint entitlement.
* Fee, maximum fee, amount and expiration are authenticated fields. The bridge returns net delivery, not gross burned USDC. Expiration equality is rejected, matching native contracts. On ARB-stack chains, native `block.number` semantics apply; no invented independent expiration clock is used.
* Fast transfer requires an explicitly qualified peer finality policy of 1000; launch configuration defaults to finalized 2000. Raw minimum thresholds normalize as Circle specifies (`<=1000` → 1000, otherwise 2000). A mismatched or insufficient executed finality is rejected.
* Hook bytes are authenticated opaque data and **never executed** by the adapter. Circle core contracts also leave hook execution to integrators. No hook-specific spending permission or arbitrary callback is inferred.

## Authoritative upstream and historical evidence

The official [Circle EVM CCTP repository](https://github.com/circlefin/evm-cctp-contracts) was audited at immutable commit `a92a2b4e7e6ef99bf0b05dca71780f5ec190e729`. The actual MessageTransmitterV2, TokenMessengerV2, TokenMinterV2 and AdminUpgradableProxy creation bytecode is reproducibly compiled with **solc 0.7.6 / optimizer 100,000 runs**. Forty-seven source/license files and pinned dependency revisions are preserved under `scripts/cctp/upstream`; original source and licenses are retained. Four creation artifacts match the independent rebuild exactly. Tests execute these native contracts, not a programmable finality verifier. The USDC token and Genesis authority environment are explicit controlled doubles, not actual mainnet issuance permission.

Genuine Circle API responses, public keys, contract/token publications and unmodified message/attestation bytes are retained under `contracts/test/fixtures/cctp`. Five cases cover Base finalized, Arbitrum fast with fees, Arbitrum finalized with hook data/fees, Solana finalized and Ethereum→Base fast. All five verify against both Circle-published current V2 attester keys:

* `0x52Ed4cBff8DcE6A19748043F3240ec03c834bCeF`
* `0x725b06F73ff761eF5390e39315e2BfbF60d33F96`

Their two-signature attestations are not generated by test keys. Four Ethereum destination transaction inputs and successful USDC mint/MessageReceived logs independently match the exact Circle API bytes, nonces, amounts, fees and recipient. The Ethereum→Base case retains Circle's exact completed response and destination transaction identity; a separate Base receipt was not obtained. These are genuine historical issuer proofs on supported chains, **not 420Chain end-to-end evidence or an Ethereum consensus light client**.

Adversarial coverage includes wrong versions/domains/messengers/token/caller, dirty address encodings, zero nonce/amount, fee/expiry/finality mismatches, missing/extra/duplicate/unsorted/unauthorized/high-s/malformed signatures, revoked attesters, paused issuer, implementation/peer/token-pair substitution, claimed mint without funds, native mint/burn failure, reentrancy, trailing envelopes, replay/re-attestation and router rollback. The SDK has equivalent signature, domain, amount, address and replay preflight checks; native onchain policy remains authoritative.

## Verified issuer eligibility and external blocker

Fresh direct issuer reads are retained in `issuer-observation.json` with timestamps, exact URLs and checksums:

* [Supported blockchains/domains](https://developers.circle.com/cctp/concepts/supported-chains-and-domains)
* [Official EVM contract addresses](https://developers.circle.com/cctp/references/contract-addresses)
* [Native USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)
* [Official Solana programs](https://developers.circle.com/cctp/references/solana-programs)
* [Versioned Iris public keys](https://iris-api.circle.com/v2/publicKeys)

**Result: 420Chain is not currently listed for native USDC or CCTP; no published assigned domain or official 420 contract set is available.** This confirms current public issuer support status, not a private issuer rejection or future eligibility promise. Permissionless application integration on supported chains does not assign a new blockchain a Circle domain or native-USDC mint role. No private issuer conversation, submission or approval is claimed. Circle's decision/authorization and actual supported 420 infrastructure are external blockers, not work that local tests can manufacture.

The original acceptance remains open on that issuer condition. Existing USDC caps, inactive status and the prohibition on an unofficial canonical USDC replacement are preserved. No unsupported live mint, paid service, issuer application, external message or deployment was performed.

## Reproduction and publication

See [results and retained evidence](cctp-qualification/RESULTS.md). Only affected qualification owners ran. Passing evidence from earlier chain steps and previous PRs is unchanged. The new narrow CCTP owner and exact path exclusions avoid unrelated sports/contract/docs/indexer/registry runs for CCTP changes; no new branch restriction or approval process is introduced. The publication uses one coherent commit with `[skip ci]`; no redundant Actions run is claimed.

```sh
python -m pip install -r scripts/cctp/requirements.txt
python scripts/cctp/fetch_compilers.py /tmp/cctp-compilers
python scripts/cctp/build_upstream.py --solc /tmp/cctp-compilers/solc-0.7.6
python scripts/qualify-cctp.py --solc /tmp/cctp-compilers/solc-0.8.24
python scripts/cctp/check_bytecode.py --solc /tmp/cctp-compilers/solc-0.8.24
python scripts/cctp/verify_history.py
python -m unittest discover -s scripts/cctp -p test_cctp.py -v
sha256sum -c contracts/test/fixtures/cctp/SHA256SUMS
```

Read-only acquisition is available through `fetch_attestation.py` (mainnet and sandbox keys remain separate; supply the actual approved transmitter's signature threshold) and `observe_issuer.py`. Neither script signs, mints, sends a transaction or establishes authority from an arbitrary recovery address or JSON flag.

Current canonical `main` does not define a numbered successor after this user-assigned V.14 step. No V.15 number or additional roadmap task is invented or begun.
