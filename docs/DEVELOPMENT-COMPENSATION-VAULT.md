# Development Compensation Vault V1

`DevelopmentCompensationVault420` is the canonical routing component for the lead-developer share of eligible first-party application revenue under Application Revenue Policy V1.

## Purpose

The vault gives 420 Integrated a transparent way to compensate the lead developer without changing consensus economics or granting special validator treatment. It receives only the developer-compensation slice of net protocol revenue from explicitly authorized application contracts and atomically forwards that amount to the configured **420 Integrated Labs** beneficiary wallet.

The V1 default commercial application split assigns 10% of net protocol revenue to lead-developer compensation. The vault enforces a hard V1 ceiling of 1,000 basis points (10%). Applications may use a lower approved percentage. Application-specific exceptions remain separate and must be documented explicitly.

## Revenue boundary

The vault must never be funded from validator rewards, block rewards, staking principal, bridge collateral/backing, user principal, escrow, LP principal, provider obligations, refunds, or unclaimed user rewards. The `grossProtocolRevenue` value supplied to a contribution represents revenue already determined by the originating application's accounting rules to be net protocol revenue eligible for distribution.

## Authorization

There is no owner-only contribution path and no arbitrary source allowlist stored inside the vault. Source applications require a default-deny `CapabilityRegistry420` grant for `ACTION_CONTRIBUTE_REVENUE`, scoped to the source application identifier and constrained by the Capability Registry's amount/time limits.

## Beneficiary

The beneficiary identity is canonically identified as:

`420/REVENUE/BENEFICIARY/420_INTEGRATED_LABS/V1`

The actual wallet address is supplied as explicit deployment configuration. V1 intentionally makes the beneficiary address immutable after deployment. If the 420 Integrated Labs wallet must change because of migration, security, governance, or operational reasons, a new authorized vault version should be deployed and the source application capabilities migrated. This avoids a hidden administrative fee redirect.

## Contribution flow

Each contribution includes:

- source application ID;
- unique application revenue reference;
- application revenue policy reference;
- net protocol revenue amount used as the split basis;
- developer compensation percentage in basis points;
- asset and compensation amount.

The vault recomputes the expected compensation amount and rejects a contribution unless the transferred amount exactly equals the policy calculation. Revenue references are replay-protected per source contract and source application.

Native $420 is forwarded atomically to the beneficiary. ERC-20 contributions are transferred directly from the authorized source to the beneficiary using exact pre/post balance checks. Fee-on-transfer or otherwise non-exact token behavior fails closed.

## Generic creator treasuries

`ApplicationRevenueRegistry420` complements the Development Compensation Vault by providing a generic protocol-recognized `creatorTreasury` profile for both first-party and third-party applications.

Each application profile records its creator treasury address, creator account, revenue-policy ID, treasury kind, creator-share basis points, metadata commitment, revision and active status. Supported treasury kinds are smart accounts, 420Vault-compatible vaults, and application contracts.

The registry is declarative. It does not hold application revenue and does not execute fee splits. A fee-bearing dApp remains responsible for calculating its own revenue base and routing the amounts specified by its economic policy. Wallet, Explorer, AppStore, Analytics and other clients can use the registry to display where creator revenue is intended to go and which policy applies.

Profile management uses application-scoped Capability Registry grants. A developer authorized for Application A cannot change Application B's creator treasury. Revoking the capability fails closed for future profile changes. Profiles are revisioned and may be deactivated.

Third-party creator revenue is separate from 420 Integrated Labs compensation. A third-party application may configure a creator share from 0 to 10,000 basis points of revenue remaining after mandatory user, provider and protocol obligations. The Development Compensation Vault's 1,000-basis-point ceiling applies only to the 420 Integrated Labs lead-developer allocation under the first-party Application Revenue Policy.

## Non-custody

The Development Compensation Vault has no generic withdrawal function. Direct native deposits revert. Accepted revenue contributions are immediately forwarded, so the contract is not intended to maintain a working balance. It cannot spend from user wallets, alter application accounting, mint tokens, change fees, redirect block rewards, or seize funds from another protocol component.

`ApplicationRevenueRegistry420` likewise has no custody or transfer functions.

## Auditability

Every successful Development Compensation contribution emits `DevelopmentCompensationForwarded`, recording the source, application ID, revenue reference, asset, beneficiary, declared net protocol revenue, compensation basis points, compensation amount, and policy reference.

Every creator-treasury profile change emits a revisioned `ApplicationRevenueProfileSet` or `ApplicationRevenueProfileDeactivated` event. Explorer and Analytics can therefore reconstruct both the declared revenue destination and actual 420 Integrated Labs compensation flows without relying on an off-chain accounting statement.
