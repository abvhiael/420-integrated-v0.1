---
title: 420 Bridge integration
audience:
  - developer
category: developer
status: development
version: current
---

# 420 Bridge integration

420 Bridge admits external chains/assets through explicit chain identity, asset representation, route, verifier/adapter, risk and replay controls. A valid foreign-chain proof is necessary evidence, but it is never sufficient by itself to move value.

## Safe inbound flow

For an inbound transfer:

1. resolve the exact external chain identity/network fingerprint;
2. resolve the canonical bridge asset ID and local representation;
3. resolve an ACTIVE route with inbound enabled;
4. verify the route's adapter/verifier configuration and source-finality requirement;
5. wait until the foreign source transaction/message satisfies that finality policy;
6. submit the proof through the approved adapter/router;
7. recheck local asset usability, route health/direction, risk capacity and replay state;
8. follow the canonical bridge transfer lifecycle through verified/destination-pending/completed states;
9. wait for required local finality before presenting irreversible completion.

Do not identify a route from ticker symbol alone. The UI should show the exact source network and canonical local asset representation.

## Safe outbound flow

For outbound movement, the same canonical route/asset/risk/replay checks occur before the adapter initiates an external message. A local submission or burn/lock transaction is not proof that the destination chain completed the release.

## Chain identity

`BridgeChainRegistry420` binds a route-chain identifier to an explicit network fingerprint/verifier family/chain family. Numeric chain IDs alone may be insufficient to distinguish forks, testnets or other external networks.

Applications should treat the route's configured chain identity as the canonical bridge identity source, not a provider-supplied display label.

## Asset and route qualification

An active bridge asset must agree with the shared canonical-asset registry. A route binds asset, source/destination chains, source/destination asset identities, adapter ID, verifier configuration, version/status and independent direction flags.

An adapter that can parse a proof cannot bypass a suspended route, disabled direction or ineligible asset.

## Risk and replay

Before accepting value movement, Bridge rechecks route-level and asset-level transfer/hour/day/TVL constraints plus shared risk policy. Risk exhaustion fails closed even when the external proof is valid.

Transfer identity is replay-protected using route/asset/sender/recipient/amount/source transaction/message inputs. Retrying after an uncertain response must first query canonical transfer state; do not blindly resubmit a value-moving request with a new identity.

## Proof and finality semantics

Foreign-chain proofs must satisfy the verifier/finality rules configured for that exact route. Different chain families may require different confirmation, finalized-block, receipt-root, light-client or attestation semantics.

Bridge proof validity does not grant general Oracle authority and does not make an external asset trade-eligible in Exchange. Exchange and Bridge independently requalify their own dependencies.

## Accounting and incidents

Bridge accounting records authorized-versus-observed supply evidence and health. It cannot mint, burn or repair balances by itself.

If reconciliation is unhealthy, halt/escalate according to safety policy and reconcile canonical state. Do not "fix" the discrepancy by mutating balances from an off-chain spreadsheet or provider report.

## Failure handling

- route/direction suspended: reject new movement;
- proof valid but risk exhausted: fail closed;
- duplicate transfer identity: reject under replay protection;
- provider/adapter unavailable: preserve canonical transfer state and resume with an approved replacement path if governance/configuration allows;
- source-finality disagreement: do not release irreversible destination value;
- Indexer/provider disagreement: recover from canonical Bridge contracts/RPC first, then rebuild projections.

## Related architecture

- [Pay, Token, Swap/Exchange and Bridge](../architecture/protocols/pay-token-exchange-bridge.md)
- [420 Bridge application manual](../apps/bridge/index.md)
- [Provider-backed integration model](provider-backed-integrations.md)
- [Events, logs and finality](events-and-finality.md)
