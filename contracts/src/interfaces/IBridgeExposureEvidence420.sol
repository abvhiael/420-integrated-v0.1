// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
/// Actual local asset creation, including separately minted native-provider fees.
interface IBridgeExposureEvidence420 {function exposureForMessage(bytes32 messageId) external view returns(uint256);}
