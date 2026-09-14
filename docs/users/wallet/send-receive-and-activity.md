---
title: Send and receive $420
audience:
  - user
category: user-guide
status: development
version: current
---

# Send and receive `$420`

Native `$420` is the network currency of 420 Integrated. Use this guide to receive funds, send a transfer, understand fees, and distinguish submitted, canonical, safe, and finalized activity.

## Receive `$420`

1. Open the qualified 420 Wallet client.
2. Select the account that should receive the funds.
3. Open **Receive** or copy the displayed public address.
4. Confirm whether the address shown is your SmartAccount420 or another account address expected by the sender.
5. Share only the public address or QR code.
6. After the sender submits the transfer, verify the transaction in Wallet or Explorer.

A public address is safe to share. A seed phrase, private key, passkey private material, signing secret, or recovery secret is not.

### Before someone sends a large amount

Ask for a small test transfer first if either side is unsure about the address, network, or account type.

## Send `$420`

1. Select **Send**.
2. Enter or scan the destination address.
3. Enter the amount.
4. Review the network and available balance.
5. Review the fee estimate and total outflow.
6. Confirm the destination carefully.
7. Approve the transaction only after the wallet review matches what you intended.
8. Keep the transaction hash until the transfer reaches the confirmation/finality level you require.

The wallet must not silently change the target or amount after review. If the approval prompt does not match the form you just completed, reject it.

## Address checks

Blockchain addresses are case-insensitive at the execution level when interpreted as raw 20-byte values, but user-facing clients may preserve checksum-style casing. Do not rely on visual similarity alone.

Watch for:

- clipboard malware replacing an address;
- a saved contact pointing to an old or different account;
- confusing a controller address with a SmartAccount420 address;
- sending on the wrong network;
- malicious sites displaying one address while requesting a signature for another target.

Compare at least the beginning and end of the destination, and use a verified contact/name-resolution path where available.

## Fees

A normal transaction can require native `$420` for gas. The wallet may show estimated gas, base-fee effects, priority-fee information, or a simplified fee estimate depending on the client.

The amount sent and the transaction fee are separate. A transfer can fail while still consuming some gas because execution resources were used.

See [Gas, fees, and native `$420`](../../architecture/chain/gas-fees-native-420.md) for the execution model.

## Activity states

Do not treat every visible transaction as irreversible.

A useful mental model is:

- **prepared** — the wallet has constructed/reviewed the action but it has not been submitted;
- **submitted/pending** — the signed transaction was sent to the network but is not yet included in a canonical block;
- **included/canonical** — the transaction currently appears in the canonical execution chain;
- **safe** — consensus has given stronger certification than an unqualified head;
- **finalized** — consensus finality has advanced past the transaction's block under the canonical finality rule.

Before finality, a reorganization can change whether an included transaction remains canonical. Wallet, Explorer, and Indexer surfaces should update accordingly.

## Pending transaction takes too long

First check:

1. that you are on the intended network;
2. that the wallet is connected to a healthy RPC endpoint;
3. whether the transaction hash is visible in Explorer;
4. whether your account had enough `$420` for value plus gas;
5. whether the nonce is blocked by an earlier pending transaction.

Do not repeatedly sign replacement transactions unless the wallet explicitly supports and explains that operation.

## Failed transaction

A failed receipt means the transaction was included but execution reverted or otherwise failed. The transferred application action may not have happened, while gas can still have been consumed.

Inspect:

- receipt status;
- error/revert information surfaced by the wallet or Explorer;
- target contract/application;
- value and calldata;
- allowance/permission requirements;
- account capability/session state.

If a supported wallet flow simulated successfully but the final transaction failed, state may have changed between simulation and execution. Re-read current state before trying again.

## Sending to contracts and dApps

A transaction to a contract can do much more than transfer `$420`. It may approve spending, execute a swap, bridge assets, stake, vote, grant a capability, or call arbitrary application logic.

When the action is not a simple native transfer, use the wallet's transaction review and application-specific documentation. Do not judge safety by the displayed `$420` value alone; a zero-value transaction can still grant powerful permissions.

## Verify after sending

After submission, verify:

- transaction hash;
- from account;
- destination;
- value;
- execution status;
- current canonical/finality state.

For high-value or cross-system actions such as bridging, wait for the confirmation/finality level required by that protocol rather than assuming one included block is enough.

## Related documentation

- [Signing and transaction review](signing-and-transaction-review.md)
- [Troubleshooting](troubleshooting.md)
- [Transactions](../../architecture/chain/transactions.md)
- [Blocks and state](../../architecture/chain/blocks-and-state.md)
