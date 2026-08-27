// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/system/ValidatorRegistry.sol";

interface VmValidatorEligibility420 {
    function prank(address msgSender) external;
    function roll(uint256 newHeight) external;
    function deal(address account, uint256 newBalance) external;
}

contract ValidatorEligibility420Test {
    VmValidatorEligibility420 internal constant vm =
        VmValidatorEligibility420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address internal constant SYSTEM_CALLER = 0x000000000000000000000000000000000000043C;

    function testCooldownValidatorIsBondedButNotSelectionEligible() public {
        ValidatorRegistry registry = new ValidatorRegistry(address(this));
        registry.bindConsensusSystemCaller(SYSTEM_CALLER);

        bytes32 id = keccak256("cooldown-selection-eligibility");
        address operator = address(0xA420);
        vm.deal(operator, 42_000 ether);
        vm.prank(operator);
        registry.register{value: 42_000 ether}(
            id,
            abi.encodePacked(bytes32(uint256(1)), bytes16(uint128(2))),
            operator,
            keccak256("metadata")
        );

        vm.prank(SYSTEM_CALLER);
        registry.applyConsensusState(id, ValidatorRegistry.Status.PROBATION, 1, 0, 0, 0);

        ValidatorRegistry.Validator memory v = registry.getValidator(id);
        vm.roll(uint256(v.registrationBlock) + registry.ACTIVATION_DELAY_BLOCKS());

        vm.prank(SYSTEM_CALLER);
        registry.applyConsensusState(id, ValidatorRegistry.Status.ELIGIBLE, 2, 1, 0, 0);
        require(registry.eligibleValidatorCount() == 1, "eligible should count");

        vm.prank(SYSTEM_CALLER);
        registry.applyConsensusState(id, ValidatorRegistry.Status.ACTIVE, 3, 1, 4, 0);
        require(registry.eligibleValidatorCount() == 1, "active should count");

        for (uint64 rotation = 1; rotation <= 4; ++rotation) {
            vm.prank(SYSTEM_CALLER);
            registry.applyRotationSnapshot(rotation, 1);
        }

        vm.prank(SYSTEM_CALLER);
        registry.applyConsensusState(id, ValidatorRegistry.Status.NORMAL_COOLDOWN, 4, 1, 4, 7);

        require(registry.eligibleValidatorCount() == 0, "cooldown must not count");
        ValidatorRegistry.Validator memory cooled = registry.getValidator(id);
        require(cooled.ownedBond + cooled.protocolCredit == 42_000 ether, "cooldown remains bonded");
    }
}
