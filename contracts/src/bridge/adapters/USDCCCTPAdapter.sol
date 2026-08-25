// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../interfaces/IBridgeAdapter420.sol";
contract USDCCCTPAdapter is IBridgeAdapter420 {
    function adapterId() external pure returns(bytes32){return keccak256(bytes("420/BRIDGE/USDCCCTPAdapter"));}
    function verifyInbound(bytes calldata) external pure returns(VerifiedTransfer memory){revert("production verifier not wired");}
    function initiateOutbound(bytes32,bytes32,address,bytes calldata,uint256,bytes calldata) external payable returns(bytes32){revert("production outbound path not wired");}
}
