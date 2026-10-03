// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeVerifierDisputeStakeIntegration420.sol";

contract MockVerifierDisputeStakeController420
    is IComputeVerifierDisputeStakeController420
{
    mapping(bytes32 => bool) public override stakeDispositionPending;
    mapping(bytes32 => bytes32) public authorization;

    function setPending(bytes32 disputeId, bool value) external {
        stakeDispositionPending[disputeId] = value;
    }

    function acknowledgeStakeDisposition(
        bytes32 disputeId,
        bytes32 authorizationRef
    ) external {
        require(stakeDispositionPending[disputeId], "not pending");
        require(authorizationRef != bytes32(0), "zero authorization");
        stakeDispositionPending[disputeId] = false;
        authorization[disputeId] = authorizationRef;
    }
}

contract MockVerifierDisputeStakeAuthorizer420
    is IComputeVerifierDisputeStakeAuthorizer420
{
    bytes32 public lastPosition;
    uint8 public lastKind;
    uint32 public lastRevision;
    bytes32 public lastEvidence;
    bool public fail;

    function setFail(bool value) external {
        fail = value;
    }

    function authorize(
        bytes32 positionId,
        uint8 subjectKind,
        uint32 slashPolicyRevision,
        bytes32 evidenceRef
    ) external returns (bytes32 authorizationRef, uint256 amount) {
        if (fail) revert("authorizer failure");
        lastPosition = positionId;
        lastKind = subjectKind;
        lastRevision = slashPolicyRevision;
        lastEvidence = evidenceRef;
        authorizationRef = keccak256(
            abi.encode(positionId, subjectKind, slashPolicyRevision, evidenceRef)
        );
        amount = 4 ether;
    }
}

contract ComputeVerifierDisputeStakeIntegration420Test {
    bytes32 private constant DISPUTE = keccak256("cmp-1.5.8/dispute");
    bytes32 private constant POSITION = keccak256("cmp-1.5.8/position");

    MockVerifierDisputeStakeController420 private disputes;
    MockVerifierDisputeStakeAuthorizer420 private authorizer;
    ComputeVerifierDisputeStakeIntegration420 private integration;

    function setUp() public {
        disputes = new MockVerifierDisputeStakeController420();
        authorizer = new MockVerifierDisputeStakeAuthorizer420();
        integration = new ComputeVerifierDisputeStakeIntegration420(
            address(disputes),
            address(authorizer)
        );
        disputes.setPending(DISPUTE, true);
    }

    function testFinalDisputeAuthorizesSlashBeforeReleasingStakeDisposition() public {
        (bytes32 authorizationRef, uint256 amount) =
            integration.authorizeFinalDispute(DISPUTE, POSITION, 3);

        require(amount == 4 ether, "slash amount");
        require(authorizationRef != bytes32(0), "authorization");
        require(authorizer.lastPosition() == POSITION, "position");
        require(authorizer.lastKind() == 2, "subject kind");
        require(authorizer.lastRevision() == 3, "slash policy revision");
        require(authorizer.lastEvidence() == DISPUTE, "evidence ref");
        require(!disputes.stakeDispositionPending(DISPUTE), "stake hold not released");
        require(
            disputes.authorization(DISPUTE) == authorizationRef,
            "authorization not acknowledged"
        );
    }

    function testAuthorizerFailureLeavesStakeDispositionPending() public {
        authorizer.setFail(true);
        (bool ok,) = address(integration).call(
            abi.encodeCall(
                integration.authorizeFinalDispute,
                (DISPUTE, POSITION, uint32(3))
            )
        );
        require(!ok, "failed slash authorization accepted");
        require(disputes.stakeDispositionPending(DISPUTE), "hold released on failure");
        require(disputes.authorization(DISPUTE) == bytes32(0), "fake authorization");
    }

    function testNoPendingDispositionCannotAuthorize() public {
        disputes.setPending(DISPUTE, false);
        (bool ok,) = address(integration).call(
            abi.encodeCall(
                integration.authorizeFinalDispute,
                (DISPUTE, POSITION, uint32(3))
            )
        );
        require(!ok, "nonpending dispute authorized");
    }
}
