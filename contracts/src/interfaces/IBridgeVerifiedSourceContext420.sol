// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Adapter-published identity derived from the verified source message, not caller envelope claims.
/// @dev A missing implementation must fail closed in GatewayRouter420.
interface IBridgeVerifiedSourceContext420 {
    function verifiedSourceContext(bytes32 messageId) external view returns (bytes32 gateway, bytes32 sourceAsset);
}
