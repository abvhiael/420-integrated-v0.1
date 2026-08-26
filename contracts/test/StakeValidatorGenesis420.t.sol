// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/system/ValidatorRegistry.sol";
import "../src/system/RewardController.sol";
import "../src/apps/Stake420.sol";

interface VmStakeValidatorGenesis420 {
    function prank(address msgSender) external;
    function roll(uint256 newHeight) external;
}

contract StakeValidatorGenesis420Test {
    VmStakeValidatorGenesis420 internal constant vm =
        VmStakeValidatorGenesis420(address(uint160(uint256(keccak256("hevm cheat code")))));

    ValidatorRegistry internal registry;
    RewardController internal rewards;
    Stake420 internal stake;
    address internal constant SYSTEM_CALLER = address(0x420C0DE);

    function setUp() public {
        registry = new ValidatorRegistry(address(this));
        rewards = new RewardController(address(this));
        registry.bindConsensusSystemCaller(SYSTEM_CALLER);
        rewards.bindConsensusSystemCaller(SYSTEM_CALLER);
        stake = new Stake420(address(registry), address(rewards));
    }

    function testGenesisBondLifecycleAndDelegationPolicy() public view {
        require(registry.EFFECTIVE_BOND() == 42_000 ether, "effective bond");
        require(registry.MIN_OWNED_BOND() == 21_000 ether, "owned floor");
        require(registry.MAX_PROTOCOL_CREDIT() == 21_000 ether, "credit cap");
        require(registry.ACTIVATION_DELAY_BLOCKS() == 17_640, "activation delay");
        require(registry.EXIT_NOTICE_ROTATIONS() == 1, "exit notice");
        require(registry.WITHDRAWAL_DELAY_BLOCKS() == 105_840, "withdrawal delay");
        require(registry.COOLDOWN_ROTATIONS() == 3, "cooldown");
        require(stake.effectiveBond() == 42_000 ether, "stake facade bond");
        require(!stake.delegationEnabled(), "delegation disabled");
        require(!stake.stakeWeightedVotingEnabled(), "stake voting disabled");
    }

    function testConsensusSystemCallerIsOneTimeAndGovernanceCannotForgeOutcome() public {
        (bool rebind,) = address(registry).call(
            abi.encodeWithSelector(registry.bindConsensusSystemCaller.selector, address(0xBAD))
        );
        require(!rebind, "one-time bind");

        bytes32 id = _register("authority", 1, 42_000 ether, 0);
        (bool forged,) = address(registry).call(
            abi.encodeWithSelector(
                registry.applyConsensusState.selector,
                id,
                ValidatorRegistry.Status.PROBATION,
                uint64(1),
                uint64(0),
                uint64(0),
                uint64(0)
            )
        );
        require(!forged, "governance cannot forge consensus state");

        address[] memory participants = new address[](0);
        (bool rewardForged,) = address(rewards).call(
            abi.encodeWithSelector(
                rewards.applyConsensusReward.selector,
                uint64(1), address(0xA1), participants, 1 ether, 0, 0, 0
            )
        );
        require(!rewardForged, "governance cannot forge reward");
    }

    function testDynamicCommitteeTiersAndRewardAllocation() public view {
        require(registry.targetActiveCount(59) == 0, "below handoff");
        require(registry.targetActiveCount(60) == 15, "60 tier");
        require(registry.targetActiveCount(72) == 18, "72 tier");
        require(registry.targetActiveCount(84) == 21, "84 tier");
        require(registry.targetActiveCount(96) == 24, "96 tier");
        require(registry.targetActiveCount(108) == 27, "108 tier");
        require(registry.targetActiveCount(120) == 30, "120 tier");
        require(registry.rotationTurnover(15) == 5, "15 turnover");
        require(registry.rotationTurnover(30) == 10, "30 turnover");

        (uint256 s15, uint256 a15, uint256 d15) = registry.rewardAllocation(15);
        require(s15 == registry.MIN_SECURITY_ALLOCATION(), "minimum security");
        require(s15 + a15 + d15 == registry.ALLOCATION_SCALE(), "15 conservation");

        (uint256 s30, uint256 a30, uint256 d30) = registry.rewardAllocation(30);
        require(s30 == 500_000_000_000, "mature security");
        require(a30 == 250_000_000_000 && d30 == 250_000_000_000, "mature remainder");
    }

    function testSelfFundedAndMatchedBondRegistration() public {
        bytes32 selfId = _register("self-funded", 2, 42_000 ether, 0);
        ValidatorRegistry.Validator memory self = registry.getValidator(selfId);
        require(self.ownedBond == 42_000 ether && self.protocolCredit == 0, "self funded");

        bytes32 matchedId = _register("matched", 3, 21_000 ether, 21_000 ether);
        ValidatorRegistry.Validator memory matched = registry.getValidator(matchedId);
        require(matched.ownedBond + matched.protocolCredit == 42_000 ether, "matched effective");
    }

    function testDuplicateOwnerAndBLSPubkeyFailClosed() public {
        registry.register(keccak256("one"), _pubkey(4), address(0xC1), address(0xC2), 42_000 ether, 0);

        (bool ownerOk,) = address(registry).call(
            abi.encodeWithSelector(
                ValidatorRegistry.register.selector,
                keccak256("two"), _pubkey(5), address(0xC1), address(0xD2), 42_000 ether, 0
            )
        );
        require(!ownerOk, "duplicate owner");

        (bool keyOk,) = address(registry).call(
            abi.encodeWithSelector(
                ValidatorRegistry.register.selector,
                keccak256("three"), _pubkey(4), address(0xD1), address(0xD2), 42_000 ether, 0
            )
        );
        require(!keyOk, "duplicate BLS key");
    }

    function testActivationRequiresOneFullRotation() public {
        bytes32 id = _register("activation", 6, 42_000 ether, 0);
        _state(id, ValidatorRegistry.Status.PROBATION, 1, 0, 0, 0);

        vm.prank(SYSTEM_CALLER);
        (bool early,) = address(registry).call(
            abi.encodeWithSelector(
                registry.applyConsensusState.selector,
                id, ValidatorRegistry.Status.ELIGIBLE, uint64(2), uint64(1), uint64(0), uint64(0)
            )
        );
        require(!early, "activation must wait one rotation");

        ValidatorRegistry.Validator memory v = registry.getValidator(id);
        vm.roll(uint256(v.registrationBlock) + registry.ACTIVATION_DELAY_BLOCKS());
        _state(id, ValidatorRegistry.Status.ELIGIBLE, 2, 1, 0, 0);
        require(registry.eligibleValidatorCount() == 1, "eligible after delay");
    }

    function testExitNoticeAndSixRotationWithdrawalHold() public {
        bytes32 id = _register("exit", 7, 42_000 ether, 0);
        _state(id, ValidatorRegistry.Status.PROBATION, 1, 0, 0, 0);
        _rollPastActivation(id);
        _state(id, ValidatorRegistry.Status.ELIGIBLE, 2, 1, 0, 0);
        _snapshot(1, 1);

        vm.prank(SYSTEM_CALLER);
        registry.applyExitNotice(id, 1);

        vm.prank(SYSTEM_CALLER);
        (bool earlyExit,) = address(registry).call(
            abi.encodeWithSelector(
                registry.applyConsensusState.selector,
                id, ValidatorRegistry.Status.WITHDRAWAL_HOLD, uint64(3), uint64(1), uint64(0), uint64(0)
            )
        );
        require(!earlyExit, "one rotation exit notice");

        _snapshot(2, 1);
        _state(id, ValidatorRegistry.Status.WITHDRAWAL_HOLD, 3, 1, 0, 0);
        ValidatorRegistry.Validator memory held = registry.getValidator(id);
        require(held.withdrawableBlock == block.number + registry.WITHDRAWAL_DELAY_BLOCKS(), "six rotation hold");

        vm.prank(SYSTEM_CALLER);
        (bool earlyWithdrawable,) = address(registry).call(
            abi.encodeWithSelector(
                registry.applyConsensusState.selector,
                id, ValidatorRegistry.Status.WITHDRAWABLE, uint64(4), uint64(1), uint64(0), uint64(0)
            )
        );
        require(!earlyWithdrawable, "slashability window active");

        vm.roll(held.withdrawableBlock);
        _state(id, ValidatorRegistry.Status.WITHDRAWABLE, 4, 1, 0, 0);
    }

    function testSlashingMatrixAndProportionalMatchedCollateral() public {
        require(registry.maxSlashBps(ValidatorRegistry.SlashOffense.INACTIVITY, 0) == 0, "inactivity reward-only");
        require(registry.maxSlashBps(ValidatorRegistry.SlashOffense.INVALID_CONSENSUS_MESSAGE, 0) == 250, "invalid message");
        require(registry.maxSlashBps(ValidatorRegistry.SlashOffense.DOUBLE_PROPOSAL, 0) == 500, "double proposal");
        require(registry.maxSlashBps(ValidatorRegistry.SlashOffense.DOUBLE_VOTE, 0) == 1_000, "double vote");
        require(registry.maxSlashBps(ValidatorRegistry.SlashOffense.DOUBLE_VOTE, 2) == 3_000, "correlated double vote");
        require(registry.maxSlashBps(ValidatorRegistry.SlashOffense.FINALITY_EQUIVOCATION, 2) == 10_000, "finality max");

        bytes32 id = _register("slash", 8, 21_000 ether, 21_000 ether);
        _state(id, ValidatorRegistry.Status.PROBATION, 1, 0, 0, 0);

        vm.prank(SYSTEM_CALLER);
        registry.applySlash(
            id,
            ValidatorRegistry.SlashOffense.DOUBLE_VOTE,
            0,
            1_000 ether,
            1_000 ether,
            keccak256("double-vote-proof"),
            ValidatorRegistry.Status.SUSPENDED
        );
        ValidatorRegistry.Validator memory v = registry.getValidator(id);
        require(v.ownedBond == 20_000 ether && v.protocolCredit == 20_000 ether, "proportional slash");
        require(v.totalSlashed == 2_000 ether, "slash total");
    }

    function testFinalityEquivocationConsumesAllCollateral() public {
        bytes32 id = _register("finality", 9, 21_000 ether, 21_000 ether);
        _state(id, ValidatorRegistry.Status.PROBATION, 1, 0, 0, 0);

        vm.prank(SYSTEM_CALLER);
        registry.applySlash(
            id,
            ValidatorRegistry.SlashOffense.FINALITY_EQUIVOCATION,
            2,
            21_000 ether,
            21_000 ether,
            keccak256("conflicting-finality-proof"),
            ValidatorRegistry.Status.SUSPENDED
        );
        ValidatorRegistry.Validator memory v = registry.getValidator(id);
        require(v.ownedBond == 0 && v.protocolCredit == 0, "all collateral consumed");
        require(v.totalSlashed == 42_000 ether, "full slash");
    }

    function testThreeSnapshotHysteresisAtSixtyEligible() public {
        bytes32[] memory ids = new bytes32[](60);
        for (uint256 i = 0; i < 60; ++i) {
            ids[i] = _registerIndexed(i);
            _state(ids[i], ValidatorRegistry.Status.PROBATION, 1, 0, 0, 0);
        }
        vm.roll(block.number + registry.ACTIVATION_DELAY_BLOCKS());
        for (uint256 i = 0; i < 60; ++i) {
            _state(ids[i], ValidatorRegistry.Status.ELIGIBLE, 2, 1, 0, 0);
        }
        require(registry.eligibleValidatorCount() == 60, "60 eligible");
        _snapshot(1, 60);
        require(registry.activeTarget() == 0, "snapshot 1");
        _snapshot(2, 60);
        require(registry.activeTarget() == 0, "snapshot 2");
        _snapshot(3, 60);
        require(registry.activeTarget() == 15, "snapshot 3");
    }

    function testStakeFacadeReadsCanonicalRegistryAndRewards() public {
        bytes32 id = _register("facade", 70, 42_000 ether, 0);
        address operator = registry.getValidator(id).owner;
        _state(id, ValidatorRegistry.Status.PROBATION, 1, 0, 0, 0);
        _rollPastActivation(id);
        _state(id, ValidatorRegistry.Status.ELIGIBLE, 2, 1, 0, 0);

        address[] memory participants = new address[](0);
        vm.prank(SYSTEM_CALLER);
        rewards.applyConsensusReward(1, operator, participants, 1.05 ether, 0, 1.05 ether, 1.05 ether);

        (uint256 owned, uint256 credit, uint256 effective, uint256 slashed) = stake.validatorBondComposition(id);
        require(owned == 42_000 ether && credit == 0 && effective == 42_000 ether && slashed == 0, "facade bond");
        require(stake.validatorRewardAccrued(id) == 1.05 ether, "facade reward");
        require(uint8(stake.validatorStatus(id)) == uint8(IValidatorRegistry420.Status.ELIGIBLE), "facade status");
    }

    function _register(string memory label, uint256 seed, uint256 owned, uint256 credit) internal returns (bytes32 id) {
        id = keccak256(bytes(label));
        registry.register(id, _pubkey(seed), address(uint160(0x10000 + seed)), address(uint160(0x20000 + seed)), owned, credit);
    }

    function _registerIndexed(uint256 i) internal returns (bytes32 id) {
        id = keccak256(abi.encode("validator", i));
        registry.register(
            id,
            _pubkey(100 + i),
            address(uint160(0x30000 + i)),
            address(uint160(0x40000 + i)),
            42_000 ether,
            0
        );
    }

    function _state(
        bytes32 id,
        ValidatorRegistry.Status status,
        uint64 slot,
        uint64 activationRotation,
        uint64 exitRotation,
        uint64 cooldownUntil
    ) internal {
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

    function _pubkey(uint256 seed) internal pure returns (bytes memory) {
        return abi.encodePacked(bytes32(seed), bytes16(uint128(seed + 1)));
    }
}
