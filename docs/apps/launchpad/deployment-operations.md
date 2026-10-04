# 420 Launchpad deployment and Registry publication

`LAUNCHPAD-AUDIT-4` freezes the repository-side release materialization for the Launchpad protocol and its crowdfunding integration. It does not claim a live public-testnet deployment.

## Address policy

- `LaunchpadRouter420` remains `REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS`.
- No new Genesis predeploy is introduced.
- No CREATE2 policy is invented.
- Historical candidate `0x000000000000000000000000000000000000045c` is superseded and must not be used as an active address.
- Canonical discovery is through `ProtocolRegistry` at the frozen Registry authority once a governed live deployment exists.

## Repository deployment sequence

1. deploy `LaunchpadAuthorization420(CapabilityRegistry420)`;
2. deploy `LaunchpadProjectRegistry420(GovernanceTimelock)`;
3. deploy `LaunchpadSaleRegistry420(GovernanceTimelock, LaunchpadProjectRegistry420)`;
4. deploy `LaunchpadAllocationRegistry420(LaunchpadAuthorization420, LaunchpadSaleRegistry420)`;
5. execute one-time `LaunchpadSaleRegistry420.setController(LaunchpadAllocationRegistry420)`;
6. deploy `LaunchpadCrowdfundingIntegration420(LaunchpadAllocationRegistry420, PaymentRegistry420, Identity420, ArbitrationCaseRegistry420, ArbitrationRulingRegistry420)`;
7. execute one-time `LaunchpadAllocationRegistry420.setCrowdfundingIntegration(LaunchpadCrowdfundingIntegration420)`;
8. deploy `LaunchpadRouter420(LaunchpadSaleRegistry420, LaunchpadAllocationRegistry420)`;
9. register the canonical `420/COMPONENT/LAUNCHPAD/V1` component to the exact router in ProtocolRegistry;
10. publish `420/service/launchpad/v1` with `publishRegisteredService`.

## Identity and verification

The exact build uses Solidity 0.8.24, Cancun EVM, optimizer 200 runs and via-IR. Qualification retains compiled artifact SHA-256, canonical ABI SHA-256, runtime-template SHA-256, local deployed EXTCODEHASH values, the Registry dependency root, manifest commitment and interface commitment.

The local deployment test proves the exact constructor graph, both one-shot post-initialization bindings, router smoke reads, ProtocolRegistry active service/component resolution and wrong-router visibility.

## Live boundary

Local Foundry addresses and runtime identities are repository qualification evidence only. Public-testnet chain identity, deployed addresses, deployment transactions, Registry publication transactions, live code hashes and constructor-binding receipts are owned by `LAUNCHPAD-AUDIT-6` and remain unset until that live step.
