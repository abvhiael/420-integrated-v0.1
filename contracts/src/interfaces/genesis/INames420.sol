// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Read interface for the canonical Names420 resolver.
/// @dev The Record layout and resolve return type MUST remain ABI-compatible with Names420.
///      A historical v1 interface incorrectly decoded resolve(bytes32) as a single address,
///      which would read Record.owner rather than Record.resolvedAddress.
interface INames420 {
    struct Record {
        address owner;
        address pendingOwner;
        address resolvedAddress;
        bytes32 profileId;
        bytes32 serviceId;
        uint64 expiresAt;
        uint8 labelLength;
    }

    function resolve(bytes32 labelHash) external view returns (Record memory);
    function reverseResolve(address account) external view returns (bytes32 labelHash);
    function nameClaimsProfile(bytes32 labelHash, bytes32 profileId) external view returns (bool);
}
