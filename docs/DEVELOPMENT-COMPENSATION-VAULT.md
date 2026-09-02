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

## Non-custody

The vault has no generic withdrawal function. Direct native deposits revert. Accepted revenue contributions are immediately forwarded, so the contract is not intended to maintain a working balance. It cannot spend from user wallets, alter application accounting, mint tokens, change fees, redirect block rewards, or seize funds from another protocol component.

## Auditability

Every successful contribution emits `DevelopmentCompensationForwarded`, recording the source, application ID, revenue reference, asset, beneficiary, declared net protocol revenue, compensation basis points, compensation amount, and policy reference. Explorer and Analytics can therefore reconstruct compensation flows without relying on an off-chain accounting statement.
