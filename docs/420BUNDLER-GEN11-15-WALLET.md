# GEN-11.15 — 420Wallet Bundler transport and provider fallback

The opt-in Wallet transport is implemented by `wallet/web/core/bundler-transport.js` and `wallet/web/core/bundler-session.js`. The existing direct `EntryPoint420.handleOp` transport remains available independently. Neither transport grants custody, session authorization or finality authority to a Bundler.

## Application integration

A Wallet surface that already uses `prepareSessionUserOperationTransport` can call `sendPreparedSessionViaBundler(provider, prepared, endpoints, {chainId})`, then poll `confirmSessionViaBundler(submitted)`. The alternate `sendSessionViaBundler` prepares and sends in one step. These are opt-in application APIs; the existing Wallet session-execution UI continues to use direct EntryPoint submission until the UI is explicitly configured to select Bundler mode. Do not assume the UI is switched over just because the shared transport exists.

`endpoints` is an ordered list of 1–8 operator URLs. The Wallet validates URL schemes, disallows embedded credentials/query/fragment and duplicate endpoints, and accepts HTTPS except explicit local development loopback HTTP. Operator selection calls `eth_supportedEntryPoints` against each endpoint until it finds one that advertises the prepared canonical EntryPoint. Provider choice occurs **before** any send. The first operator failing preflight does not block an independent second operator.

The Wallet rechecks the live chain if `chainId` is specified, session signer availability, session grant/nonce authority, and the canonical `getUserOpHash` output before it relays an already signed operation. Its JSON-RPC envelope serializes all nine packed operation fields using canonical hex quantities and bytes. A response hash different from the locally calculated canonical hash is rejected.

After `eth_sendUserOperation` has been attempted, a timeout or ambiguous network error **does not** cause automatic submission to another operator. The first provider could already have accepted the operation. An application should retain the signed UserOperation hash and reconcile the original provider, or explicitly obtain user approval before initiating a new relay attempt. Successful relay returns the UserOperation hash and provider endpoint, not a fabricated transaction hash.

`eth_getUserOperationReceipt` returns null while no canonical inclusion proof is available. A non-null receipt must match the expected operation hash and EntryPoint and include well-formed transaction/block hashes, canonical block-number quantity, boolean execution outcome and the nonfinal `included` lifecycle label. The Bundler's server-side lifecycle reconciliation provides canonical block/event checks; the Wallet treats this result as current inclusion, **not finality**.

The standalone integration test `wallet/web/test/bundler-transport.test.js` exercises field serialization, endpoint validation, pre-send operator fallback, no blind retry after an uncertain send, canonical hash matching, null receipts and malformed/mismatched receipt rejection.

## Boundaries / follow-up

This phase adds a callable application integration path and preserves the existing direct transport as an explicit fallback option. It does not silently turn on relay in the current session UI, change extension/mobile broadcast flows, or configure live provider URLs; those require per-surface rollout and device/browser acceptance. The public Bundler service must be reachable over an approved origin and any browser deployment must configure CORS as appropriate; the current server does not automatically assert browser cross-origin reachability.
