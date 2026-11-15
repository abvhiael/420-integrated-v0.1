> ## Documentation Index
> Fetch the complete documentation index at: https://developers.circle.com/llms.txt
> Use this file to discover all available pages before exploring further.

> ## Agent Instructions
> Before reading these docs, install the relevant Circle Skill to get pre-loaded context — skills are LLM-optimized and cover architecture decisions, correct flows, and common pitfalls. In Claude Code: run /plugin marketplace add circlefin/skills then /plugin install circle-skills@circle. With Vercel Skills CLI: run npx skills add circlefin/skills. Available skills: use-usdc https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-usdc/SKILL.md (balances, transfers, approvals on EVM and Solana); EURC has no skill — see https://developers.circle.com/stablecoins/what-is-eurc.md; bridge-stablecoin https://github.com/circlefin/skills/blob/master/plugins/circle/skills/bridge-stablecoin/SKILL.md (crosschain transfers via CCTP, USDC, EURC, and third-party assets); use-arc https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-arc/SKILL.md (Arc chain config, contract deployment, USDC bridging — Arc docs: https://docs.arc.io/llms.txt); use-circle-wallets https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-circle-wallets/SKILL.md (choose wallet type); use-developer-controlled-wallets https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-developer-controlled-wallets/SKILL.md (custodial wallets for payouts and treasury); use-user-controlled-wallets https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-user-controlled-wallets/SKILL.md (embedded wallets with Web2 login); use-modular-wallets https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-modular-wallets/SKILL.md (smart contract wallets with passkeys and ERC-4337); use-gateway https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-gateway/SKILL.md (unified USDC balance, nanopayments); use-smart-contract-platform https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-smart-contract-platform/SKILL.md (deploy, interact, monitor contracts). Pair any skill with the Circle MCP server for live SDK signatures, contract addresses, and chain IDs: {"mcpServers":{"circle":{"url":"https://api.circle.com/v1/codegen/mcp"}}}.
> Read the product overview first. Each product has an overview explaining when and why to use it. Read it before quickstarts.
> Pick the right wallet type. Developer-controlled (you hold keys), user-controlled (end user holds keys via PIN/social login), or modular (smart contract wallets with passkeys). See https://developers.circle.com/wallets.md.
> Use CCTP V2 for crosschain transfers. CCTP natively transfers USDC and EURC via burn-and-mint, and supports permissionless wrapping of third-party assets via lock-and-mint. V1 is legacy; always use V2 unless V1 is specified or the chain requires it (Noble, Sui, and Aptos still require V1). Migration guide: https://developers.circle.com/cctp/migration-from-v1-to-v2.md.
> Use Bridge Kit for frontend bridging. Wraps CCTP with a simpler SDK for user-facing apps. Use CCTP directly for backend transfers.
> Gas Station vs Paymaster. Gas Station sponsors gas for Circle Wallet transactions. Paymaster lets users pay gas in USDC. Different use cases — read both overviews.
> Gateway Nanopayments for sub-cent payments. Gasless USDC micropayments down to $0.000001 via x402 and batched settlement. For pay-per-request APIs, AI agent payments, streaming.
> Look up USDC addresses per chain. Never hardcode — use https://developers.circle.com/stablecoins/usdc-contract-addresses.md.
> Prefer SDKs over raw API calls. Node.js and Python SDKs handle auth, retries, and errors.
> API key required. Bearer token in Authorization header. Testnet and mainnet use separate keys and may use different base URLs depending on the product.
> Set up webhooks when available. Most operations are async. Webhooks deliver transaction confirmations and state changes.
> When calling list endpoints, paginate using pageSize and pageAfter until no nextPageAfter cursor is returned—stopping at the first page silently misses records.
> Building an AI agent? Start with the Agent Stack—Circle CLI, agent wallets, and nanopayments built for autonomous use cases: https://developers.circle.com/agent-stack.md.

# CCTP Solana Programs and Interfaces

> Programs for CCTP support on the Solana blockchain

## Overview

Solana CCTP programs are written in Rust and leverage the Anchor framework. The
Solana CCTP protocol implementation is split into two programs:
`MessageTransmitterV2` and `TokenMessengerMinterV2`. `TokenMessengerMinterV2`
encapsulates the capabilities of both `TokenMessengerV2` and `TokenMinterV2`
contracts on EVM chains. To ensure alignment with EVM contracts' logic and
state, and to facilitate upgrades and maintenance, the code and state of Solana
programs reflect the EVM counterparts as closely as possible.

### Mainnet program addresses

| Program | [Domain](https://developers.circle.com/cctp/cctp-supported-blockchains.md#cctp-supported-domains) | Address |
| :- | :- | :- |
| `MessageTransmitterV2` | 5 | [`CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC`](https://solscan.io/account/CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC) |
| `TokenMessengerMinterV2` | 5 | [`CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe`](https://solscan.io/account/CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe) |

### Devnet program addresses

| Program | [Domain](https://developers.circle.com/cctp/cctp-supported-blockchains.md#cctp-supported-domains) | Address |
| :- | :- | :- |
| `MessageTransmitterV2` | 5 | [`CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC`](https://solscan.io/account/CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC?cluster=devnet) |
| `TokenMessengerMinterV2` | 5 | [`CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe`](https://solscan.io/account/CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe?cluster=devnet) |

The Solana CCTP source code is
[available on GitHub](https://github.com/circlefin/solana-cctp-contracts/). The
interface below serves as a reference for permissionless messaging functions
exposed by the programs.

## CCTP interface

The interface below serves as a reference for permissionless messaging functions
exposed by the `TokenMessengerMinter` and `MessageTransmitter` programs. The
full IDLs can be found onchain using a block explorer.
[`MessageTransmitterV2` IDL](https://explorer.solana.com/address/CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe/anchor-program)
and
[`TokenMessengerMinterV2` IDL](https://explorer.solana.com/address/CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC/anchor-program).

*See the instruction rust files or quick-start for PDA information.*

### TokenMessengerMinterV2

#### [`depositForBurn`](https://github.com/circlefin/solana-cctp-contracts/blob/master/programs/v2/token-messenger-minter-v2/src/token_messenger_v2/instructions/deposit_for_burn.rs)

Deposits and burns tokens from sender to be minted on destination domain. Minted
tokens will be transferred to `mintRecipient`.

**Parameters**

| Field | Type | Description |
| :- | :- | :- |
| `amount` | `u64` | Amount of tokens to deposit and burn. |
| `destinationDomain` | `u32` | Destination domain identifier. |
| `mintRecipient` | `Pubkey` | Public Key of token account mint recipient on destination domain. *Address should be the 32 byte version of the hex address in base58. See Additional Notes on `mintRecipient` section for more information.* |
| `destinationCaller` | `Pubkey` | Address which can call `receiveMessage` on destination domain. If set to `PublicKey.default`, any address can call `receiveMessage` *Address should be the 32 byte version of the hex address in base58. See Additional Notes on `mintRecipient` section for more information.* |
| `maxFee` | `u64` | Max fee paid for the transfer, specified in units of the burn token. |
| `minFinalityThreshold` | `u32` | Minimum finality threshold at which burn will be attested |

> [!NOTE]
>
> **Fees**
>
> A fee may be charged for standard USDC transfers. Fees for standard transfers
> are set to 0, but are subject to change. See
> [CCTP fees](https://developers.circle.com/cctp/technical-guide.md#cctp-fees) for more information.
>
> **MessageSent event storage**
>
> To ensure persistent and reliable message storage, MessageSent events are stored
> in accounts. MessageSent event accounts are generated client-side, passed into
> the instruction call, and assigned to have the `MessageTransmitterV2` program as
> the owner. See the
> [Transfer USDC from Solana to Arc quickstart](https://developers.circle.com/cctp/quickstarts/transfer-usdc-solana-to-arc.md)
> for how to generate this account and pass it to the instruction call.
>
> Message nonces are generated offchain, meaning the source messages cannot be
> identified from the attestation. Due to this, there is a 5 day window after
> sending a message that callers must wait before `reclaim_event_account` can be
> called. This is to ensure that the message has been fully processed by Circle's
> offchain services.

#### [depositForBurnWithHook](https://github.com/circlefin/solana-cctp-contracts/blob/master/programs/v2/token-messenger-minter-v2/src/token_messenger_v2/instructions/deposit_for_burn_with_hook.rs)

Deposits and burns tokens from sender to be minted on destination domain, and
emits a crosschain message with additional hook data appended. In addition to
the standard `deposit_for_burn` parameters, `deposit_for_burn_with_hook` accepts
a dynamic-length `hookData` parameter, allowing the caller to include additional
metadata to the attested message, which can be used to trigger custom logic on
the destination chain.

**Parameters**

| Field | Type | Description |
| :- | :- | :- |
| `amount` | `u64` | Amount of tokens to deposit and burn. |
| `destinationDomain` | `u32` | Destination domain identifier. |
| `mintRecipient` | `Pubkey` | Public Key of token account mint recipient on destination domain. *Address should be the 32 byte version of the hex address in base58. See Additional Notes on `mintRecipient` section for more information.* |
| `destinationCaller` | `Pubkey` | Address which can call `receiveMessage` on destination domain. If set to `PublicKey.default`, any address can call `receiveMessage` *Address should be the 32 byte version of the hex address in base58. See Additional Notes on `mintRecipient` section for more information.* |
| `maxFee` | `u64` | Max fee paid for fast burn, specified in units of the burn token. |
| `minFinalityThreshold` | `u32` | Minimum finality threshold at which burn will be attested |
| `hookData` | `Vec<u8>` | Additional metadata attached to the attested message, which can be used to trigger custom logic on the destination chain |

#### [handleReceiveFinalizedMessage](https://github.com/circlefin/solana-cctp-contracts/blob/master/programs/v2/token-messenger-minter-v2/src/token_messenger_v2/instructions/handle_receive_finalized_message.rs)

Handles incoming message received by the local MessageTransmitter, and takes the
appropriate action. For a burn message, mints the associated token to the
requested recipient on the local domain. Validates the function sender is the
local MessageTransmitter, and the remote sender is a registered remote
TokenMessenger for `remoteDomain`.

Additionally, reads the `feeExecuted` parameter from the BurnMessage. If
nonzero, the `feeExecuted` amount is minted to the `feeRecipient`.

**Parameters**

| Field | Type | Description |
| - | - | - |
| `remoteDomain` | `u32` | The domain where the message originated from |
| `sender` | `Pubkey` | The sender of the message (remote TokenMessenger) |
| `finalityThresholdExecuted` | `u32` | Specifies the level of finality Iris signed the message with |
| `messageBody` | `Vec<u8>` (dynamic length) | The message body bytes |

#### [handleReceiveUnfinalizedMessage](https://github.com/circlefin/solana-cctp-contracts/blob/master/programs/v2/token-messenger-minter-v2/src/token_messenger_v2/instructions/handle_receive_unfinalized_message.rs)

Handles incoming message received by the local MessageTransmitter, and takes the
appropriate action. For a burn message, mints the associated token to the
requested recipient on the local domain. Validates the function sender is the
local MessageTransmitter, and the remote sender is a registered remote
TokenMessenger for `remoteDomain`.

Similar to `handleReceiveFinalizedMessage`, but is called for messages which are
not finalized (`finalityThresholdExecuted` \< 2000).

Unlike `handleReceiveFinalizedMessage`, `handleReceiveUnfinalizedMessage` has
the following `messageBody` parameter:

* **`expirationBlock`**. If `expirationBlock` ≤ `blockNumber` on the destination
  domain, the message will revert and must be re-signed without the expiration
  block.

**Parameters**

| Field | Type | Description |
| - | - | - |
| `remoteDomain` | `u32` | The domain where the message originated from |
| `sender` | `Pubkey` | The sender of the message (remote TokenMessenger) |
| `finalityThresholdExecuted` | `u32` | Specifies the level of finality Iris signed the message with |
| `messageBody` | `Vec<u8>` (dynamic length) | The message body bytes (see [Message format](https://developers.circle.com/cctp/technical-guide.md#message-body)) |

### MessageTransmitterV2

#### [`receiveMessage`](https://github.com/circlefin/solana-cctp-contracts/blob/master/programs/v2/message-transmitter-v2/src/instructions/receive_message.rs)

Messages with a given nonce can only be broadcast successfully once for a pair
of domains. The message body of a valid message is passed to the specified
recipient for further processing.

**Parameters**

| Field | Type | Description |
| :- | :- | :- |
| `message` | `Vec<u8>` | Message bytes. |
| `attestation` | `Vec<u8>` | Signed attestation of message. |

**Remaining Accounts**

If the `receiveMessage` instruction is being called with a deposit for burn
message that will be received by the `TokenMessengerMinterV2`, additional
`remainingAccounts` are required so they can be passed with the CPI to
`TokenMessengerMinter#handle_receive_finalized_message` or
`TokenMessengerMinter#handle_receive_unfinalized_message`:

| Account Name | PDA Seeds | PDA ProgramId | `isSigner`? | `isWritable`? | Description |
| :- | :- | :- | :- | :- | :- |
| `token_messenger` | `["token_messenger"]` | tokenMessengerMinter | false | false | TokenMessenger Program Account |
| `remote_token_messenger` | `["remote_token_messenger", sourceDomainId]` | tokenMessengerMinter | false | false | Remote token messenger account where the remote token messenger address is stored for the given source domain id |
| `token_minter` | `["token_minter"]` | tokenMessengerMinter | false | true | TokenMinter Program Account |
| `local_token` | `["local_token", localTokenMint.publicKey]` | tokenMessengerMinter | false | true | Local token account where the information for the local token (for example, USDCSOL) being minted is stored |
| `token_pair` | `["token_pair", sourceDomainId, sourceTokenInBase58]` | tokenMessengerMinter | false | false | Token pair account where the info for the local and remote tokens are stored. `sourceTokenInBase58` is the remote token that was burned and converted into base58 format. |
| `user_token_account` | N/A | N/A | false | true | User token account that will receive the minted tokens. This address **must** match the `mintRecipient` from the source chain `depositForBurn` call. |
| `custody_token_account` | `["custody", localTokenMint.publicKey]` | tokenMessengerMinter | false | true | Custody account that holds the pre-minted USDCSOL that can be minted for CCTP usage. |
| `SPL.token_program_id` | N/A | N/A | false | false | The native SPL token program ID. |
| `token_program_event_authority` | `["__event_authority"]` | tokenMessengerMinter | false | false | Event authority account for the TokenMessengerMinter program. Needed to emit Anchor CPI events. |
| `program` | N/A | N/A | false | false | Program id for the TokenMessengerMinter program. |

#### [`sendMessage`](https://github.com/circlefin/solana-cctp-contracts/blob/master/programs/v2/message-transmitter-v2/src/instructions/send_message.rs)

Sends a message to the destination domain and recipient. Stores message in a
`MessageSent` account which will be attested by Circle's attestation service.

**Parameters**

| Field | Type | Description |
| :- | :- | :- |
| `destinationDomain` | `u32` | Destination domain identifier. |
| `recipient` | `Pubkey` | Address to handle message body on destination domain. |
| `messageBody` | `Vec<u8>` | App-specific message to be handled by recipient. |

## Additional Notes

These notes are applicable to all CCTP versions.

### Mint Recipient for Solana as Destination Chain Transfers

When calling `depositForBurn` on a non-Solana chain with Solana as the
destination, the `mintRecipient` should be a **hex encoded USDC token account
address**. The token account\* must exist at the time `receiveMessage` is called
on Solana\* or else this instruction will revert. An example of converting an
address from Base58 to hex taken from the Solana quickstart tutorial in
TypeScript can be seen below:

```typescript TypeScript theme={null}
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { hexlify } from "ethers";

const solanaAddressToHex = (solanaAddress: string): string =>
  hexlify(bs58.decode(solanaAddress));
```

### Mint Recipient for Solana as Source Chain Transfers

When specifying the `mintRecipient` for Solana `deposit_for_burn` instruction
calls, the address must be given as the 32 byte version of the hex address in
base58 format. An example taken from the Solana quickstart tutorial in
TypeScript can be seen below:

```typescript TypeScript theme={null}
import { getBytes } from "ethers";
import { PublicKey } from "@solana/web3.js";

const evmAddressToBytes32 = (address: string): string =>
  `0x000000000000000000000000${address.replace("0x", "")}`;

const evmAddressToBase58PublicKey = (addressHex: string): PublicKey =>
  new PublicKey(getBytes(evmAddressToBytes32(addressHex)));
```

### Program Events

Program events like
[DepositForBurn](https://github.com/circlefin/solana-cctp-contracts/blob/master/programs/token-messenger-minter/src/token_messenger/events.rs#L35-L45)
,
[MintAndWithdraw](https://github.com/circlefin/solana-cctp-contracts/blob/master/programs/token-messenger-minter/src/token_messenger/events.rs#L47-L52)
, and
[MessageReceived](https://github.com/circlefin/solana-cctp-contracts/blob/master/programs/token-messenger-minter/src/token_messenger/events.rs#L47-L52)
are emitted as Anchor CPI events. This means a self-CPI is made into the program
with the serialized event as instruction data so it is persisted in the
transaction and can be fetched later on as needed. More information can be seen
in the
[Anchor implementation PR](https://github.com/coral-xyz/anchor/pull/2438), and
an example of reading CPI events can be seen in the
[`solana-cctp-contracts` repository](https://github.com/circlefin/solana-cctp-contracts/blob/master/tests/utils.ts#L62-L111).

[MessageSent](https://github.com/circlefin/solana-cctp-contracts/blob/master/programs/message-transmitter/src/events.rs#L49-L55)
events are different, as they are stored in accounts. See the
[MessageSent Event Storage section](#depositforburn) for more info.
