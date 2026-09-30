# 420 Names troubleshooting

## Management UI says a qualified deployment is required

420 Wallet intentionally does not guess a Names420 address. Use a runtime generated from a qualified chain-specific deployment manifest containing `deployment.namesAddress`.

## Wallet state changed

If the connected account or chain changes, the management state is invalidated. Reconnect and reload canonical Names420 state before submitting another transaction.

## Commit succeeded but reveal is blocked

Use **Check commitment**. Registration cannot occur before the minimum commitment age and cannot occur after the maximum commitment age. If the commitment expired, create a fresh commitment with the same or a new salt.

## Registration says the name is unavailable

The lease is still active. Names420 prevents an active record from being overwritten. Recheck availability later or choose another canonical lowercase ASCII label.

## A write fails during preflight

Every write is simulated and gas-estimated before wallet submission. A preflight failure means the transaction was not broadcast by the management client. Reload canonical state, verify ownership/pending ownership/forward resolution, correct the input, and retry.

## Wallet approval was rejected

No transaction is treated as submitted. Review the requested action and retry only if you intend to perform it.

## Transaction is submitted but not confirmed

Do not assume success and do not blindly resubmit. Check the transaction hash against the configured network/explorer or RPC. The Wallet management surface reports confirmation only after a successful receipt.

## Renewal fails

Confirm that:

- the connected account is still the current owner;
- the lease has not already expired;
- the added duration is between 30 and 365 days.

## Reverse resolution is missing

The connected address must still be the active forward target and the lease must remain unexpired. Updating the forward target invalidates stale reverse resolution automatically.

## Transfer acceptance fails

Confirm that the connected address exactly matches the current `pendingOwner`. A later transfer nomination replaces the earlier pending owner.

After successful acceptance, forward resolution resets to the new owner and old profile/service references are cleared.

## Resolution looks stale

Reload the canonical record directly from Names420. Indexer/Search/Wallet caches are derived consumers and are not authoritative when they disagree with chain state.
