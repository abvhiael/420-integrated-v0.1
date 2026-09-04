// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";

contract ExchangeFeePolicy420 is SystemAccess {
    uint16 public constant BPS_DENOMINATOR = 10_000;
    uint16 public constant MAX_EXCHANGE_FEE_BPS = 100;
    uint16 public constant MAX_DEVELOPER_SHARE_BPS = 1_000;

    struct FeeSplit {
        uint16 protocolTreasuryBps;
        uint16 developmentBps;
        uint16 communityBps;
        uint16 liquidityIncentivesBps;
        uint16 developerPaymentBps;
    }

    struct Recipients {
        address protocolTreasury;
        address developmentFund;
        address communityFund;
        address liquidityIncentives;
        address developmentCompensationVault;
    }

    uint16 public exchangeFeeBps;
    FeeSplit public feeSplit;
    Recipients public recipients;

    event ExchangeFeeSet(uint16 exchangeFeeBps);
    event FeeSplitSet(uint16 protocolTreasuryBps, uint16 developmentBps, uint16 communityBps, uint16 liquidityIncentivesBps, uint16 developerPaymentBps);
    event FeeRecipientsSet(address protocolTreasury, address developmentFund, address communityFund, address liquidityIncentives, address developmentCompensationVault);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function setExchangeFee(uint16 newFeeBps) external onlyGovernance {
        require(newFeeBps <= MAX_EXCHANGE_FEE_BPS, "fee cap");
        if (newFeeBps != 0) require(isOperational(), "fee policy incomplete");
        exchangeFeeBps = newFeeBps;
        emit ExchangeFeeSet(newFeeBps);
    }

    function setFeeSplit(FeeSplit calldata split) external onlyGovernance {
        uint256 total = uint256(split.protocolTreasuryBps)
            + split.developmentBps
            + split.communityBps
            + split.liquidityIncentivesBps
            + split.developerPaymentBps;
        require(total == BPS_DENOMINATOR, "split total");
        require(split.developerPaymentBps <= MAX_DEVELOPER_SHARE_BPS, "developer cap");
        feeSplit = split;
        emit FeeSplitSet(
            split.protocolTreasuryBps,
            split.developmentBps,
            split.communityBps,
            split.liquidityIncentivesBps,
            split.developerPaymentBps
        );
    }

    function setRecipients(Recipients calldata next) external onlyGovernance {
        require(next.protocolTreasury != address(0), "treasury");
        require(next.developmentFund != address(0), "development");
        require(next.communityFund != address(0), "community");
        require(next.liquidityIncentives != address(0), "liquidity");
        require(next.developmentCompensationVault != address(0), "developer vault");
        recipients = next;
        emit FeeRecipientsSet(
            next.protocolTreasury,
            next.developmentFund,
            next.communityFund,
            next.liquidityIncentives,
            next.developmentCompensationVault
        );
    }

    function isOperational() public view returns (bool) {
        FeeSplit memory split = feeSplit;
        Recipients memory next = recipients;
        uint256 total = uint256(split.protocolTreasuryBps)
            + split.developmentBps
            + split.communityBps
            + split.liquidityIncentivesBps
            + split.developerPaymentBps;
        return total == BPS_DENOMINATOR && split.developerPaymentBps <= MAX_DEVELOPER_SHARE_BPS
            && next.protocolTreasury != address(0) && next.developmentFund != address(0)
            && next.communityFund != address(0) && next.liquidityIncentives != address(0)
            && next.developmentCompensationVault != address(0);
    }
}
