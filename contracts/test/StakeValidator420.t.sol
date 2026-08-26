// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/stake/Stake420.sol";
import "../src/validator/Validator420.sol";
import "./helpers/GenesisMocks420.sol";

interface VmStakeValidator420 {
    function deal(address account, uint256 newBalance) external;
    function prank(address msgSender) external;
    function roll(uint256 newHeight) external;
}

contract SlashReceiver420 {
    receive() external payable {}
}

contract StakeValidator420Test {
    VmStakeValidator420 internal constant vm =
        VmStakeValidator420(address(uint160(uint256(keccak256("hevm cheat code")))));

    GenesisMockEnvironment420 internal env;
    Stake420 internal stake;
    Validator420 internal validators;
    SlashReceiver420 internal slashReceiver;

    function setUp() public {
        env = new GenesisMockEnvironment420();
        slashReceiver = new SlashReceiver420();
        stake = new Stake420(address(this), address(env.registry()), keccak256("stake-validator-test"));
        validators = new Validator420(
            address(this),
            address(env.registry()),
            keccak256("stake-validator-test"),
            address(stake),
            address(this),
            address(slashReceiver)
        );
        env.registerResident(address(stake), stake.componentId());
        env.registerResident(address(validators), validators.componentId());
        stake.bindValidatorRegistry(address(validators));
    }

    function testFrozenEconomicConstantsAndTierMath() public view {
        require(stake.VALIDATOR_BOND() == 42_000 ether, "bond");
        require(validators.ROTATION_BLOCKS() == 17_640, "rotation");
        require(validators.ACTIVE_TERM_ROTATIONS() == 3, "active term");
        require(validators.targetActiveCount(59) == 0, "bootstrap threshold");
        require(validators.targetActiveCount(60) == 15, "60 tier");
        require(validators.targetActiveCount(72) == 18, "72 tier");
        require(validators.targetActiveCount(120) == 30, "120 tier");
        require(validators.rotationTurnover(15) == 5, "15 turnover");
        require(validators.rotationTurnover(30) == 10, "30 turnover");

        (uint256 security15, uint256 attention15, uint256 development15) = validators.allocation(15);
        require(security15 == validators.MIN_SECURITY_ALLOCATION(), "min security");
        require(security15 + attention15 + development15 == validators.ALLOCATION_SCALE(), "15 allocation conservation");

        (uint256 security30, uint256 attention30, uint256 development30) = validators.allocation(30);
        require(security30 == 500_000_000_000, "mature security");
        require(attention30 == 250_000_000_000 && development30 == 250_000_000_000, "mature split");
    }

    function testRegistrationLocksExactBondAndRejectsDuplicateOwner() public {
        address operator = address(0xA420);
        vm.deal(operator, 100_000 ether);
        vm.prank(operator);
        uint64 id = validators.registerValidator{value: 42_000 ether}(_pubkey(1), operator, keccak256("metadata"));

        IStake420.ValidatorBond memory b = stake.bond(id);
        require(b.owner == operator && b.bonded == 42_000 ether, "bond custody");
        require(validators.validatorIdByOwner(operator) == id, "owner index");

        vm.prank(operator);
        (bool ok,) = address(validators).call{value: 42_000 ether}(
            abi.encodeWithSelector(Validator420.registerValidator.selector, _pubkey(2), operator, bytes32(0))
        );
        require(!ok, "duplicate owner");
    }

    function testDuplicateConsensusKeyRejected() public {
        address a = address(0xA1);
        address b = address(0xB1);
        vm.deal(a, 42_000 ether);
        vm.deal(b, 42_000 ether);
        bytes memory key = _pubkey(9);
        vm.prank(a);
        validators.registerValidator{value: 42_000 ether}(key, a, bytes32(0));
        vm.prank(b);
        (bool ok,) = address(validators).call{value: 42_000 ether}(
            abi.encodeWithSelector(Validator420.registerValidator.selector, key, b, bytes32(0))
        );
        require(!ok, "duplicate key");
    }

    function testActivationRequiresReadinessDelayAndFullBond() public {
        (uint64 id,) = _register(11);
        validators.setOperationalReady(id, true, keccak256("ready"));
        (bool early,) = address(validators).call(abi.encodeWithSelector(Validator420.promoteEligible.selector, id));
        require(!early, "activation delay");

        IValidator420.ValidatorRecord memory v = validators.validator(id);
        vm.roll(v.activationEligibleBlock);
        validators.promoteEligible(id);
        v = validators.validator(id);
        require(v.status == IValidator420.Status.ELIGIBLE && v.eligibleForPool, "eligible");
        require(validators.eligibleValidatorCount() == 1, "eligible count");
    }

    function testThreeSnapshotHysteresisBeforeBondedTargetBecomes15() public {
        _makeEligible(60);
        require(validators.eligibleValidatorCount() == 60, "60 eligible");
        validators.recordRotationSnapshot(1, 60);
        require(validators.currentActiveTarget() == 0, "snapshot one");
        validators.recordRotationSnapshot(2, 60);
        require(validators.currentActiveTarget() == 0, "snapshot two");
        validators.recordRotationSnapshot(3, 60);
        require(validators.currentActiveTarget() == 15, "snapshot three");
    }

    function testActiveTermCooldownAndReturnToEligibility() public {
        _makeEligible(60);
        validators.recordRotationSnapshot(1, 60);
        validators.recordRotationSnapshot(2, 60);
        validators.recordRotationSnapshot(3, 60);

        uint64 id = 1;
        validators.activateValidator(id, 0, 3);
        IValidator420.ValidatorRecord memory active = validators.validator(id);
        require(active.status == IValidator420.Status.ACTIVE, "active");
        require(active.scheduledExitRotation == 6, "three rotation term");

        validators.completeActiveTerm(id, 6);
        IValidator420.ValidatorRecord memory cooldown = validators.validator(id);
        require(cooldown.status == IValidator420.Status.COOLDOWN, "cooldown");
        require(cooldown.cooldownUntilRotation == 9, "cooldown duration");

        validators.completeCooldown(id, 9);
        require(validators.validator(id).status == IValidator420.Status.ELIGIBLE, "eligible again");
    }

    function testVoluntaryExitKeepsBondSlashableUntilWithdrawalDelay() public {
        (uint64 id, address operator) = _register(77);
        validators.setOperationalReady(id, true, keccak256("ready"));
        IValidator420.ValidatorRecord memory v = validators.validator(id);
        vm.roll(v.activationEligibleBlock);
        validators.promoteEligible(id);

        vm.prank(operator);
        validators.requestExit(id);
        IStake420.ValidatorBond memory pending = stake.bond(id);
        require(pending.pendingWithdrawal == 42_000 ether, "pending principal");
        require(pending.withdrawalBlock > block.number, "delay");

        validators.slashValidator(id, 2_000 ether, keccak256("provable-fault"), true);
        pending = stake.bond(id);
        require(pending.bonded == 40_000 ether, "slashed bond");
        require(pending.pendingWithdrawal == 40_000 ether, "pending reduced");
        require(address(slashReceiver).balance == 2_000 ether, "slash receiver");

        vm.roll(pending.withdrawalBlock);
        uint256 before = operator.balance;
        vm.prank(operator);
        stake.withdrawValidatorPrincipal(id);
        require(operator.balance == before + 40_000 ether, "principal returned");

        vm.prank(operator);
        validators.markExited(id);
        require(validators.validator(id).status == IValidator420.Status.EXITED, "exited");
    }

    function testRewardCreditIsConsensusOnlyAndClaimableByOperator() public {
        (uint64 id, address operator) = _register(88);
        validators.setOperationalReady(id, true, keccak256("ready"));
        IValidator420.ValidatorRecord memory v = validators.validator(id);
        vm.roll(v.activationEligibleBlock);
        validators.promoteEligible(id);

        _makeEligibleFrom(2, 59);
        validators.recordRotationSnapshot(1, 60);
        validators.recordRotationSnapshot(2, 60);
        validators.recordRotationSnapshot(3, 60);
        validators.activateValidator(id, 0, 3);

        vm.deal(address(this), 10 ether);
        validators.creditValidatorReward{value: 1.05 ether}(id, keccak256("block-reward"));
        require(stake.bond(id).rewards == 1.05 ether, "reward balance");

        uint256 before = operator.balance;
        vm.prank(operator);
        stake.claimValidatorRewards(id);
        require(operator.balance == before + 1.05 ether, "claimed reward");
    }

    function _makeEligible(uint256 count) internal {
        _makeEligibleFrom(1, count);
    }

    function _makeEligibleFrom(uint256 startSeed, uint256 count) internal {
        uint64[] memory ids = new uint64[](count);
        for (uint256 i = 0; i < count; ++i) {
            (uint64 id,) = _register(startSeed + i);
            ids[i] = id;
            validators.setOperationalReady(id, true, keccak256(abi.encode("ready", id)));
        }
        uint256 activation = validators.validator(ids[count - 1]).activationEligibleBlock;
        vm.roll(activation);
        for (uint256 i = 0; i < count; ++i) validators.promoteEligible(ids[i]);
    }

    function _register(uint256 seed) internal returns (uint64 id, address operator) {
        operator = address(uint160(0x100000 + seed));
        vm.deal(operator, 42_000 ether);
        vm.prank(operator);
        id = validators.registerValidator{value: 42_000 ether}(_pubkey(seed), operator, keccak256(abi.encode(seed)));
    }

    function _pubkey(uint256 seed) internal pure returns (bytes memory) {
        return abi.encodePacked(bytes32(seed), bytes16(uint128(seed + 1)));
    }
}
