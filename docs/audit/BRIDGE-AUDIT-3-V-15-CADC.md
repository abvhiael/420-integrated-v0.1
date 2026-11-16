# BRIDGE-AUDIT-3.V.15 — CADC / LayerZero

Base: authoritative `main` `97413f2eea862d5f2ec3117313cd3beb15a634f4`. Scope is the original CADC / LayerZero task. The implementation replaces the reverting adapter with native issuer OFT admission and outbound dispatch. **420 production activation remains blocked by issuer authorization and destination infrastructure.** No issuer approval, endpoint ID, deployment or production peer is invented. Existing frozen risk limits and the locked verification policy are unchanged.

## Verification and integration

`CADCLayerZeroAdapter` preserves its adapter identity and the common router interface. Only its immutable router may deliver or dispatch. Governance configures peers while the canonical `CADCBridgeIntegration` is inactive. Its existing Genesis governance and operational guard remain authoritative. Configure that integration with the adapter's aggregate `peerConfigHash` and `securityConfigHash`, then activate through the existing guard. Per-peer audit leaf functions are not aggregate activation hashes. Peer leaves are keyed by EID; replacing a leaf removes its old contribution before adding the new contribution. Multiple source peers can share the same integration commitment.

Every admission resolves the live issuer token, OFT and endpoint through that integration. It checks the OFT's token, endpoint and exact remote peer, the native endpoint's effective receive/send library and the library's **effective** ULN configuration. Default inheritance is resolved by native `getUlnConfig`; count/confirmation sentinels and default-library/configuration drift cannot bypass the pinned commitment. The locked policy requires at least two required DVNs, all of which must verify, plus the configured optional threshold. Addresses must be contracts, sorted, distinct and disjoint. Provider independence is a deployment qualification fact, not something inferred merely from different addresses.

Inbound proof ABI is `(uint32 sourceEid, uint64 nonce, bytes message)`. The adapter reconstructs the version-1 packet header, canonical local receiver, source/destination EIDs, GUID and payload hash. It atomically calls the pinned native `ReceiveUln302.commitVerification`, then native `EndpointV2.lzReceive` on the **issuer's existing OFT**, and requires the exact recipient token balance increase. Native ULN authentication uses verification state submitted by configured DVN contract identities; the adapter adds no committee or independent mint authority. A caller-provided transaction hash, RPC quorum, RPC delivery status or previously committed endpoint payload cannot substitute for that operation.

This integration admits ordinary 40-byte OFT transfers. Nonzero canonical EVM recipients, positive shared amounts and the issuer's decimal conversion rate are enforced. Compose payloads require their own qualified application consumer and fail closed here; the two retained genuine CADC transfers use ordinary messages. Native endpoint ordering/path initialization remains enforced. An external actor committing or executing the same packet first can make this accounting admission unavailable; such a delivery must be reconciled through the existing bridge recovery/accounting mechanisms, without replaying or reminting it. The adapter never claims a retrospective deposit from an unqualified RPC receipt.

Simple OFT messages do **not** authenticate an originating EOA or source transaction hash. For the common transfer registry, `sender` is a deterministic domain-separated channel identity and `sourceTxId` is the authenticated `keccak256(guid || message)` digest. These fields must not be presented as a user's source wallet or transaction hash. `sourceMessageId` is the actual LayerZero GUID.

Outbound extra ABI is `(uint32 destinationEid, bytes executorOptions)` and recipient ABI is one `bytes32`. The route, asset, peer and live send security configuration are bound. Token amounts must be exact shared-decimal units; dust and overflow are rejected. The adapter pulls the exact amount from the router-authenticated sender, grants only the issuer's required exact allowance, calls native `OFT.send`, clears allowance and checks native receipts and the adapter's resulting token balance. Native fee refunds go to the original sender. Compose, alternative OFT commands and LZ-token fees are not implicitly authorized. Non-EVM destination recipients retain their full 32-byte identity. The returned GUID is independently recomputed from the native nonce, local/source EID, issuer OFT, destination EID and peer. Outbound execution remains `SOURCE_PENDING` in the common registry rather than claiming destination finality.

GUID and channel/nonce replay stores persist across configuration changes. Reentrancy is blocked throughout token and protocol interactions. The common router's route/chain/asset, safety, risk and accounting admission remains in force. Any later router rejection atomically restores native DVN verification state, endpoint state, token effects and adapter replay state.

## Issuer and historical evidence

The issuer's [29 October 2026 announcement](https://loon.finance/blog/access-cadc-on-layerzero/) identifies CADC Reserve Trust as issuer, Loon Payments Inc. as servicer, upgraded token addresses, the legacy migration and paused Arbitrum support. `cadc.json` now distinguishes those upgraded tokens from OFT contracts and retains legacy addresses for identification only. All 420 routes stay inactive. Token addresses alone are not OFT identities.

LayerZero's retained official metadata identifies CADC OFTs separately: Ethereum `0xe0f9483de044b8e0c069a8561bdb580778854143`, Base `0x91222d95170227badb6d4e856fc03324eb6a4ab8`, Polygon `0xf004f8c27851f4f7123b974bf4d106a1aa5c0ef5`; Solana uses an independent OFT store/program. Historical Ethereum contract state independently binds the receiver to the upgraded issuer token, canonical endpoint, source peers, library, conversion rate and effective security configuration.

Two genuine historical transfers are retained with raw protocol responses, historical JSON-RPC request/response records, code, transaction receipts, source/destination transaction IDs and checksums:

| Source | Source EID | Destination EID | CADC local units | Destination receipt |
| --- | --- | --- | --- | --- |
| Base | 30184 | 30101 | 1,000,000 | `0xfe2e4d56b78db143f886bddb502249606d0de1a5e38ebc48503439b65abc9b41` |
| Polygon | 30109 | 30101 | 100,000 | `0x75ecfddb1933302d372b0a5281290df4e83ec1763756870898c3147432a2c910` |

`verify-cadc-history.py` recomputes each header, GUID and payload hash; checks the historical effective configuration and native peer/token/library identities; binds all five native DVN verification events and confirmation counts; checks the exact native commitment call/event, successful endpoint delivery, OFT receipt and exact CADC mint. The actual issuer stack is **two required DVNs (LayerZero and Fidelity) plus one of three optional DVNs (Deutsche Telekom, Canary and Google)**. This satisfies the locked requirement and reconciles the issuer's abbreviated “3-of-5” description. Base required 10 confirmations; Polygon required 120. Historical observations are retained qualification evidence, not new cryptographic finality roots or runtime proof inputs.

Both historical mainnet fork tests also **passed** at blocks `26400201` and `26399892`, immediately before the respective commitments. They consume genuine pre-existing DVN verification state and execute the real mainnet ULN, endpoint, issuer OFT and CADC token, checking exact credit and replay rejection. No DVN verification is injected or signature mocked in these fork tests. Only the newly deployed adapter and its activation record are test-local; their activation does not authorize 420 integration.

The native test import closure is pinned to LayerZero commit `9c741e7f9790639537b1710a203bcdfd73b0b9ac` OpenZeppelin `dc44c9f1a4c3b10af99492eed84f83ed244203f6` and solidity-bytes-utils `fc502455bb2a7e26a743378df042612dd50d1eb9`. All 69 source files are unmodified and checksum verified, with upstream licenses retained. Controlled tests use actual native Endpoint, receive/send ULNs and OFT code. Only issuer activation, DVN actors/fee quotes and executor fee quotes are controlled; they are not genuine issuer approval or production DVN credentials.

## Required external completion

- Obtain explicit issuer authorization for the 420 destination and its canonical CADC representation; none is established by this implementation or the public announcements.
- Authenticate a real supported LayerZero 420 endpoint and assigned EID, canonical network identity and deployed issuer token/OFT. The retained official metadata contains no chain with native chain ID 420.
- Authenticate issuer-owned two-way peers and both ends' effective library, independent DVN identities, confirmations and optional threshold. Commit the approved deployed configuration through the existing guard and route registries.
- Qualify actual 420 deposit/withdrawal receipts, replay rejection and risk/accounting behavior against those deployments before activation. A running testnet alone does not provide issuer approval or DVN support.

These are unfinished original authorization/deployment requirements. Full-step production acceptance is open; no new audit phase or branch/approval rule is introduced. Current `main` does not define a canonical numbered bridge step following V.15; no successor is invented or begun.

## Reproduction and retained qualification

Exact commands, logs, source hashes, compiler provenance, targeted regression results and scope boundaries are retained in [cadc-qualification/RESULTS.json](cadc-qualification/RESULTS.json). Use Python 3.12, `eth-abi==5.2.0`, `eth-hash[pycryptodome]==0.8.0`, Foundry v1.9.0 and Solidity 0.8.24:

```sh
python scripts/verify-cadc-history.py
python scripts/qualify-cadc.py --match CADCLayerZero420.t.sol
python scripts/qualify-cadc.py --match CADCGatewayIntegration420.t.sol --match-test '^testRouter'
```

The isolated runner copies the real source import closure without altering production sources and rejects a zero-test result. The dedicated workflow owns only CADC qualification; unrelated workflow path filters are excluded narrowly. A single qualified publication uses `[skip ci]` to retain local evidence without redundant CI. Historical mainnet fork qualification, when recorded as passing, is separately reproducible using `CADC_ARCHIVE_RPC` and `--match CADCHistoricalFork.t.sol`; fork activation is explicitly test-only and cannot authorize 420 deployment.
