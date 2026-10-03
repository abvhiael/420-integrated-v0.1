// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";

interface IComputeVerifierDisputeStakeAuthorizer420 {
    function authorize(
        bytes32 positionId,
        uint8 subjectKind,
        uint32 slashPolicyRevision,
        bytes32 evidenceRef
    ) external returns (bytes32 authorizationRef, uint256 amount);
}

interface IComputeVerifierDisputeStakeController420 {
    function stakeDispositionPending(bytes32 disputeId) external view returns (bool);
    function acknowledgeStakeDisposition(bytes32 disputeId, bytes32 authorizationRef) external;
}

/// @notice Atomic CMP-1.5.8 hand-off from a finalized objective verifier dispute to slash reservation.
/// @dev The dispute hold is released only after the slash authorizer has successfully recorded a
///      nonzero authorization, so verifier collateral cannot race withdrawal between finality and
///      objective slash reservation.
contract ComputeVerifierDisputeStakeIntegration420 is I420System {
    IComputeVerifierDisputeStakeController420 public immutable disputes;
    IComputeVerifierDisputeStakeAuthorizer420 public immutable slashAuthorizer;

    error InvalidIntegration();

    event VerifierDisputeStakeAuthorized(
        bytes32 indexed disputeId,
        bytes32 indexed positionId,
        bytes32 indexed authorizationRef,
        uint32 slashPolicyRevision,
        uint256 amount
    );

    constructor(address disputes_, address slashAuthorizer_) {
        if (disputes_.code.length == 0 || slashAuthorizer_.code.length == 0) {
            revert InvalidIntegration();
        }
        disputes = IComputeVerifierDisputeStakeController420(disputes_);
        slashAuthorizer = IComputeVerifierDisputeStakeAuthorizer420(slashAuthorizer_);
    }

    function systemName() external pure returns (string memory) {
        return "ComputeVerifierDisputeStakeIntegration420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function authorizeFinalDispute(
        bytes32 disputeId,
        bytes32 positionId,
        uint32 slashPolicyRevision
    ) external returns (bytes32 authorizationRef, uint256 amount) {
        if (
            disputeId == bytes32(0)
                || positionId == bytes32(0)
                || slashPolicyRevision == 0
                || !disputes.stakeDispositionPending(disputeId)
        ) revert InvalidIntegration();

        (authorizationRef, amount) =
            slashAuthorizer.authorize(positionId, 2, slashPolicyRevision, disputeId);
        if (authorizationRef == bytes32(0) || amount == 0) revert InvalidIntegration();

        disputes.acknowledgeStakeDisposition(disputeId, authorizationRef);

        emit VerifierDisputeStakeAuthorized(
            disputeId,
            positionId,
            authorizationRef,
            slashPolicyRevision,
            amount
        );
    }
}
