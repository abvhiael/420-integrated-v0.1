
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";

contract Governance420 is SystemAccess {
    enum Class { G1, G2, G3, G4 }
    enum State { NONE, ACTIVE, PASSED, FAILED, QUEUED, EXECUTED }

    struct Proposal {
        address proposer;
        Class class_;
        bytes32 metadataHash;
        uint64 snapshotBlock;
        uint64 voteEnd;
        uint256 communityYes;
        uint256 communityNo;
        uint256 validatorYes;
        uint256 validatorNo;
        State state;
    }

    mapping(bytes32 => Proposal) public proposals;

    event ProposalCreated(bytes32 indexed proposalId, address indexed proposer, Class class_, bytes32 metadataHash);
    event VoteRecorded(bytes32 indexed proposalId, bool validatorHouse, bool support, uint256 weight);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function createProposal(
        bytes32 proposalId,
        Class class_,
        bytes32 metadataHash,
        uint64 snapshotBlock,
        uint64 voteEnd
    ) external {
        require(proposals[proposalId].state == State.NONE, "exists");
        require(voteEnd > block.number, "vote end");
        proposals[proposalId] = Proposal(
            msg.sender,class_,metadataHash,snapshotBlock,voteEnd,0,0,0,0,State.ACTIVE
        );
        emit ProposalCreated(proposalId,msg.sender,class_,metadataHash);
    }

    /// @dev v1 vote application is governance/system-authorized to keep frozen electorate/snapshot logic external
    /// until the exact lock/snapshot contracts are finalized.
    function applyVote(bytes32 proposalId, bool validatorHouse, bool support, uint256 weight)
        external
        onlyGovernance
    {
        Proposal storage p=proposals[proposalId];
        require(p.state==State.ACTIVE && block.number<=p.voteEnd,"inactive");
        if (validatorHouse) {
            if (support) p.validatorYes += weight; else p.validatorNo += weight;
        } else {
            if (support) p.communityYes += weight; else p.communityNo += weight;
        }
        emit VoteRecorded(proposalId,validatorHouse,support,weight);
    }

    function applyResult(bytes32 proposalId, bool passed) external onlyGovernance {
        Proposal storage p=proposals[proposalId];
        require(p.state==State.ACTIVE,"inactive");
        p.state=passed?State.PASSED:State.FAILED;
    }
}
