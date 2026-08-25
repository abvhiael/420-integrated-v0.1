// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
interface IFeeQuote420 {
    struct FeeQuote {
        bytes32 quoteId; uint256 protocolFee; uint256 networkFee; uint256 providerFee;
        uint256 conversionFee; uint256 slippageAmount; uint64 quotedAt; uint64 expiresAt;
    }
    function feeQuote(bytes32 contextId,bytes calldata request) external view returns (FeeQuote memory);
}
