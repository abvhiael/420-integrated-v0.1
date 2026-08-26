// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/system/ValidatorRegistry.sol";
import "../src/system/RewardController.sol";
import "../src/apps/Stake420.sol";

contract StakeValidatorGenesis420Test {
    ValidatorRegistry internal registry;
    RewardController internal rewards;
    Stake420 internal stake;

    function setUp() public {
        registry = new ValidatorRegistry(address(this));
        rewards = new RewardController(address(this));
        stake = new Stake420(address(registry), address(rewards));
    }

    function testGenesisBondAndDelegationPolicy() public view {
        require(registry.EFFECTIVE_BOND() == 42_000 ether, "effective bond");
        require(registry.MIN_OWNED_BOND() == 21_000 ether, "owned floor");
        require(registry.MAX_PROTOCOL_CREDIT() == 21_000 ether, "credit cap");
        require(stake.effectiveBond() == 42_000 ether, "stake facade bond");
        require(!stake.delegationEnabled(), "delegation disabled");
        require(!stake.stakeWeightedVotingEnabled(), "stake voting disabled");
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
        bytes32 selfId = keccak256("self-funded");
        registry.register(selfId, _pubkey(1), address(0xA1), address(0xA2), 42_000 ether, 0);
        ValidatorRegistry.Validator memory self = registry.getValidator(selfId);
        require(self.ownedBond == 42_000 ether && self.protocolCredit == 0, "self funded");

        bytes32 matchedId = keccak256("matched");
        registry.register(matchedId, _pubkey(2), address(0xB1), address(0xB2), 21_000 ether, 21_000 ether);
        ValidatorRegistry.Validator memory matched = registry.getValidator(matchedId);
        require(matched.ownedBond + matched.protocolCredit == 42_000 ether, "matched effective");
    }

    function testDuplicateOwnerAndBLSPubkeyFailClosed() public {
        registry.register(keccak256("one"), _pubkey(3), address(0xC1), address(0xC2), 42_000 ether, 0);

        (bool ownerOk,) = address(registry).call(
            abi.encodeWithSelector(
                ValidatorRegistry.register.selector,
                keccak256("two"), _pubkey(4), address(0xC1), address(0xD2), 42_000 ether, 0
            )
        );
        require(!ownerOk, "duplicate owner");

        (bool keyOk,) = address(registry).call(
            abi.encodeWithSelector(
                ValidatorRegistry.register.selector,
                keccak256("three"), _pubkey(3), address(0xD1), address(0xD2), 42_000 ether, 0
            )
        );
        require(!keyOk, "duplicate BLS key");
    }

    function testLifecycleTransitionsTrackEligiblePool() public {
        bytes32 id = keccak256("lifecycle");
        registry.register(id, _pubkey(5), address(0xE1), address(0xE2), 42_000 ether, 0);
        registry.applyConsensusState(id, ValidatorRegistry.Status.PROBATION, 10, 0, 0, 0);
        require(registry.eligibleValidatorCount() == 0, "probation excluded");

        registry.applyConsensusState(id, ValidatorRegistry.Status.ELIGIBLE, 20, 1, 0, 0);
        require(registry.eligibleValidatorCount() == 1, "eligible counted");

        registry.applyConsensusState(id, ValidatorRegistry.Status.ACTIVE, 30, 2, 5, 0);
        require(registry.eligibleValidatorCount() == 1, "active counted");

        registry.applyConsensusState(id, ValidatorRegistry.Status.NORMAL_COOLDOWN, 40, 2, 5, 8);
        require(registry.eligibleValidatorCount() == 1, "cooldown counted");

        registry.applyConsensusState(id, ValidatorRegistry.Status.SUSPENDED, 50, 2, 5, 8);
        require(registry.eligibleValidatorCount() == 0, "suspended excluded");
    }

    function testInvalidLifecycleJumpRejected() public {
        bytes32 id = keccak256("invalid-transition");
        registry.register(id, _pubkey(6), address(0xF1), address(0xF2), 42_000 ether, 0);
        (bool ok,) = address(registry).call(
            abi.encodeWithSelector(
                ValidatorRegistry.applyConsensusState.selector,
                id, ValidatorRegistry.Status.ACTIVE, uint64(1), uint64(1), uint64(4), uint64(0)
            )
        );
        require(!ok, "registered cannot jump active");
    }

    function testEvidenceBoundSlashUpdatesBondCompositionAndEligibility() public {
        bytes32 id = keccak256("slash");
        registry.register(id, _pubkey(7), address(0x701), address(0x702), 21_000 ether, 21_000 ether);
        registry.applyConsensusState(id, ValidatorRegistry.Status.PROBATION, 1, 0, 0, 0);
        registry.applyConsensusState(id, ValidatorRegistry.Status.ELIGIBLE, 2, 1, 0, 0);
        require(registry.eligibleValidatorCount() == 1, "eligible first");

        registry.applySlash(id, 1_000 ether, 1_000 ether, keccak256("equivocation-proof"), ValidatorRegistry.Status.SUSPENDED);
        ValidatorRegistry.Validator memory v = registry.getValidator(id);
        require(v.ownedBond == 20_000 ether && v.protocolCredit == 20_000 ether, "slash composition");
        require(v.totalSlashed == 2_000 ether, "slash total");
        require(registry.eligibleValidatorCount() == 0, "slash exclusion");
    }

    function testThreeSnapshotHysteresisAtSixtyEligible() public {
        for (uint256 i = 0; i < 60; ++i) {
            bytes32 id = keccak256(abi.encode("validator", i));
            registry.register(id, _pubkey(100 + i), address(uint160(0x1000 + i)), address(uint160(0x2000 + i)), 42_000 ether, 0);
            registry.applyConsensusState(id, ValidatorRegistry.Status.PROBATION, 1, 0, 0, 0);
            registry.applyConsensusState(id, ValidatorRegistry.Status.ELIGIBLE, 2, 1, 0, 0);
        }
        require(registry.eligibleValidatorCount() == 60, "60 eligible");
        registry.applyRotationSnapshot(1, 60);
        require(registry.activeTarget() == 0, "snapshot 1");
        registry.applyRotationSnapshot(2, 60);
        require(registry.activeTarget() == 0, "snapshot 2");
        registry.applyRotationSnapshot(3, 60);
        require(registry.activeTarget() == 15, "snapshot 3");
    }

    function testStakeFacadeReadsCanonicalRegistryAndRewards() public {
        bytes32 id = keccak256("facade");
        address operator = address(0x4201);
        registry.register(id, _pubkey(8), operator, address(0x4202), 42_000 ether, 0);
        registry.applyConsensusState(id, ValidatorRegistry.Status.PROBATION, 1, 0, 0, 0);
        registry.applyConsensusState(id, ValidatorRegistry.Status.ELIGIBLE, 2, 1, 0, 0);

        address[] memory participants = new address[](0);
        rewards.applyConsensusReward(1, operator, participants, 1.05 ether, 0, 1.05 ether, 1.05 ether);

        (uint256 owned, uint256 credit, uint256 effective, uint256 slashed) = stake.validatorBondComposition(id);
        require(owned == 42_000 ether && credit == 0 && effective == 42_000 ether && slashed == 0, "facade bond");
        require(stake.validatorRewardAccrued(id) == 1.05 ether, "facade reward");
        require(uint8(stake.validatorStatus(id)) == uint8(IValidatorRegistry420.Status.ELIGIBLE), "facade status");
    }

    function _pubkey(uint256 seed) internal pure returns (bytes memory) {
        return abi.encodePacked(bytes32(seed), bytes16(uint128(seed + 1)));
    }
}
