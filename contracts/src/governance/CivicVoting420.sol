// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./CivicIds420.sol";
import "./CivicElectorateRegistry420.sol";

interface ICivicProposalRegistryVoting420 {
    function proposals(bytes32 proposalId)
        external
        view
        returns (
            address proposer,
            CivicIds420.ProposalClass class_,
            bytes32 metadataHash,
            bytes32 actionsHash,
            uint64 snapshotBlock,
            uint64 voteStart,
            uint64 voteEnd,
            CivicIds420.ProposalState state,
            bool exists
        );
}

/// @notice Canonical snapshot-bound ballot and tally ledger for 420Civic.
/// @dev Voting weight is resolved exclusively against the immutable electorate snapshot frozen for the proposal.
contract CivicVoting420 is I420System {
    enum Support {
        AGAINST,
        FOR,
        ABSTAIN
    }

    struct Tally {
        uint256 againstVotes;
        uint256 forVotes;
        uint256 abstainVotes;
    }

    struct Ballot {
        Support support;
        uint256 weight;
        bool cast;
    }

    ICivicProposalRegistryVoting420 public immutable proposalRegistry;
    CivicElectorateRegistry420 public immutable electorateRegistry;

    mapping(bytes32 => mapping(uint8 => Tally)) private _tallies;
    mapping(bytes32 => mapping(uint8 => mapping(address => Ballot))) private _ballots;

    error InvalidRegistry();
    error ProposalNotFound();
    error ProposalNotActive();
    error VotingNotStarted();
    error VotingEnded();
    error HouseNotEligible();
    error AlreadyVoted();
    error NoVotingWeight();

    event CivicVoteCast(
        bytes32 indexed proposalId,
        CivicIds420.House indexed house,
        address indexed voter,
        Support support,
        uint256 weight
    );

    constructor(address proposalRegistry_, address electorateRegistry_) {
        if (
            proposalRegistry_ == address(0) || electorateRegistry_ == address(0)
                || proposalRegistry_.code.length == 0 || electorateRegistry_.code.length == 0
        ) revert InvalidRegistry();
        proposalRegistry = ICivicProposalRegistryVoting420(proposalRegistry_);
        electorateRegistry = CivicElectorateRegistry420(electorateRegistry_);
    }

    function systemName() external pure returns (string memory) {
        return "CivicVoting420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function tally(bytes32 proposalId, CivicIds420.House house) external view returns (Tally memory) {
        return _tallies[proposalId][uint8(house)];
    }

    function ballot(bytes32 proposalId, CivicIds420.House house, address voter) external view returns (Ballot memory) {
        return _ballots[proposalId][uint8(house)][voter];
    }

    function participation(bytes32 proposalId, CivicIds420.House house) external view returns (uint256) {
        Tally storage t = _tallies[proposalId][uint8(house)];
        return t.againstVotes + t.forVotes + t.abstainVotes;
    }

    /// @notice Cast one immutable ballot for msg.sender in one house.
    /// @dev proofData is interpreted only by the frozen electorate source captured for this proposal.
    function castVote(bytes32 proposalId, CivicIds420.House house, Support support, bytes calldata proofData)
        external
        returns (uint256 weight)
    {
        (
            ,
            ,
            ,
            ,
            ,
            uint64 voteStart,
            uint64 voteEnd,
            CivicIds420.ProposalState state,
            bool exists
        ) = proposalRegistry.proposals(proposalId);

        if (!exists) revert ProposalNotFound();
        if (state != CivicIds420.ProposalState.ACTIVE) revert ProposalNotActive();
        if (block.number < voteStart) revert VotingNotStarted();
        if (block.number > voteEnd) revert VotingEnded();

        CivicElectorateRegistry420.ProposalSnapshot memory snap = electorateRegistry.proposalSnapshot(proposalId);
        if (house == CivicIds420.House.VALIDATOR && !snap.dualHouseRequired) revert HouseNotEligible();

        Ballot storage prior = _ballots[proposalId][uint8(house)][msg.sender];
        if (prior.cast) revert AlreadyVoted();

        weight = electorateRegistry.votingWeight(proposalId, house, msg.sender, proofData);
        if (weight == 0) revert NoVotingWeight();

        prior.support = support;
        prior.weight = weight;
        prior.cast = true;

        Tally storage t = _tallies[proposalId][uint8(house)];
        if (support == Support.FOR) t.forVotes += weight;
        else if (support == Support.AGAINST) t.againstVotes += weight;
        else t.abstainVotes += weight;

        emit CivicVoteCast(proposalId, house, msg.sender, support, weight);
    }
}
