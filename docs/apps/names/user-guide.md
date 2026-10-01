# 420 Names user guide

420 Names provides a user-facing management surface in 420 Wallet for the complete canonical name lifecycle: commit/register, renewal, forward resolution, reverse naming, transfer nomination, and transfer acceptance.

The Wallet management screen uses the qualified chain-specific `deployment.namesAddress`. It does not guess a contract address. If the selected runtime has no qualified Names420 deployment, the management surface fails closed and asks the user to reconnect to a qualified environment.

## Connect and verify

Open **420 Names** in 420 Wallet and choose **Connect / verify Names**.

Before enabling write actions, Wallet verifies:

- the configured chain ID;
- the connected EIP-1193 account;
- deployed code at the configured Names420 address;
- `systemName() == "Names420"`;
- protocol version `3`.

Account or chain changes invalidate the loaded management state. Reconnect and reload canonical state before continuing.

## Register a name

Registration is intentionally two transactions.

1. Enter a lowercase ASCII `.420` name such as `alice.420`.
2. Choose a lease duration from 30 through 365 days.
3. Generate a secure registration salt and keep it until registration confirms.
4. Choose **1. Commit**.
5. Wallet verifies availability, simulates the transaction, estimates gas, rechecks chain/account state, and then asks the connected wallet to approve the commitment.
6. After confirmation, use **Check commitment** to view the canonical commitment time and reveal window.
7. Once the minimum commitment age has passed, choose **2. Reveal / register**.
8. Wallet rechecks commitment age, expiry, availability, chain/account state, simulates again, and requests explicit wallet approval.
9. After the receipt succeeds, the newly registered canonical record is loaded.

A commitment cannot be revealed before the minimum age and cannot be used after the maximum age. An expired commitment requires a fresh commit. The salt becomes public in the reveal transaction.

## Renew a lease

Load the canonical name record, enter a renewal duration from 30 through 365 days, and choose **Renew lease**.

Wallet verifies that the connected account is still the current owner before simulation and submission. Renewal extends the existing expiry; it does not replace the current record.

## Update forward resolution

Load the name, enter the destination address, and optionally enter a 420Identity profile ID and 420Registry service ID.

Choose **Update resolution**.

Wallet verifies current ownership before submission. Changing the forward address can invalidate a previously selected reverse name because reverse resolution remains authoritative only while the forward target agrees.

A profile ID or service ID stored in Names420 is only a reference. It does not independently prove identity or Registry legitimacy.

## Set a reverse name

The connected address must currently be the name's forward-resolution target.

Load the name and choose **Set reverse name**. Wallet rechecks canonical forward resolution before simulating and submitting the transaction.

Reverse resolution automatically becomes non-authoritative if the name expires or if forward resolution later points somewhere else.

## Transfer ownership

Transfers are two-step.

The current owner:

1. loads the name;
2. enters a different nonzero **New owner** address;
3. chooses **Nominate new owner**;
4. reviews and approves the simulated transaction.

The nominated address then connects its wallet, loads the same name, and chooses **Accept pending transfer**.

On acceptance:

- ownership moves to the pending owner;
- `pendingOwner` clears;
- forward resolution resets to the new owner's address;
- previous Identity and Registry references are cleared.

Those associations must be deliberately re-established by the new owner.

## Transaction states

Every write follows the same state model:

- **Preflight** — chain/account/contract state is revalidated, the call is simulated, and gas is estimated.
- **Submitted** — a wallet-approved transaction hash exists and Wallet is waiting for a receipt.
- **Confirmed** — the receipt succeeded and canonical state can be reloaded.
- **Action blocked** — submission did not occur, confirmation failed, or chain/account state changed.

A missing receipt is not reported as success. A reverted receipt is reported as a failed transaction.

## Error recovery

The management surface exposes a dedicated recovery message and restores focus to the action that failed.

Common recovery paths:

- wrong network or chain change — switch back to the qualified network, reconnect, and reload state;
- account change — reconnect and reload the name under the intended account;
- commitment too new — wait until the displayed reveal time;
- commitment expired — submit a fresh commitment;
- name unavailable — choose another name or wait for the current lease to expire;
- simulation/gas failure — reload canonical state and correct the conflicting input before retrying;
- wallet rejection — review the transaction and retry only if intended;
- confirmation timeout — check the transaction on the configured explorer/RPC before attempting another state-changing action.

Never assume a write succeeded merely because the wallet was opened. Treat the confirmed receipt and refreshed canonical Names420 state as authoritative.
