// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/ProtocolRegistry.sol";
import "../src/governance/GovernanceTimelock.sol";
import "../src/governance/Governance420.sol";
import "../src/governance/CivicIds420.sol";
import "../src/governance/CivicConstitution420.sol";
import "../src/governance/CivicProposalRegistry420.sol";
import "../src/governance/CivicElectorateRegistry420.sol";
import "../src/governance/CivicVoting420.sol";
import "../src/governance/CivicGovernor420.sol";
import "../src/governance/CivicMerkleElectorateSource420.sol";

interface VmGovernanceRec4 {
    struct Log {
        bytes32[] topics;
        bytes data;
        address emitter;
    }

    function warp(uint256) external;
    function roll(uint256) external;
    function etch(address, bytes calldata) external;
    function store(address, bytes32, bytes32) external;
    function prank(address) external;
    function deal(address, uint256) external;
    function recordLogs() external;
    function getRecordedLogs() external returns (Log[] memory);
}

/// @dev Real Timelock-only action target; a callback deliberately attempts a nested execution.
contract GovRec4Target {
    GovernanceTimelock public immutable timelock;
    uint256 public number;
    uint256 public received;
    uint256 public blockedReentries;
    bytes32 public nestedId;

    constructor(GovernanceTimelock timelock_) {
        timelock = timelock_;
    }

    function setNumber(uint256 next) external payable {
        require(msg.sender == address(timelock), "not timelock");
        number = next;
        received += msg.value;
    }

    function revertAction() external pure {
        revert("hostile action");
    }

    function configureReentry(bytes32 id) external {
        nestedId = id;
    }

    function tryReenter() external {
        require(msg.sender == address(timelock) && nestedId != bytes32(0), "not configured timelock");
        (bool ok,) = address(timelock).call(abi.encodeCall(GovernanceTimelock.execute, (nestedId)));
        require(!ok, "reentrant operation succeeded");
        ++blockedReentries;
    }
}

/// @notice Synthetic, deterministic pre-testnet lifecycle with actual Civic and Registry contracts.
/// @dev Fixture-only electorate roots. Never use these addresses or roots as approved Genesis inputs.
/// The fixed predeploy identities, their immutable constructor references and initial storage match
/// contracts/config/predeploy/Governance{Timelock,420}-predeploy-state.json.
contract GovernanceRec4Lifecycle420Test {
    VmGovernanceRec4 private constant vm =
        VmGovernanceRec4(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant TIMELOCK = 0x0000000000000000000000000000000000000429;
    address private constant REGISTRY = 0x0000000000000000000000000000000000000434;
    address private constant COMPAT = 0x0000000000000000000000000000000000000437;
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant CAROL = address(0xCAFE);
    address private constant DAVE = address(0xD00D);

    GovernanceTimelock private timelock;
    Governance420 private compatibility;
    CivicConstitution420 private constitution;
    CivicProposalRegistry420 private proposals;
    CivicElectorateRegistry420 private electorates;
    CivicVoting420 private voting;
    CivicGovernor420 private governor;
    CivicMerkleElectorateSource420 private community;
    CivicMerkleElectorateSource420 private validators;

    function _leaf(address member) private pure returns (bytes32) {
        return keccak256(abi.encode(member));
    }

    function _pair(bytes32 a, bytes32 b) private pure returns (bytes32) {
        return a < b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
    }

    function _rootCommunity() private pure returns (bytes32) {
        return _pair(_leaf(ALICE), _leaf(BOB));
    }

    function _rootValidators() private pure returns (bytes32) {
        return _pair(_leaf(CAROL), _leaf(DAVE));
    }

    function _proof(address sibling) private pure returns (bytes memory) {
        bytes32[] memory path = new bytes32[](1);
        path[0] = _leaf(sibling);
        return abi.encode(path);
    }

    function _deployAndBootstrap() private {
        vm.roll(1000);
        vm.warp(1_800_000_000);

        // Materialize constructor-specialized runtime at the frozen predeploy addresses.
        GovernanceTimelock timelockRuntime = new GovernanceTimelock(COMPAT);
        Governance420 compatRuntime = new Governance420(TIMELOCK);
        vm.etch(TIMELOCK, address(timelockRuntime).code);
        vm.etch(COMPAT, address(compatRuntime).code);
        // Timelock slot zero is the initial bootstrap scheduler in the frozen manifest.
        vm.store(TIMELOCK, bytes32(0), bytes32(uint256(uint160(COMPAT))));
        timelock = GovernanceTimelock(payable(TIMELOCK));
        compatibility = Governance420(COMPAT);
        require(TIMELOCK.codehash == address(timelockRuntime).codehash, "timelock runtime drift");
        require(COMPAT.codehash == address(compatRuntime).codehash, "compatibility runtime drift");
        require(timelock.bootstrapGovernor() == COMPAT && timelock.scheduler() == COMPAT, "predeploy authority");
        require(!timelock.civicAuthorityActivated() && compatibility.governanceTimelock() == TIMELOCK, "predeploy state");
        require(compatibility.approvedBootstrapPlanHash() == bytes32(0), "premature Genesis approval");

        ProtocolRegistry registryRuntime = new ProtocolRegistry(TIMELOCK);
        vm.etch(REGISTRY, address(registryRuntime).code);

        constitution = new CivicConstitution420(TIMELOCK);
        proposals = new CivicProposalRegistry420(TIMELOCK);
        electorates = new CivicElectorateRegistry420(TIMELOCK);
        voting = new CivicVoting420(address(proposals), address(electorates));
        governor = new CivicGovernor420(address(constitution), address(proposals), address(electorates), address(voting));
        community = new CivicMerkleElectorateSource420(
            TIMELOCK, keccak256("420CIVIC_COMMUNITY_EQUAL_WEIGHT_MERKLE_V1")
        );
        validators = new CivicMerkleElectorateSource420(
            TIMELOCK, keccak256("420CIVIC_VALIDATOR_EQUAL_WEIGHT_MERKLE_V1")
        );

        // Genesis-only fixture storage: five frozen approval slots (4-8), no runtime setter.
        require(_rootCommunity() == 0xda9e544e4add47789b40c8b0be82f1761605345aead2d6db1f001f77e1cbb8e0,
            "community fixture drift");
        require(_rootValidators() == 0xc2ad5a359d781e8a6bffad53196158ac0be6ddf30350c23f51adf3507470c3f3,
            "validator fixture drift");
        vm.store(COMPAT, bytes32(uint256(5)), _rootCommunity());
        vm.store(COMPAT, bytes32(uint256(6)), bytes32(uint256(2)));
        vm.store(COMPAT, bytes32(uint256(7)), _rootValidators());
        vm.store(COMPAT, bytes32(uint256(8)), bytes32(uint256(2)));
        bytes32 plan = compatibility.canonicalBootstrapPlanHash(
            address(constitution), address(proposals), address(electorates), address(voting), address(governor),
            address(community), address(validators)
        );
        vm.store(COMPAT, bytes32(uint256(4)), plan);

        compatibility.scheduleCanonicalCivicBootstrap(
            address(constitution), address(proposals), address(electorates), address(voting), address(governor),
            address(community), address(validators)
        );
        require(compatibility.bootstrapPlanHash() == plan && compatibility.bootstrapPlanScheduled(), "bootstrap commitment");
        uint256 queuedAt = block.timestamp;
        for (uint8 i; i < 19; ++i) {
            bytes32 opId = compatibility.bootstrapOperationId(plan, i);
            (address target, uint256 value,, uint64 afterTime, GovernanceTimelock.Class class_, bool done, bool cancelled) =
                timelock.operations(opId);
            require(target != address(0) && value == 0 && !done && !cancelled, "bootstrap operation state");
            require(class_ == GovernanceTimelock.Class.G1 && afterTime == queuedAt + 7 days,
                "bootstrap G1 floor");
        }
        require(_rejected(TIMELOCK, abi.encodeCall(timelock.execute, (compatibility.bootstrapOperationId(plan, 0)))),
            "premature bootstrap execution");
        vm.warp(queuedAt + 7 days);
        for (uint8 i; i < 19; ++i) timelock.execute(compatibility.bootstrapOperationId(plan, i));

        require(community.checkpointCount() == 1 && validators.checkpointCount() == 1, "first checkpoints");
        require(community.checkpoint(0).electorateRoot == _rootCommunity(), "community initial root");
        require(validators.checkpoint(0).electorateRoot == _rootValidators(), "validator initial root");
        vm.roll(block.number + 2);
        compatibility.activateCanonicalCivic(
            address(constitution), address(proposals), address(electorates), address(voting), address(governor),
            address(community), address(validators)
        );
        require(compatibility.bootstrapRetired() && timelock.civicAuthorityActivated(), "one-way handoff");
        require(timelock.scheduler() == address(governor) && compatibility.civicGovernor() == address(governor),
            "canonical scheduler");
        require(proposals.proposalAuthority() == address(governor)
            && electorates.snapshotAuthority() == address(governor), "module authority bindings");

        ProtocolRegistry registry = ProtocolRegistry(REGISTRY);
        require(registry.resolve(compatibility.COMMUNITY_COMPONENT_ID()) == address(constitution), "constitution discovery");
        require(registry.resolve(compatibility.PROPOSAL_COMPONENT_ID()) == address(proposals), "proposal discovery");
        require(registry.resolve(compatibility.ELECTORATE_COMPONENT_ID()) == address(electorates), "electorate discovery");
        require(registry.resolve(compatibility.VOTING_COMPONENT_ID()) == address(voting), "voting discovery");
        require(registry.resolve(compatibility.GOVERNOR_COMPONENT_ID()) == address(governor), "governor discovery");
        require(registry.resolve(compatibility.COMMUNITY_SOURCE_COMPONENT_ID()) == address(community), "community discovery");
        require(registry.resolve(compatibility.VALIDATOR_SOURCE_COMPONENT_ID()) == address(validators), "validator discovery");
        (address resolved, uint32 version) = registry.resolveActive(compatibility.GOVERNANCE_SERVICE_ID());
        require(resolved == address(governor) && version == 1, "service discovery");
        require(_rejected(COMPAT, abi.encodeCall(
            Governance420.activateCanonicalCivic,
            (address(constitution), address(proposals), address(electorates), address(voting), address(governor),
             address(community), address(validators))
        )), "second activation");
    }

    function _rejected(address target, bytes memory callData) private returns (bool) {
        (bool accepted,) = target.call(callData);
        return !accepted;
    }

    function _actions(GovRec4Target target, uint256 next)
        private pure returns (CivicGovernor420.Action[] memory a)
    {
        a = new CivicGovernor420.Action[](1);
        a[0] = CivicGovernor420.Action(address(target), 0, abi.encodeCall(target.setNumber, (next)));
    }

    function _create(CivicIds420.ProposalClass class_, CivicGovernor420.Action[] memory actions)
        private returns (bytes32 id)
    {
        vm.prank(ALICE);
        id = governor.createProposal(class_, keccak256(abi.encode(class_, block.number, address(this))),
            governor.hashActions(actions));
        CivicElectorateRegistry420.ProposalSnapshot memory snap = electorates.proposalSnapshot(id);
        require(snap.snapshotBlock == block.number - 1, "historical snapshot block");
        require(snap.community.source == address(community) && snap.community.sourceRevision == 1, "community frozen");
        require(snap.community.electorateRoot == _rootCommunity() && snap.community.totalWeight == 2, "community root");
        if (class_ == CivicIds420.ProposalClass.G3 || class_ == CivicIds420.ProposalClass.G4) {
            require(snap.dualHouseRequired && snap.validator.source == address(validators), "validator snapshot");
            require(snap.validator.sourceRevision == 1 && snap.validator.electorateRoot == _rootValidators()
                && snap.validator.totalWeight == 2, "validator root");
        } else {
            require(!snap.dualHouseRequired, "unexpected validator house");
        }
        require(governor.frozenRule(id).constitutionRevision == constitution.ruleFor(class_).revision,
            "constitution snapshot revision");
    }

    function _vote(bytes32 id, CivicIds420.House house, address member, CivicVoting420.Support choice) private {
        address sibling = house == CivicIds420.House.COMMUNITY
            ? (member == ALICE ? BOB : ALICE) : (member == CAROL ? DAVE : CAROL);
        vm.prank(member);
        require(voting.castVote(id, house, choice, _proof(sibling)) == 1, "membership proof weight");
    }

    function _end(bytes32 id) private {
        (,,,,,, uint64 voteEnd,,) = proposals.proposals(id);
        vm.roll(uint256(voteEnd) + 1);
    }

    function _pass(bytes32 id, bool dual) private {
        vm.roll(block.number + 1);
        _vote(id, CivicIds420.House.COMMUNITY, ALICE, CivicVoting420.Support.FOR);
        _vote(id, CivicIds420.House.COMMUNITY, BOB, CivicVoting420.Support.ABSTAIN);
        if (dual) {
            _vote(id, CivicIds420.House.VALIDATOR, CAROL, CivicVoting420.Support.FOR);
            _vote(id, CivicIds420.House.VALIDATOR, DAVE, CivicVoting420.Support.ABSTAIN);
        }
        require(governor.resultFor(id, CivicIds420.House.COMMUNITY).passed, "community threshold");
        if (dual) require(governor.resultFor(id, CivicIds420.House.VALIDATOR).passed, "validator threshold");
        _end(id);
        require(governor.finalize(id), "proposal did not pass");
    }

    function _queuedDelay(bytes32 id, CivicIds420.ProposalClass class_, CivicGovernor420.Action[] memory actions)
        private returns (uint64 executeAfter)
    {
        uint256 at = block.timestamp;
        governor.queue(id, actions);
        (address target, uint256 value,, uint64 time, GovernanceTimelock.Class storedClass, bool executed, bool cancelled) =
            timelock.operations(id);
        uint64 floor = timelock.delayFor(GovernanceTimelock.Class(uint8(class_)));
        require(target == address(governor) && storedClass == GovernanceTimelock.Class(uint8(class_)),
            "queued governor target/class");
        require(!executed && !cancelled && value == _sum(actions), "queued state/value");
        require(time == at + floor && governor.queuedActionHashes(id) == governor.hashActions(actions),
            "frozen class floor and action commitment");
        executeAfter = time;
    }

    function _sum(CivicGovernor420.Action[] memory actions) private pure returns (uint256 total) {
        for (uint256 i; i < actions.length; ++i) total += actions[i].value;
    }

    function _state(bytes32 id) private view returns (CivicIds420.ProposalState state) {
        (,,,,,,, state,) = proposals.proposals(id);
    }

    function testCleanDeploymentDualHouseAtomicExecutionAndIndexerEventProjection() public {
        _deployAndBootstrap();
        GovRec4Target target = new GovRec4Target(timelock);
        CivicGovernor420.Action[] memory actions = new CivicGovernor420.Action[](2);
        actions[0] = CivicGovernor420.Action(address(target), 0, abi.encodeCall(target.setNumber, (420)));
        actions[1] = CivicGovernor420.Action(address(constitution), 0, abi.encodeCall(
            CivicConstitution420.setRule,
            (CivicIds420.ProposalClass.G3, uint64(35_280), uint64(14 days),
             uint16(5000), uint16(7500), uint16(5000), uint16(7500), true)
        ));

        vm.recordLogs();
        bytes32 id = _create(CivicIds420.ProposalClass.G3, actions);
        CivicGovernor420.FrozenRule memory frozen = governor.frozenRule(id);
        require(frozen.communityQuorumBps == 3334 && frozen.communityApprovalBps == 6667
            && frozen.validatorQuorumBps == 3334 && frozen.validatorApprovalBps == 6667,
            "Genesis G3 snapshot drift");
        _pass(id, true);
        uint64 ready = _queuedDelay(id, CivicIds420.ProposalClass.G3, actions);
        require(_rejected(TIMELOCK, abi.encodeCall(timelock.execute, (id))), "early execution");
        vm.warp(ready);
        timelock.execute(id);
        require(_state(id) == CivicIds420.ProposalState.EXECUTED && target.number() == 420,
            "atomic state update");
        require(constitution.ruleFor(CivicIds420.ProposalClass.G3).revision == 2, "governed rule revision");
        require(governor.frozenRule(id).constitutionRevision == 1, "frozen rule overwritten");
        require(_rejected(TIMELOCK, abi.encodeCall(timelock.execute, (id))), "operation replay");
        require(_rejected(address(governor), abi.encodeCall(governor.queue, (id, actions))), "proposal requeue");

        // These canonical ABI event topics and state transitions are what the non-authoritative
        // 420Indexer Governance Civic descriptor and lifecycle reducer consume.
        VmGovernanceRec4.Log[] memory logs = vm.getRecordedLogs();
        bytes32 registered = keccak256("CivicProposalRegistered(bytes32,address,uint8,bytes32,bytes32,uint64,uint64,uint64)");
        bytes32 changed = keccak256("CivicProposalStateChanged(bytes32,uint8,uint8)");
        bytes32 voted = keccak256("CivicVoteCast(bytes32,uint8,address,uint8,uint256)");
        bytes32 queued = keccak256("CivicProposalQueued(bytes32,bytes32,uint64,uint256)");
        bytes32 executed = keccak256("CivicProposalExecuted(bytes32,bytes32)");
        uint256 registrations;
        uint256 transitions;
        uint256 ballots;
        uint256 queues;
        uint256 executions;
        for (uint256 i; i < logs.length; ++i) {
            VmGovernanceRec4.Log memory item = logs[i];
            if (item.topics.length < 2 || item.topics[1] != id) continue;
            if (item.emitter == address(proposals) && item.topics[0] == registered) ++registrations;
            if (item.emitter == address(proposals) && item.topics[0] == changed) {
                (uint8 previous, uint8 next) = abi.decode(item.data, (uint8, uint8));
                uint8[3] memory expectedPrevious = [uint8(1), uint8(2), uint8(4)];
                uint8[3] memory expectedNext = [uint8(2), uint8(4), uint8(5)];
                require(transitions < 3 && previous == expectedPrevious[transitions]
                    && next == expectedNext[transitions], "Indexer transition drift");
                ++transitions;
            }
            if (item.emitter == address(voting) && item.topics[0] == voted) ++ballots;
            if (item.emitter == address(governor) && item.topics[0] == queued) ++queues;
            if (item.emitter == address(governor) && item.topics[0] == executed) ++executions;
        }
        require(registrations == 1 && transitions == 3 && ballots == 4 && queues == 1 && executions == 1,
            "Indexer event stream incomplete");
    }

    function testAllFourFrozenClassDelayFloorsAndDualHouseEligibility() public {
        _deployAndBootstrap();
        GovRec4Target target = new GovRec4Target(timelock);
        uint64[4] memory floors = [uint64(7 days), uint64(14 days), uint64(14 days), uint64(42 days)];
        for (uint8 i; i < 4; ++i) {
            CivicIds420.ProposalClass class_ = CivicIds420.ProposalClass(i);
            CivicGovernor420.Action[] memory actions = _actions(target, uint256(i) + 1);
            bytes32 id = _create(class_, actions);
            _pass(id, i >= 2);
            uint64 ready = _queuedDelay(id, class_, actions);
            require(ready == block.timestamp + floors[i], "class-specific floor drift");
            vm.warp(uint256(ready) - 1);
            require(_rejected(TIMELOCK, abi.encodeCall(timelock.execute, (id))), "early class execution");
            vm.warp(ready);
            timelock.execute(id);
            require(target.number() == uint256(i) + 1 && _state(id) == CivicIds420.ProposalState.EXECUTED,
                "class execution");
        }
    }

    function testQuorumApprovalAbstainAndFailedProposalsRemainUnqueueable() public {
        _deployAndBootstrap();
        GovRec4Target target = new GovRec4Target(timelock);
        CivicGovernor420.Action[] memory actions = _actions(target, 1);

        bytes32 insufficient = _create(CivicIds420.ProposalClass.G4, actions);
        _end(insufficient); // Zero participation is one below the first reachable G4 quorum vote.
        require(!governor.finalize(insufficient) && _state(insufficient) == CivicIds420.ProposalState.FAILED,
            "zero quorum passed");
        require(_rejected(address(governor), abi.encodeCall(governor.queue, (insufficient, actions))),
            "failed zero-quorum proposal queued");

        bytes32 threshold = _create(CivicIds420.ProposalClass.G4, actions);
        vm.roll(block.number + 1);
        _vote(threshold, CivicIds420.House.COMMUNITY, ALICE, CivicVoting420.Support.FOR);
        CivicGovernor420.HouseResult memory exact = governor.resultFor(threshold, CivicIds420.House.COMMUNITY);
        require(exact.participation == 1 && exact.quorumMet, "exact 50 percent quorum");
        _vote(threshold, CivicIds420.House.COMMUNITY, BOB, CivicVoting420.Support.AGAINST);
        _vote(threshold, CivicIds420.House.VALIDATOR, CAROL, CivicVoting420.Support.FOR);
        _vote(threshold, CivicIds420.House.VALIDATOR, DAVE, CivicVoting420.Support.ABSTAIN);
        require(governor.resultFor(threshold, CivicIds420.House.COMMUNITY).quorumMet, "exact quorum lost");
        require(!governor.resultFor(threshold, CivicIds420.House.COMMUNITY).approvalMet,
            "split vote exceeded G4 75% approval");
        _end(threshold);
        require(!governor.finalize(threshold), "failed approval passed");

        bytes32 abstain = _create(CivicIds420.ProposalClass.G3, actions);
        vm.roll(block.number + 1);
        _vote(abstain, CivicIds420.House.COMMUNITY, ALICE, CivicVoting420.Support.ABSTAIN);
        _vote(abstain, CivicIds420.House.VALIDATOR, CAROL, CivicVoting420.Support.FOR);
        require(governor.resultFor(abstain, CivicIds420.House.COMMUNITY).quorumMet, "abstain quorum");
        require(!governor.resultFor(abstain, CivicIds420.House.COMMUNITY).approvalMet, "abstain approval");
        _end(abstain);
        require(!governor.finalize(abstain), "abstain-only house passed");

        bytes32 absentHouse = _create(CivicIds420.ProposalClass.G3, actions);
        vm.roll(block.number + 1);
        _vote(absentHouse, CivicIds420.House.COMMUNITY, ALICE, CivicVoting420.Support.FOR);
        vm.prank(ALICE);
        require(_rejected(address(voting), abi.encodeCall(
            CivicVoting420.castVote,
            (absentHouse, CivicIds420.House.COMMUNITY, CivicVoting420.Support.AGAINST, _proof(BOB))
        )), "duplicate ballot accepted");
        _end(absentHouse);
        require(!governor.finalize(absentHouse), "unvoted validator house passed");
        require(_state(absentHouse) == CivicIds420.ProposalState.FAILED, "failed state");
    }

    function testMaliciousReentrantAndRevertedActionsRollbackWholeBatch() public {
        _deployAndBootstrap();
        GovRec4Target target = new GovRec4Target(timelock);
        CivicGovernor420.Action[] memory bad = new CivicGovernor420.Action[](2);
        bad[0] = CivicGovernor420.Action(address(target), 0, abi.encodeCall(target.setNumber, (99)));
        bad[1] = CivicGovernor420.Action(address(target), 0, abi.encodeCall(target.revertAction, ()));
        bytes32 badId = _create(CivicIds420.ProposalClass.G1, bad);
        _pass(badId, false);
        uint64 ready = _queuedDelay(badId, CivicIds420.ProposalClass.G1, bad);
        vm.warp(ready);
        require(_rejected(TIMELOCK, abi.encodeCall(timelock.execute, (badId))), "reverting batch succeeded");
        require(target.number() == 0 && _state(badId) == CivicIds420.ProposalState.QUEUED,
            "partial batch leaked state");
        (,,,,, bool executed, bool cancelled) = timelock.operations(badId);
        require(!executed && !cancelled, "timelock/proposal state split");

        CivicGovernor420.Action[] memory attack = new CivicGovernor420.Action[](2);
        attack[0] = CivicGovernor420.Action(address(target), 0, abi.encodeCall(target.tryReenter, ()));
        attack[1] = CivicGovernor420.Action(address(target), 0, abi.encodeCall(target.setNumber, (42)));
        bytes32 attackId = _create(CivicIds420.ProposalClass.G1, attack);
        // A test target can learn its committed proposal ID after creation without altering the action bytes.
        target.configureReentry(attackId);
        _pass(attackId, false);
        uint64 attackReady = _queuedDelay(attackId, CivicIds420.ProposalClass.G1, attack);
        vm.warp(attackReady);
        timelock.execute(attackId);
        require(target.blockedReentries() == 1 && target.number() == 42,
            "reentry defense or committed action failed");
    }

    function testValueMismatchCancellationAndSubstitutionAreClosedAfterHandoff() public {
        _deployAndBootstrap();
        GovRec4Target target = new GovRec4Target(timelock);
        CivicGovernor420.Action[] memory valued = new CivicGovernor420.Action[](1);
        valued[0] = CivicGovernor420.Action(address(target), 1 ether, abi.encodeCall(target.setNumber, (7)));
        bytes32 id = _create(CivicIds420.ProposalClass.G1, valued);
        _pass(id, false);

        CivicGovernor420.Action[] memory substituted = _actions(target, 8);
        require(_rejected(address(governor), abi.encodeCall(governor.queue, (id, substituted))),
            "substituted batch queued");
        uint64 ready = _queuedDelay(id, CivicIds420.ProposalClass.G1, valued);
        require(_rejected(address(governor), abi.encodeCall(governor.queue, (id, valued))), "duplicate queue");
        require(_rejected(TIMELOCK, abi.encodeCall(timelock.cancel, (id))),
            "unsupported Civic cancellation succeeded");

        vm.prank(TIMELOCK);
        require(_rejected(address(governor), abi.encodeCall(governor.executeQueuedBatch, (id, valued))),
            "zero-value direct execution accepted");
        require(_state(id) == CivicIds420.ProposalState.QUEUED, "value mismatch mutated proposal");

        vm.deal(address(this), 2 ether);
        (bool funded,) = TIMELOCK.call{ value: 1 ether }("");
        require(funded, "timelock funding");
        vm.warp(ready);
        timelock.execute(id);
        require(target.number() == 7 && target.received() == 1 ether, "committed value transfer");
        require(_state(id) == CivicIds420.ProposalState.EXECUTED, "valued batch state");
    }

    function testFuzzActionBatchReorderingAndValuesChangeCommitment(uint96 a, uint96 b) public pure {
        CivicGovernor420.Action[] memory actions = new CivicGovernor420.Action[](2);
        actions[0] = CivicGovernor420.Action(address(0x1111), uint256(a), abi.encode(uint8(1)));
        actions[1] = CivicGovernor420.Action(address(0x2222), uint256(b), abi.encode(uint8(2)));
        bytes32 committed = keccak256(abi.encode(actions));
        CivicGovernor420.Action memory first = actions[0];
        actions[0] = actions[1];
        actions[1] = first;
        assert(keccak256(abi.encode(actions)) != committed);
        actions[1].value += 1;
        assert(keccak256(abi.encode(actions)) != committed);
    }
}
