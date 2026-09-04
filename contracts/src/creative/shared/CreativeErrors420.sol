// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library CreativeErrors420 {
    error Unauthorized();
    error ZeroAddress();
    error InvalidId();
    error AlreadyExists();
    error NotFound();
    error InvalidState();
    error InvalidTransition();
    error InvalidSplitTotal(uint256 totalBps);
    error TooManyRightsHolders(uint256 count);
    error DuplicateHolder(uint256 profileId);
    error ShareNotAccepted(uint256 profileId);
    error SplitAlreadyFinalized();
    error InsufficientRights(uint256 availableBps, uint256 requestedBps);
    error TransferNotPending();
    error StaleRightsVersion(uint32 expected, uint32 actual);
    error MissingAuthorization();
    error InvalidPermissionMask();
    error LicenseExpired();
    error LicenseExhausted();
    error InvalidPayment(uint256 expected, uint256 actual);
    error InvalidSchedule();
    error ProtocolFeeTooHigh(uint16 protocolBps);
    error RevenueAlreadyProcessed(bytes32 settlementId);
    error InvalidSource();
    error TransferFailed();
    error AccountingNotConfigured();
    error OnlyRightsRegistry();
    error OnlyRoyaltyRouter();
}
