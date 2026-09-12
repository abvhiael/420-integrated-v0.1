---
title: Transaction preparation and simulation
audience:
  - developer
category: developer
status: development
version: current
---

# Transaction preparation and simulation

A 420 Integrated dApp should prepare intent and let 420 Wallet own user review, authorization and signing. Applications should never need raw signing secrets.

## Prepare the smallest useful intent

Before handing an operation to Wallet, bind the request to:

- the exact network/environment;
- the intended Smart Account;
- the canonical target contract discovered for the active service/version;
- the exact function selector and calldata;
- native value, token amount or other value-bearing parameters;
- deadlines/slippage/quote identifiers where the owning protocol requires them;
- any capability/session scope needed by the operation.

Do not build transactions from stale copied addresses or unverified UI labels.

## Simulate before authorization

Wallet-side simulation should answer whether the prepared operation is likely to execute under the current state and should surface material effects the user needs to review.

Simulation is advisory and time-sensitive. It does not reserve state or guarantee later execution.

Before submission, a qualified Wallet runtime should revalidate security-sensitive account state that could have changed since preparation, including owner, `authorizationEpoch`, expected EntryPoint/capability-registry bindings and any capability/session requirements.

## Batch execution

`SmartAccount420.executeBatch()` permits multiple calls under owner/EntryPoint authority. Batch composition should remain explicit in the review surface.

Applications should not hide unrelated authority-changing or value-moving actions inside a convenience batch. If one call in the account execution path reverts, the application must interpret the resulting transaction according to canonical receipt/state rather than assuming partial success from local intent state.

## UserOperation transport

Account-abstraction flows should be handed to the qualified Wallet runtime for UserOperation construction, nonce-lane selection, signature method and EntryPoint submission.

Do not guess nonce lanes for owner, passkey or session-key authority. The Smart Account validation rules are canonical.

## State changes between simulation and signing

Prepared operations should be discarded and rebuilt when material state changes, including:

- network/environment changes;
- target implementation/version changes;
- owner changes;
- authorization-epoch changes;
- session/capability revocation or expiry;
- quote/deadline expiry;
- unexpected balance/allowance/nonce changes;
- recovery entering or completing a security-sensitive transition.

A UI may explain why re-preparation is necessary, but it must not silently submit stale intent.

## After submission

Treat provider/Wallet submission acknowledgement as transport evidence only. Confirm from canonical chain state:

1. transaction or UserOperation inclusion;
2. receipt status;
3. expected account/target events where applicable;
4. resulting canonical protocol/account state;
5. the required finality level for the operation.

Indexer or Wallet activity views may improve UX but do not replace canonical confirmation for security-sensitive decisions.

## Error handling

Common safe outcomes include:

- **simulation revert** — show the failure and do not submit unchanged intent;
- **authorization changed** — refresh account state and rebuild;
- **network mismatch** — stop and require explicit environment correction;
- **capability/session denied** — request a narrower valid grant or fall back to explicit owner authorization;
- **submission unknown** — query canonical transaction/account state before retrying to avoid duplicate effects;
- **receipt failure** — do not infer state changes from the original intent.

## Related documentation

- [Wallet and Smart Account integration](wallet-and-smart-accounts.md)
- [Capabilities and sessions](capabilities-and-sessions.md)
- [Source of truth and finality](source-of-truth.md)
- [RPC and WebSocket access](rpc-and-websocket.md)
