// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./CivicIds420.sol";
import "./CivicConstitution420.sol";
import "./CivicProposalRegistry420.sol";
import "./CivicElectorateRegistry420.sol";
import "./CivicVoting420.sol";
import "./GovernanceTimelock.sol";

/// @notice Canonical proposal coordinator, result finalizer and timelocked batch executor for 420Civic.
contract CivicGovernor420 is I420System {
    uint256 private constant BPS = 10_000;

    struct FrozenRule {
        uint64 timelockDelay;
        uint16 communityQuorumBps;
        uint16 communityApprovalBps;
        uint16 validatorQuorumBps;
        uint16 validatorApprovalBps;
        bool dualHouseRequired;
        uint32 constitutionRevision;
        bool exists;
    }

    struct HouseResult {
        uint256 totalWeight;
        uint256 participation;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        bool quorumMet;
        bool approvalMet;
        bool passed;
    }

    struct Action {
        address target;
        uint256 value;
        bytes data;
    }

    CivicConstitution420 public immutable constitution;
    CivicProposalRegistry420 public immutable proposalRegistry;
    CivicElectorateRegistry420 public immutable electorateRegistry;
    CivicVoting420 public immutable voting;
    GovernanceTimelock public immutable timelock;

    mapping(address => uint256) public proposerNonces;
    mapping(bytes32 => FrozenRule) private _frozenRules;
    mapping(bytes32 => bytes32) public queuedActionHashes;

    error InvalidModule();
    error InvalidCommitment();
    error ConstitutionRuleMissing();
    error BlockNumberOverflow();
    error ProposalNotFound();
    error ProposalNotActive();
    error ProposalNotPassed();
    error ProposalNotQueued();
    error VotingStillActive();
    error FrozenRuleMissing();
    error ActionHashMismatch();
    error EmptyActionBatch();
    error InvalidAction();
    error TimelockAuthorityInactive();
    error UnauthorizedTimelock();
    error ActionExecutionFailed(uint256 index);
    error ValueMismatch();

    event CivicProposalCreated(
        bytes32 indexed proposalId,
        address indexed proposer,
        CivicIds420.ProposalClass indexed class_,
        bytes32 metadataHash,
        bytes32 actionsHash,
        uint64 snapshotBlock,
        uint64 voteStart,
        uint64 voteEnd,
        uint32 constitutionRevision
    );
    event CivicProposalFinalized(
        bytes32 indexed proposalId,
        bool passed,
        bool communityPassed,
        bool validatorPassed,
        uint32 constitutionRevision
    );
    event CivicProposalQueued(
        bytes32 indexed proposalId,
        bytes32 indexed actionsHash,
        uint64 timelockDelay,
        uint256 totalValue
    );
    event CivicProposalExecuted(bytes32 indexed proposalId, bytes32 indexed actionsHash);

    constructor(
        address constitution_,
        address proposalRegistry_,
        address electorateRegistry_,
        address voting_,
        address timelock_
    ) {
        if (
            constitution_ == address(0) || proposalRegistry_ == address(0) || electorateRegistry_ == address(0)
                || voting_ == address(0) || timelock_ == address(0) || constitution_.code.length == 0
                || proposalRegistry_.code.length == 0 || electorateRegistry_.code.length == 0
                || voting_.code.length == 0 || timelock_.code.length == 0
        ) revert InvalidModule();

        constitution = CivicConstitution420(constitution_);
        proposalRegistry = CivicProposalRegistry420(proposalRegistry_);
        electorateRegistry = CivicElectorateRegistry420(electorateRegistry_);
        voting = CivicVoting420(voting_);
        timelock = GovernanceTimelock(payable(timelock_));
    }

    function systemName() external pure returns (string memory) {
        return "CivicGovernor420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function frozenRule(bytes32 proposalId) external view returns (FrozenRule memory) {
        FrozenRule memory rule = _frozenRules[proposalId];
        if (!rule.exists) revert FrozenRuleMissing();
        return rule;
    }

    function hashActions(Action[] calldata actions) public pure returns (bytes32) {
        return keccak256(abi.encode(actions));
    }

    function createProposal(CivicIds420.ProposalClass class_, bytes32 metadataHash, bytes32 actionsHash)
        external
        returns (bytes32 proposalId)
    {
        if (metadataHash == bytes32(0) || actionsHash == bytes32(0)) revert InvalidCommitment();
        if (block.number == 0 || block.number > type(uint64).max - 2) revert BlockNumberOverflow();

        CivicConstitution420.Rule memory rule = constitution.ruleFor(class_);
        if (!rule.exists || rule.votingPeriodBlocks == 0) revert ConstitutionRuleMissing();

        uint256 voteStart256 = block.number + 1;
        uint256 voteEnd256 = voteStart256 + uint256(rule.votingPeriodBlocks) - 1;
        if (voteEnd256 > type(uint64).max) revert BlockNumberOverflow();

        uint64 snapshotBlock = uint64(block.number - 1);
        uint64 voteStart = uint64(voteStart256);
        uint64 voteEnd = uint64(voteEnd256);
        uint256 nonce = proposerNonces[msg.sender]++;

        proposalId = CivicIds420.proposalId(
            msg.sender, class_, metadataHash, actionsHash, snapshotBlock, voteStart, voteEnd, nonce
        );

        _frozenRules[proposalId] = FrozenRule({
            timelockDelay: rule.timelockDelay,
            communityQuorumBps: rule.communityQuorumBps,
            communityApprovalBps: rule.communityApprovalBps,
            validatorQuorumBps: rule.validatorQuorumBps,
            validatorApprovalBps: rule.validatorApprovalBps,
            dualHouseRequired: rule.dualHouseRequired,
            constitutionRevision: rule.revision,
            exists: true
        });

        proposalRegistry.registerProposal(
            proposalId, msg.sender, class_, metadataHash, actionsHash, snapshotBlock, voteStart, voteEnd
        );
        electorateRegistry.snapshotProposal(proposalId, snapshotBlock, rule.dualHouseRequired);

        emit CivicProposalCreated(
            proposalId,
            msg.sender,
            class_,
            metadataHash,
            actionsHash,
            snapshotBlock,
            voteStart,
            voteEnd,
            rule.revision
        );
    }

    function finalize(bytes32 proposalId) external returns (bool passed) {
        (,,,,,,, CivicIds420.ProposalState state, bool exists) = proposalRegistry.proposals(proposalId);
        (,,,,,, uint64 voteEnd,,) = proposalRegistry.proposals(proposalId);

        if (!exists) revert ProposalNotFound();
        if (state != CivicIds420.ProposalState.ACTIVE) revert ProposalNotActive();
        if (block.number <= voteEnd) revert VotingStillActive();

        FrozenRule memory rule = _frozenRules[proposalId];
        if (!rule.exists) revert FrozenRuleMissing();
        CivicElectorateRegistry420.ProposalSnapshot memory snap = electorateRegistry.proposalSnapshot(proposalId);

        HouseResult memory community = _houseResult(
            proposalId,
            CivicIds420.House.COMMUNITY,
            snap.community.totalWeight,
            rule.communityQuorumBps,
            rule.communityApprovalBps
        );

        bool validatorPassed = true;
        if (rule.dualHouseRequired) {
            HouseResult memory validator = _houseResult(
                proposalId,
                CivicIds420.House.VALIDATOR,
                snap.validator.totalWeight,
                rule.validatorQuorumBps,
                rule.validatorApprovalBps
            );
            validatorPassed = validator.passed;
        }

        passed = community.passed && validatorPassed;
        proposalRegistry.transition(
            proposalId, passed ? CivicIds420.ProposalState.PASSED : CivicIds420.ProposalState.FAILED
        );
        emit CivicProposalFinalized(proposalId, passed, community.passed, validatorPassed, rule.constitutionRevision);
    }

    /// @notice Bind the exact committed action batch to one timelock operation and move PASSED -> QUEUED.
    function queue(bytes32 proposalId, Action[] calldata actions) external returns (uint256 totalValue) {
        if (actions.length == 0) revert EmptyActionBatch();
        if (!timelock.civicAuthorityActivated() || timelock.scheduler() != address(this)) {
            revert TimelockAuthorityInactive();
        }

        (, CivicIds420.ProposalClass class_,, bytes32 actionsHash,,,, CivicIds420.ProposalState state, bool exists) =
            proposalRegistry.proposals(proposalId);
        if (!exists) revert ProposalNotFound();
        if (state != CivicIds420.ProposalState.PASSED) revert ProposalNotPassed();

        bytes32 computedHash = hashActions(actions);
        if (computedHash != actionsHash) revert ActionHashMismatch();
        for (uint256 i = 0; i < actions.length; ++i) {
            if (actions[i].target == address(0)) revert InvalidAction();
            totalValue += actions[i].value;
        }

        FrozenRule memory rule = _frozenRules[proposalId];
        if (!rule.exists) revert FrozenRuleMissing();
        queuedActionHashes[proposalId] = computedHash;

        bytes memory data = abi.encodeCall(this.executeQueuedBatch, (proposalId, actions));
        timelock.scheduleWithDelay(
            proposalId,
            address(this),
            totalValue,
            data,
            GovernanceTimelock.Class(uint8(class_)),
            rule.timelockDelay
        );
        proposalRegistry.transition(proposalId, CivicIds420.ProposalState.QUEUED);
        emit CivicProposalQueued(proposalId, computedHash, rule.timelockDelay, totalValue);
    }

    /// @notice Execute the entire committed action batch atomically. Callable only by the frozen timelock.
    function executeQueuedBatch(bytes32 proposalId, Action[] calldata actions) external payable {
        if (msg.sender != address(timelock)) revert UnauthorizedTimelock();
        (,,, bytes32 actionsHash,,,, CivicIds420.ProposalState state, bool exists) = proposalRegistry.proposals(proposalId);
        if (!exists) revert ProposalNotFound();
        if (state != CivicIds420.ProposalState.QUEUED) revert ProposalNotQueued();

        bytes32 computedHash = hashActions(actions);
        if (computedHash != actionsHash || computedHash != queuedActionHashes[proposalId]) revert ActionHashMismatch();

        uint256 expectedValue;
        for (uint256 i = 0; i < actions.length; ++i) expectedValue += actions[i].value;
        if (msg.value != expectedValue) revert ValueMismatch();

        for (uint256 i = 0; i < actions.length; ++i) {
            (bool ok,) = actions[i].target.call{value: actions[i].value}(actions[i].data);
            if (!ok) revert ActionExecutionFailed(i);
        }

        proposalRegistry.transition(proposalId, CivicIds420.ProposalState.EXECUTED);
        emit CivicProposalExecuted(proposalId, computedHash);
    }

    function resultFor(bytes32 proposalId, CivicIds420.House house) external view returns (HouseResult memory) {
        FrozenRule memory rule = _frozenRules[proposalId];
        if (!rule.exists) revert FrozenRuleMissing();
        CivicElectorateRegistry420.ProposalSnapshot memory snap = electorateRegistry.proposalSnapshot(proposalId);

        if (house == CivicIds420.House.COMMUNITY) {
            return _houseResult(
                proposalId, house, snap.community.totalWeight, rule.communityQuorumBps, rule.communityApprovalBps
            );
        }
        return _houseResult(
            proposalId, house, snap.validator.totalWeight, rule.validatorQuorumBps, rule.validatorApprovalBps
        );
    }

    function _houseResult(
        bytes32 proposalId,
        CivicIds420.House house,
        uint256 totalWeight,
        uint16 quorumBps,
        uint16 approvalBps
    ) private view returns (HouseResult memory result) {
        CivicVoting420.Tally memory t = voting.tally(proposalId, house);
        uint256 participation = t.againstVotes + t.forVotes + t.abstainVotes;
        uint256 decisiveVotes = t.forVotes + t.againstVotes;
        bool quorumMet = participation >= _ceilBps(totalWeight, quorumBps);
        bool approvalMet = decisiveVotes != 0 && t.forVotes >= _ceilBps(decisiveVotes, approvalBps);

        result = HouseResult({
            totalWeight: totalWeight,
            participation: participation,
            forVotes: t.forVotes,
            againstVotes: t.againstVotes,
            abstainVotes: t.abstainVotes,
            quorumMet: quorumMet,
            approvalMet: approvalMet,
            passed: quorumMet && approvalMet
        });
    }

    function _ceilBps(uint256 total, uint16 bps) private pure returns (uint256) {
        uint256 whole = (total / BPS) * uint256(bps);
        uint256 remainderProduct = (total % BPS) * uint256(bps);
        return whole + (remainderProduct / BPS) + (remainderProduct % BPS == 0 ? 0 : 1);
    }

    receive() external payable {}
}
