// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/GenesisResidentAccess420.sol";
import "./PayIds420.sol";

contract SettlementRouter420 is GenesisResidentAccess420 {
    uint256 public constant MAX_RECIPIENTS = 8;
    uint256 public constant BPS = 10_000;

    event NativeSettlement(bytes32 indexed paymentId, address indexed asset, uint256 amount);
    event SplitPaid(bytes32 indexed paymentId, address indexed recipient, uint256 amount, uint16 bps);

    constructor(address timelock_, address registry_, bytes32 genesisConfigHash_)
        GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_)
    {}

    function componentId() public pure override returns (bytes32) { return PayIds420.SETTLEMENT_ROUTER; }

    function validateSplit(address[] calldata recipients, uint16[] calldata bps, uint8 primaryIndex)
        public
        pure
        returns (bool)
    {
        require(recipients.length > 0 && recipients.length <= MAX_RECIPIENTS, "recipient count");
        require(recipients.length == bps.length, "length");
        require(primaryIndex < recipients.length, "primary");
        uint256 total;
        for (uint256 i; i < bps.length; i++) {
            require(recipients[i] != address(0), "zero recipient");
            total += bps[i];
        }
        require(total == BPS, "split total");
        return true;
    }

    function splitAmounts(uint256 amount, uint16[] calldata bps, uint8 primaryIndex)
        external
        pure
        returns (uint256[] memory amounts)
    {
        require(bps.length > 0 && bps.length <= MAX_RECIPIENTS && primaryIndex < bps.length, "shape");
        uint256 totalBps;
        amounts = new uint256[](bps.length);
        uint256 assigned;
        for (uint256 i; i < bps.length; i++) {
            totalBps += bps[i];
            amounts[i] = (amount * bps[i]) / BPS;
            assigned += amounts[i];
        }
        require(totalBps == BPS, "split total");
        amounts[primaryIndex] += amount - assigned;
    }

    function requireHealthy(address settlementAsset, bytes32 marketId, bool conversionRequired) public view {
        _canonicalSettlementAsset(settlementAsset);
        if (conversionRequired) _requireHealthyMarket(marketId);
    }
}
