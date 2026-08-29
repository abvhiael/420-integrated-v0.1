// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Canonical namespaces and proposal classes for the 420Civic protocol.
library CivicIds420 {
    enum ProposalClass {
        G1,
        G2,
        G3,
        G4
    }

    enum ProposalState {
        NONE,
        ACTIVE,
        PASSED,
        FAILED,
        QUEUED,
        EXECUTED,
        CANCELLED
    }

    bytes32 internal constant DOMAIN = keccak256("420CIVIC_V1");

    bytes32 internal constant ACTION_PROPOSE = keccak256("420CIVIC_ACTION_PROPOSE_V1");
    bytes32 internal constant ACTION_VOTE_COMMUNITY = keccak256("420CIVIC_ACTION_VOTE_COMMUNITY_V1");
    bytes32 internal constant ACTION_VOTE_VALIDATOR = keccak256("420CIVIC_ACTION_VOTE_VALIDATOR_V1");
    bytes32 internal constant ACTION_FINALIZE = keccak256("420CIVIC_ACTION_FINALIZE_V1");
    bytes32 internal constant ACTION_QUEUE = keccak256("420CIVIC_ACTION_QUEUE_V1");
    bytes32 internal constant ACTION_EXECUTE = keccak256("420CIVIC_ACTION_EXECUTE_V1");
    bytes32 internal constant ACTION_CANCEL = keccak256("420CIVIC_ACTION_CANCEL_V1");
    bytes32 internal constant ACTION_CONSTITUTION_UPDATE = keccak256("420CIVIC_ACTION_CONSTITUTION_UPDATE_V1");
    bytes32 internal constant ACTION_ELECTORATE_UPDATE = keccak256("420CIVIC_ACTION_ELECTORATE_UPDATE_V1");
    bytes32 internal constant ACTION_EMERGENCY = keccak256("420CIVIC_ACTION_EMERGENCY_V1");

    function proposalId(
        address proposer,
        ProposalClass class_,
        bytes32 metadataHash,
        bytes32 actionsHash,
        uint64 snapshotBlock,
        uint64 voteStart,
        uint64 voteEnd,
        uint256 nonce
    ) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(DOMAIN, proposer, class_, metadataHash, actionsHash, snapshotBlock, voteStart, voteEnd, nonce)
        );
    }
}
