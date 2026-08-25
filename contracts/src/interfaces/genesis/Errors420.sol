// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
library Errors420 {
    error Unauthorized();
    error InvalidAddress();
    error InvalidIdentifier();
    error InactiveComponent(bytes32 componentId);
    error Paused(bytes32 scopeId);
    error Unhealthy(bytes32 subjectId);
    error UnsupportedAsset(bytes32 assetId);
    error UnsupportedVersion(bytes32 componentId,uint16 major,uint16 minor,uint16 patch);
    error StaleQuote(bytes32 quoteId);
    error Replay(bytes32 objectId);
    error LimitExceeded(bytes32 limitId,uint256 attempted,uint256 maximum);
    error SlippageExceeded(uint256 attemptedBps,uint256 maximumBps);
    error SettlementUnderpayment(uint256 delivered,uint256 required);
    error SpendLimitExceeded(uint256 attempted,uint256 maximum);
    error InvalidSignature();
    error Expired(uint64 expiry);
    error TimelockRequired();
}
