# 420 Names developer integration

Resolve against canonical `Names420` state for security-sensitive use. Require unexpired records and treat optional profile/service links as references, not ambient authority.

## Canonical resolver ABI

The canonical `resolve(bytes32)` call returns the complete `Names420.Record` tuple:

1. `owner`
2. `pendingOwner`
3. `resolvedAddress`
4. `profileId`
5. `serviceId`
6. `expiresAt`
7. `labelLength`

Do **not** treat the first returned address (`owner`) as the forward-resolution target. Value-transfer and presentation clients must use `resolvedAddress`, verify the record is unexpired, and re-resolve immediately before a security-sensitive action.

The shared Solidity read interface is `contracts/src/interfaces/genesis/INames420.sol` and must remain ABI-compatible with the canonical contract.

For Identity display, enforce bilateral binding rather than trusting one-sided pointers.
