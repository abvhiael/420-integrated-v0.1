// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Public 420-to-Ethereum request transport. A request is not custody-release authority.
interface IEthereumOutboundMessage420 {
    struct OutboundMessage {
        uint256 sourceChainId;
        address sourceRouter;
        address sourceAdapter;
        bytes32 messageId;
        bytes32 routeId;
        bytes32 assetId;
        address sender;
        address recipient;
        uint256 localAmount;
        uint256 ethereumAmount;
        bytes32 ethereumAsset;
        uint256 nonce;
        bytes extra;
    }
    function outboundMessage(bytes32 messageId) external view returns (OutboundMessage memory);
}
