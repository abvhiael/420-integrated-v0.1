// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
interface IBridgeAdapter420 {
    struct VerifiedTransfer { bytes32 routeId; bytes32 assetId; address sender; address recipient; uint256 amount; bytes32 sourceTxId; bytes32 sourceMessageId; }
    function adapterId() external view returns(bytes32);
    function verifyInbound(bytes calldata proof) external returns(VerifiedTransfer memory);
    function initiateOutbound(bytes32 routeId,bytes32 assetId,address sender,bytes calldata recipient,uint256 amount,bytes calldata extra) external payable returns(bytes32 sourceMessageId);
}
