// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
/// @dev Only for preserving pre-existing adapter/verifier boundary regressions.
/// It does not qualify a real token route; SupportedTokenRoutes420.t.sol uses the actual registry.
contract TokenPolicyBoundaryFixture420 {
 function componentId() external pure returns(bytes32){return keccak256("420/APP/420BRIDGE/ASSET_REGISTRY");}
 function qualifyTokenTransfer(bytes32,bytes32,bytes32,bytes32,address,bytes32,uint256 amount,bool) external pure returns(uint256){return amount;}
}
