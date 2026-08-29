// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";
import "./CivicIds420.sol";

/// @notice Canonical proposal identity and lifecycle registry for 420Civic.
/// @dev Proposal contents are committed by hash. Voting and electorate math live in separate modules.
contract CivicProposalRegistry420 is SystemAccess, I420System {
    struct Proposal {
        address proposer;
        CivicIds420.ProposalClass class_;
        bytes32 metadataHash;
        bytes32 actionsHash;
        uint64 snapshotBlock;
        uint64 voteStart;
        uint64 voteEnd;
        CivicIds420.ProposalState state;
        bool exists;
    }

    mapping(bytes32 => Proposal) public proposals;
    address public proposalAuthority;

    error InvalidId();
    error InvalidWindow();
    error AlreadyExists();
    error NotFound();
    error UnauthorizedAuthority();
    error AuthorityAlreadyBound();
    error InvalidStateTransition();

    event ProposalAuthorityBound(address indexed authority);
    event CivicProposalRegistered(
        bytes32 indexed proposalId,
        address indexed proposer,
        CivicIds420.ProposalClass indexed class_,
        bytes32 metadataHash,
        bytes32 actionsHash,
        uint64 snapshotBlock,
        uint64 voteStart,
        uint64 voteEnd
    );
    event CivicProposalStateChanged(
        bytes32 indexed proposalId,
        CivicIds420.ProposalState previousState,
        CivicIds420.ProposalState newState
    );

    constructor(address timelock_) SystemAccess(timelock_) {}

    modifier onlyProposalAuthority() {
        if (msg.sender != proposalAuthority || proposalAuthority == address(0)) revert UnauthorizedAuthority();
        _;
    }

    function systemName() external pure returns (string memory) {
        return "CivicProposalRegistry420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    /// @notice Bind the sole proposal lifecycle authority once.
    /// @dev Intended to bind the mature Governance420/Civic governor compatibility surface.
    function bindProposalAuthority(address authority) external onlyGovernance {
        if (proposalAuthority != address(0)) revert AuthorityAlreadyBound();
        if (authority == address(0)) revert UnauthorizedAuthority();
        proposalAuthority = authority;
        emit ProposalAuthorityBound(authority);
    }

    function registerProposal(
        bytes32 proposalId,
        address proposer,
        CivicIds420.ProposalClass class_,
        bytes32 metadataHash,
        bytes32 actionsHash,
        uint64 snapshotBlock,
        uint64 voteStart,
        uint64 voteEnd
    ) external onlyProposalAuthority {
        if (proposalId == bytes32(0) || proposer == address(0) || metadataHash == bytes32(0) || actionsHash == bytes32(0)) {
            revert InvalidId();
        }
        if (voteStart <= snapshotBlock || voteEnd <= voteStart) revert InvalidWindow();
        if (proposals[proposalId].exists) revert AlreadyExists();

        proposals[proposalId] = Proposal({
            proposer: proposer,
            class_: class_,
            metadataHash: metadataHash,
            actionsHash: actionsHash,
            snapshotBlock: snapshotBlock,
            voteStart: voteStart,
            voteEnd: voteEnd,
            state: CivicIds420.ProposalState.ACTIVE,
            exists: true
        });

        emit CivicProposalRegistered(
            proposalId, proposer, class_, metadataHash, actionsHash, snapshotBlock, voteStart, voteEnd
        );
    }

    /// @notice Apply only an explicitly legal proposal lifecycle transition.
    function transition(bytes32 proposalId, CivicIds420.ProposalState next) external onlyProposalAuthority {
        Proposal storage p = proposals[proposalId];
        if (!p.exists) revert NotFound();
        CivicIds420.ProposalState previous = p.state;
        if (!_allowed(previous, next)) revert InvalidStateTransition();
        p.state = next;
        emit CivicProposalStateChanged(proposalId, previous, next);
    }

    function _allowed(CivicIds420.ProposalState from, CivicIds420.ProposalState to) private pure returns (bool) {
        if (from == CivicIds420.ProposalState.ACTIVE) {
            return to == CivicIds420.ProposalState.PASSED || to == CivicIds420.ProposalState.FAILED
                || to == CivicIds420.ProposalState.CANCELLED;
        }
        if (from == CivicIds420.ProposalState.PASSED) {
            return to == CivicIds420.ProposalState.QUEUED || to == CivicIds420.ProposalState.CANCELLED;
        }
        if (from == CivicIds420.ProposalState.QUEUED) {
            return to == CivicIds420.ProposalState.EXECUTED || to == CivicIds420.ProposalState.CANCELLED;
        }
        return false;
    }
}
