
# CADC Bridge Integration and 420 Swap Market Tiers

CADC is configured as the intended canonical CAD quote asset, pending an issuer-approved 420
deployment. The protocol will not deploy an unofficial wrapped CADC and present it as canonical.

The 420-side CADC integration contract is a configuration/verification guard only. It never mints,
burns or custodies CADC. Actual cross-chain movement must use the issuer-approved LayerZero OFT or
OFTAdapter pathway.

420 Swap has two market tiers:

## Canonical tier

Governance/genesis curated. Eligible for wallet defaults, canonical oracle use and public-distribution
references after qualification.

Initial target markets:
- 420/USDC — canonical USD
- 420/CADC — canonical CAD, pending CADC integration
- CADC/USDC — canonical FX cross-check, pending CADC integration
- WETH/USDC — approved secondary

## Permissionless tier

Anyone may create/register markets. Permissionless markets receive no protocol endorsement,
canonical oracle role or public-distribution role by default.

This separates open market formation from the much stronger claim that the protocol considers a
particular asset representation or market suitable for canonical pricing.
