
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface ICanonicalSettlement420 {
    struct Quote {
        bytes32 quoteId;
        bytes32 marketId;
        address inputAsset;
        address settlementAsset;
        uint256 inputAmount;
        uint256 minimumSettlementAmount;
        uint256 quotedSettlementAmount;
        uint256 conversionFee;
        uint16 slippageBps;
        uint64 quotedAt;
    }

    function quote(
        bytes32 marketId,
        address inputAsset,
        address settlementAsset,
        uint256 inputAmount
    ) external view returns (Quote memory);

    function execute(
        Quote calldata q,
        address payer,
        address recipient,
        uint256 exactSettlementAmount
    ) external payable returns (uint256 inputSpent, uint256 settlementDelivered);
}
