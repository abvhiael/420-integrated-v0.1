// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/system/ValidatorRegistry.sol";
import "../src/system/RewardController.sol";
import "../src/system/CommunityValidatorReserve.sol";
import "../src/apps/Stake420.sol";
import "../src/interfaces/genesis/ISystemSafety420.sol";
import "../src/interfaces/genesis/Types420.sol";
import "./helpers/GenesisMocks420.sol";

interface VmStakeValidatorGenesis420 {
    function prank(address msgSender) external;
    function roll(uint256 newHeight) external;
    function deal(address account, uint256 newBalance) external;
}

contract StakeValidatorGenesis420Test {
    VmStakeValidatorGenesis420 internal constant vm = VmStakeValidatorGenesis420(address(uint160(uint256(keccak256("hevm cheat code")))));
    ValidatorRegistry internal registry;
    RewardController internal rewards;
    CommunityValidatorReserve internal reserve;
    Stake420 internal stake;
    GenesisMockEnvironment420 internal env;
    address internal constant SYSTEM_CALLER = 0x000000000000000000000000000000000000043C;

    function setUp() public {
        env = new GenesisMockEnvironment420();
        registry = new ValidatorRegistry(address(this), address(env.registry()), keccak256("stake-test-genesis"));
        rewards = new RewardController(address(this));
        reserve = new CommunityValidatorReserve(address(this));
        registry.bindConsensusSystemCaller(SYSTEM_CALLER);
        rewards.bindConsensusSystemCaller(SYSTEM_CALLER);
        registry.bindCommunityValidatorReserve(address(reserve));
        reserve.bindValidatorRegistry(address(registry));
        vm.deal(address(reserve), reserve.GENESIS_RESERVE());
        stake = new Stake420(address(registry), address(rewards));
    }

    function testStakeGenesisInitializationIntrospection() public view {
        bytes32 expected = keccak256("stake-test-genesis");
        require(registry.genesisInitialized(), "stake genesis not initialized");
        require(registry.initializationVersion() == 1, "stake init version");
        require(registry.genesisConfigHash() == expected, "stake config hash");
        require(registry.assertGenesisConfiguration(expected), "stake config assertion");
        require(!registry.assertGenesisConfiguration(keccak256("wrong")), "wrong stake config accepted");
        require(registry.stakeProtocolRegistry() == address(env.registry()), "stake registry binding");
    }

    function testGenesisBondLifecycleAndDelegationPolicy() public view {
        require(registry.EFFECTIVE_BOND() == 42_000 ether, "effective bond");
        require(registry.MIN_OWNED_BOND() == 21_000 ether, "owned floor");
        require(registry.MAX_PROTOCOL_CREDIT() == 21_000 ether, "credit cap");
        require(registry.ACTIVATION_DELAY_BLOCKS() == 17_640, "activation delay");
        require(registry.EXIT_NOTICE_ROTATIONS() == 1, "exit notice");
        require(registry.WITHDRAWAL_DELAY_BLOCKS() == 105_840, "withdrawal delay");
        require(registry.COOLDOWN_ROTATIONS() == 3, "cooldown");
        require(!stake.delegationEnabled(), "delegation disabled");
        require(!stake.stakeWeightedVotingEnabled(), "stake voting disabled");
    }

    function testSelfFundedRegistrationLocksReal420() public {
        (bytes32 id,) = _registerSelfFunded("self", 1);
        ValidatorRegistry.Validator memory v = registry.getValidator(id);
        require(v.ownedBond == 42_000 ether && v.protocolCredit == 0, "composition");
        require(address(registry).balance == 42_000 ether, "registry custody");
        require(registry.totalOwnedCustody() == 42_000 ether, "owned custody");
        _assertSolvent();
    }

    function testMatchedRegistrationMovesRealReserveCredit() public {
        (bytes32 id, address operator) = _matchedId("matched", 2);
        uint256 reserveBefore = address(reserve).balance;
        reserve.assignCredit(id, operator, 21_000 ether);
        reserve.fundCredit(id);
        require(address(reserve).balance == reserveBefore - 21_000 ether, "reserve funded");
        require(registry.pendingProtocolCredit(id) == 21_000 ether, "pending credit");
        _completeMatchedRegistration(id, operator, 2);
        ValidatorRegistry.Validator memory v = registry.getValidator(id);
        require(v.ownedBond == 21_000 ether && v.protocolCredit == 21_000 ether, "matched composition");
        require(address(registry).balance == 42_000 ether, "real effective bond");
        require(registry.totalPendingProtocolCredit() == 0, "pending consumed");
        _assertSolvent();
    }

    function testAssignedReserveCollateralCannotBeTreasurySpent() public {
        (bytes32 id, address operator) = _matchedId("encumbered", 3);
        reserve.assignCredit(id, operator, 21_000 ether);
        uint256 available = reserve.unencumberedBalance();
        (bool ok,) = address(reserve).call(abi.encodeWithSelector(reserve.treasuryTransfer.selector, payable(address(0xBEEF)), available + 1, keccak256("overspend")));
        require(!ok, "assigned collateral protected");
        _assertSolvent();
    }

    function testUnregisteredFundedCreditCanBeReclaimed() public {
        (bytes32 id, address operator) = _matchedId("reclaim", 4);
        uint256 before = address(reserve).balance;
        reserve.assignCredit(id, operator, 21_000 ether);
        reserve.fundCredit(id);
        reserve.reclaimUnregisteredCredit(id);
        require(address(reserve).balance == before, "reserve restored");
        require(registry.pendingProtocolCredit(id) == 0, "pending cleared");
        require(reserve.assignedCredit(id) == 0 && reserve.fundedCredit(id) == 0, "assignment cleared");
        _assertSolvent();
    }

    function testProtocolCreditReplacementReturnsValueToReserve() public {
        (bytes32 id, address operator) = _registerMatched("replace", 5);
        uint256 reserveBefore = address(reserve).balance;
        vm.deal(operator, 10_000 ether);
        vm.prank(operator);
        registry.replaceProtocolCredit{value: 10_000 ether}(id);
        ValidatorRegistry.Validator memory v = registry.getValidator(id);
        require(v.ownedBond == 31_000 ether && v.protocolCredit == 11_000 ether, "replacement composition");
        require(address(reserve).balance == reserveBefore + 10_000 ether, "credit recycled");
        require(reserve.assignedCredit(id) == 11_000 ether && reserve.fundedCredit(id) == 11_000 ether, "reserve sync");
        _assertSolvent();
    }

    function testConsensusSystemCallerIsOneTimeAndGovernanceCannotForgeOutcome() public {
        (bool rebind,) = address(registry).call(abi.encodeWithSelector(registry.bindConsensusSystemCaller.selector, address(0xBAD)));
        require(!rebind, "one-time bind");
        (bytes32 id,) = _registerSelfFunded("authority", 6);
        (bool forged,) = address(registry).call(abi.encodeWithSelector(registry.applyConsensusState.selector, id, ValidatorRegistry.Status.PROBATION, uint64(1), uint64(0), uint64(0), uint64(0)));
        require(!forged, "governance cannot forge consensus state");
    }

    function testActivationRequiresOneFullRotationAndFullBond() public {
        (bytes32 id,) = _registerSelfFunded("activation", 7);
        _state(id, ValidatorRegistry.Status.PROBATION, 1, 0, 0, 0);
        vm.prank(SYSTEM_CALLER);
        (bool early,) = address(registry).call(abi.encodeWithSelector(registry.applyConsensusState.selector, id, ValidatorRegistry.Status.ELIGIBLE, uint64(2), uint64(1), uint64(0), uint64(0)));
        require(!early, "activation delay");
        _rollPastActivation(id);
        _state(id, ValidatorRegistry.Status.ELIGIBLE, 2, 1, 0, 0);
        require(registry.eligibleValidatorCount() == 1, "eligible");
    }

    function testSystemSafetyBlocksNewActivationOutsideNormal() public {
        (bytes32 id,) = _registerSelfFunded("safety-activation", 14);
        _state(id, ValidatorRegistry.Status.PROBATION, 1, 0, 0, 0);
        _rollPastActivation(id);
        _state(id, ValidatorRegistry.Status.ELIGIBLE, 2, 1, 0, 0);

        env.safety().setState(ISystemSafety420.SafetyState.HALTED);
        vm.prank(SYSTEM_CALLER);
        (bool activated,) = address(registry).call(
            abi.encodeWithSelector(
                registry.applyConsensusState.selector,
                id,
                ValidatorRegistry.Status.ACTIVE,
                uint64(3),
                uint64(1),
                uint64(4),
                uint64(0)
            )
        );
        require(!activated, "HALTED safety admitted activation");
        require(registry.getValidator(id).status == ValidatorRegistry.Status.ELIGIBLE, "failed activation mutated status");

        env.safety().setState(ISystemSafety420.SafetyState.NORMAL);
        _state(id, ValidatorRegistry.Status.ACTIVE, 3, 1, 4, 0);
        require(registry.getValidator(id).status == ValidatorRegistry.Status.ACTIVE, "normal activation failed");
    }

    function testStakeSafetyFailsClosedOnInactiveOrCodeHashMismatch() public {
        (bytes32 id,) = _registerSelfFunded("safety-registry", 15);
        _state(id, ValidatorRegistry.Status.PROBATION, 1, 0, 0, 0);
        _rollPastActivation(id);
        _state(id, ValidatorRegistry.Status.ELIGIBLE, 2, 1, 0, 0);

        bytes32 systemSafetyId = keccak256("420/APP/SYSTEM_SAFETY");
        env.registry().setLifecycle(systemSafetyId, Types420.Lifecycle.PAUSED);
        vm.prank(SYSTEM_CALLER);
        (bool inactiveAccepted,) = address(registry).call(
            abi.encodeWithSelector(
                registry.applyConsensusState.selector,
                id,
                ValidatorRegistry.Status.ACTIVE,
                uint64(3),
                uint64(1),
                uint64(4),
                uint64(0)
            )
        );
        require(!inactiveAccepted, "inactive SystemSafety accepted");
        require(registry.getValidator(id).status == ValidatorRegistry.Status.ELIGIBLE, "inactive safety mutated state");

        env.registry().setLifecycle(systemSafetyId, Types420.Lifecycle.ACTIVE);
        env.registry().setCodeHash(systemSafetyId, keccak256("wrong-runtime-hash"));
        vm.prank(SYSTEM_CALLER);
        (bool hashMismatchAccepted,) = address(registry).call(
            abi.encodeWithSelector(
                registry.applyConsensusState.selector,
                id,
                ValidatorRegistry.Status.ACTIVE,
                uint64(3),
                uint64(1),
                uint64(4),
                uint64(0)
            )
        );
        require(!hashMismatchAccepted, "code-hash mismatch accepted");
        require(registry.getValidator(id).status == ValidatorRegistry.Status.ELIGIBLE, "hash mismatch mutated state");
    }

    function testCooldownIsBondedButNotSelectionEligible() public {
        (bytes32 id,) = _registerSelfFunded("cooldown", 12);
        _state(id, ValidatorRegistry.Status.PROBATION, 1, 0, 0, 0);
        _rollPastActivation(id);
        _state(id, ValidatorRegistry.Status.ELIGIBLE, 2, 1, 0, 0);
        _state(id, ValidatorRegistry.Status.ACTIVE, 3, 1, 4, 0);
        for (uint64 rotation = 1; rotation <= 4; ++rotation) _snapshot(rotation, 1);
        _state(id, ValidatorRegistry.Status.NORMAL_COOLDOWN, 4, 1, 4, 7);
        require(registry.eligibleValidatorCount() == 0, "cooldown selection eligibility");
        ValidatorRegistry.Validator memory v = registry.getValidator(id);
        require(v.ownedBond + v.protocolCredit == 42_000 ether, "cooldown bond custody");
    }

    function testProportionalSlashMovesOwnedValueAndRecyclesCredit() public {
        (bytes32 id,) = _registerMatched("slash", 8);
        _state(id, ValidatorRegistry.Status.PROBATION, 1, 0, 0, 0);
        uint256 protocolReserveBefore = registry.PROTOCOL_RESERVE().balance;
        uint256 communityBefore = address(reserve).balance;
        vm.prank(SYSTEM_CALLER);
        registry.applySlash(id, ValidatorRegistry.SlashOffense.DOUBLE_VOTE, 0, 1_000 ether, 1_000 ether, keccak256("double-vote-proof"), ValidatorRegistry.Status.SUSPENDED);
        ValidatorRegistry.Validator memory v = registry.getValidator(id);
        require(v.ownedBond == 20_000 ether && v.protocolCredit == 20_000 ether, "composition slashed");
        require(registry.PROTOCOL_RESERVE().balance == protocolReserveBefore + 1_000 ether, "owned slash routed");
        require(address(reserve).balance == communityBefore + 1_000 ether, "credit recycled");
        require(reserve.assignedCredit(id) == 20_000 ether, "reserve assignment reduced");
        _assertSolvent();
    }

    function testDuplicateSlashEvidenceCannotChargeTwice() public {
        (bytes32 id,) = _registerMatched("slash-replay", 13);
        _state(id, ValidatorRegistry.Status.PROBATION, 1, 0, 0, 0);
        bytes32 evidenceHash = keccak256("same-finalized-evidence");
        vm.prank(SYSTEM_CALLER);
        registry.applySlash(
            id,
            ValidatorRegistry.SlashOffense.DOUBLE_VOTE,
            0,
            1_000 ether,
            1_000 ether,
            evidenceHash,
            ValidatorRegistry.Status.SUSPENDED
        );

        ValidatorRegistry.Validator memory once = registry.getValidator(id);
        uint256 protocolReserveAfterFirst = registry.PROTOCOL_RESERVE().balance;
        uint256 communityAfterFirst = address(reserve).balance;

        vm.prank(SYSTEM_CALLER);
        (bool replayed,) = address(registry).call(
            abi.encodeWithSelector(
                registry.applySlash.selector,
                id,
                ValidatorRegistry.SlashOffense.DOUBLE_VOTE,
                uint8(0),
                uint256(1_000 ether),
                uint256(1_000 ether),
                evidenceHash,
                ValidatorRegistry.Status.SUSPENDED
            )
        );
        require(!replayed, "duplicate evidence replayed");

        ValidatorRegistry.Validator memory afterReplay = registry.getValidator(id);
        require(afterReplay.ownedBond == once.ownedBond && afterReplay.protocolCredit == once.protocolCredit, "replay changed collateral");
        require(afterReplay.totalSlashed == once.totalSlashed, "replay changed slash accounting");
        require(registry.PROTOCOL_RESERVE().balance == protocolReserveAfterFirst, "replay moved owned slash");
        require(address(reserve).balance == communityAfterFirst, "replay moved protocol credit");
        require(registry.slashEvidenceApplied(evidenceHash), "evidence not recorded");
        _assertSolvent();
    }

    function testFinalityEquivocationConsumesOwnedAndRevokesAllCredit() public {
        (bytes32 id,) = _registerMatched("finality", 9);
        _state(id, ValidatorRegistry.Status.PROBATION, 1, 0, 0, 0);
        vm.prank(SYSTEM_CALLER);
        registry.applySlash(id, ValidatorRegistry.SlashOffense.FINALITY_EQUIVOCATION, 2, 21_000 ether, 21_000 ether, keccak256("conflicting-finality-proof"), ValidatorRegistry.Status.SUSPENDED);
        ValidatorRegistry.Validator memory v = registry.getValidator(id);
        require(v.ownedBond == 0 && v.protocolCredit == 0, "all collateral removed");
        require(reserve.assignedCredit(id) == 0 && reserve.fundedCredit(id) == 0, "all credit recycled");
        require(registry.totalOwnedCustody() == 0 && registry.totalProtocolCreditCustody() == 0, "custody cleared");
        _assertSolvent();
    }

    function testExitWithdrawalReturnsOwnedAndRecyclesCredit() public {
        (bytes32 id, address operator) = _registerMatched("exit", 10);
        address withdrawal = address(uint160(uint256(uint160(operator)) + 0x10000));
        _state(id, ValidatorRegistry.Status.PROBATION, 1, 0, 0, 0);
        _rollPastActivation(id);
        _state(id, ValidatorRegistry.Status.ELIGIBLE, 2, 1, 0, 0);
        _snapshot(1, 1);
        vm.prank(SYSTEM_CALLER);
        registry.applyExitNotice(id, 1);
        _snapshot(2, 1);
        _state(id, ValidatorRegistry.Status.WITHDRAWAL_HOLD, 3, 1, 0, 0);
        ValidatorRegistry.Validator memory held = registry.getValidator(id);
        vm.roll(held.withdrawableBlock);
        _state(id, ValidatorRegistry.Status.WITHDRAWABLE, 4, 1, 0, 0);
        uint256 withdrawalBefore = withdrawal.balance;
        uint256 reserveBefore = address(reserve).balance;

        env.safety().setAllowed(false);
        vm.prank(withdrawal);
        (bool blocked,) = address(registry).call(abi.encodeWithSelector(registry.withdrawBond.selector, id));
        require(!blocked, "withdrawal ignored SystemSafety denial");
        require(registry.getValidator(id).status == ValidatorRegistry.Status.WITHDRAWABLE, "blocked withdrawal mutated status");

        env.safety().setAllowed(true);
        env.safety().setState(ISystemSafety420.SafetyState.HALTED);
        vm.prank(withdrawal);
        registry.withdrawBond(id);
        ValidatorRegistry.Validator memory exited = registry.getValidator(id);
        require(exited.status == ValidatorRegistry.Status.EXITED, "exited");
        require(withdrawal.balance == withdrawalBefore + 21_000 ether, "owned returned");
        require(address(reserve).balance == reserveBefore + 21_000 ether, "credit recycled");
        require(registry.totalOwnedCustody() == 0 && registry.totalProtocolCreditCustody() == 0, "custody empty");
        _assertSolvent();
    }

    function testStakeFacadeReportsCollateralSolvency() public {
        (bytes32 id,) = _registerMatched("facade", 11);
        (uint256 owned, uint256 credit, uint256 effective, uint256 slashed) = stake.validatorBondComposition(id);
        require(owned == 21_000 ether && credit == 21_000 ether && effective == 42_000 ether && slashed == 0, "facade composition");
        (uint256 totalOwned, uint256 totalCredit, uint256 pending, bool solvent) = stake.collateralTotals();
        require(totalOwned == 21_000 ether && totalCredit == 21_000 ether && pending == 0 && solvent, "facade custody");
    }

    function testConsensusRewardAppliesOncePerExecutionBlock() public {
        vm.roll(100);
        address proposer = address(0x5100);
        address[] memory participants = new address[](2);
        participants[0] = address(0x5101);
        participants[1] = address(0x5102);

        vm.prank(SYSTEM_CALLER);
        rewards.applyConsensusReward(100, proposer, participants, 10 ether, 2 ether, 3 ether, 4 ether);
        require(rewards.rewardApplied(100), "reward block not recorded");
        require(rewards.validatorAccrued(proposer) == 10 ether, "proposer accrual");
        require(rewards.validatorAccrued(participants[0]) == 2 ether, "participant accrual");

        uint256 securityOnce = rewards.grossSecurityIssued();
        vm.prank(SYSTEM_CALLER);
        (bool replayed,) = address(rewards).call(
            abi.encodeWithSelector(
                rewards.applyConsensusReward.selector,
                uint64(100),
                proposer,
                participants,
                uint256(10 ether),
                uint256(2 ether),
                uint256(3 ether),
                uint256(4 ether)
            )
        );
        require(!replayed, "reward replayed");
        require(rewards.grossSecurityIssued() == securityOnce, "replay changed issuance");
    }

    function testConsensusRewardRejectsWrongBlockAndDuplicateParticipants() public {
        vm.roll(200);
        address proposer = address(0x5200);
        address[] memory one = new address[](1);
        one[0] = address(0x5201);

        vm.prank(SYSTEM_CALLER);
        (bool wrongBlock,) = address(rewards).call(
            abi.encodeWithSelector(
                rewards.applyConsensusReward.selector,
                uint64(199),
                proposer,
                one,
                uint256(1 ether),
                uint256(1 ether),
                uint256(1 ether),
                uint256(1 ether)
            )
        );
        require(!wrongBlock, "wrong reward block accepted");

        address[] memory duplicate = new address[](2);
        duplicate[0] = address(0x5201);
        duplicate[1] = address(0x5201);
        vm.prank(SYSTEM_CALLER);
        (bool duplicateAccepted,) = address(rewards).call(
            abi.encodeWithSelector(
                rewards.applyConsensusReward.selector,
                uint64(200),
                proposer,
                duplicate,
                uint256(1 ether),
                uint256(1 ether),
                uint256(1 ether),
                uint256(1 ether)
            )
        );
        require(!duplicateAccepted, "duplicate participant accepted");
        require(!rewards.rewardApplied(200), "invalid reward marked applied");
    }

    function testDynamicCommitteeTiersAndRewardAllocation() public view {
        require(registry.targetActiveCount(59) == 0, "below handoff");
        require(registry.targetActiveCount(60) == 15, "60 tier");
        require(registry.targetActiveCount(120) == 30, "120 tier");
        require(registry.rotationTurnover(15) == 5 && registry.rotationTurnover(30) == 10, "turnover");
        (uint256 s15, uint256 a15, uint256 d15) = registry.rewardAllocation(15);
        require(s15 + a15 + d15 == registry.ALLOCATION_SCALE(), "15 conservation");
        (uint256 s30, uint256 a30, uint256 d30) = registry.rewardAllocation(30);
        require(s30 == 500_000_000_000 && a30 == 250_000_000_000 && d30 == 250_000_000_000, "mature split");
    }

    function _registerSelfFunded(string memory label, uint256 seed) internal returns (bytes32 id, address operator) {
        id = keccak256(bytes(label));
        operator = address(uint160(0x10000 + seed));
        address withdrawal = address(uint160(0x20000 + seed));
        vm.deal(operator, 42_000 ether);
        vm.prank(operator);
        registry.register{value: 42_000 ether}(id, _pubkey(seed), withdrawal, keccak256(abi.encode(label)));
    }

    function _matchedId(string memory label, uint256 seed) internal pure returns (bytes32 id, address operator) {
        id = keccak256(bytes(label));
        operator = address(uint160(0x30000 + seed));
    }

    function _registerMatched(string memory label, uint256 seed) internal returns (bytes32 id, address operator) {
        (id, operator) = _matchedId(label, seed);
        reserve.assignCredit(id, operator, 21_000 ether);
        reserve.fundCredit(id);
        _completeMatchedRegistration(id, operator, seed);
    }

    function _completeMatchedRegistration(bytes32 id, address operator, uint256 seed) internal {
        address withdrawal = address(uint160(uint256(uint160(operator)) + 0x10000));
        vm.deal(operator, 21_000 ether);
        vm.prank(operator);
        registry.register{value: 21_000 ether}(id, _pubkey(seed), withdrawal, keccak256(abi.encode(id)));
    }

    function _state(bytes32 id, ValidatorRegistry.Status status, uint64 slot, uint64 activationRotation, uint64 exitRotation, uint64 cooldownUntil) internal {
        vm.prank(SYSTEM_CALLER);
        registry.applyConsensusState(id, status, slot, activationRotation, exitRotation, cooldownUntil);
    }

    function _snapshot(uint64 rotation, uint256 eligible) internal {
        vm.prank(SYSTEM_CALLER);
        registry.applyRotationSnapshot(rotation, eligible);
    }

    function _rollPastActivation(bytes32 id) internal {
        ValidatorRegistry.Validator memory v = registry.getValidator(id);
        vm.roll(uint256(v.registrationBlock) + registry.ACTIVATION_DELAY_BLOCKS());
    }

    function _assertSolvent() internal view {
        require(registry.custodyInvariant(), "registry insolvent");
        require(reserve.reserveInvariant(), "reserve insolvent");
    }

    function _pubkey(uint256 seed) internal pure returns (bytes memory) {
        return abi.encodePacked(bytes32(seed), bytes16(uint128(seed + 1)));
    }
}
