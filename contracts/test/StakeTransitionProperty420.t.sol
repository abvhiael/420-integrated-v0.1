// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./helpers/GenesisMocks420.sol";
import "../src/system/ValidatorRegistry.sol";

interface VmStakeTransition420 {
    function deal(address account, uint256 newBalance) external;
    function prank(address msgSender) external;
    function roll(uint256 newHeight) external;
}

contract StakeTransitionProperty420Test {
    VmStakeTransition420 internal constant vm =
        VmStakeTransition420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address internal constant SYSTEM_CALLER = 0x000000000000000000000000000000000000043C;

    struct Fixture {
        GenesisMockEnvironment420 env;
        ValidatorRegistry registry;
        bytes32 id;
        address owner;
        address withdrawal;
    }

    function testFuzz_TransitionGraphMatchesCanonicalEdges(uint8 sourceRaw, uint8 targetRaw, uint64 seed) public {
        ValidatorRegistry.Status source = ValidatorRegistry.Status(1 + (uint256(sourceRaw) % 9));
        ValidatorRegistry.Status target = ValidatorRegistry.Status(1 + (uint256(targetRaw) % 9));

        Fixture memory f = _fixtureAt(source, uint256(seed) + 1);
        _prepareEdge(f, source, target);

        ValidatorRegistry.Validator memory beforeState = f.registry.getValidator(f.id);
        (
            uint64 effectiveSlot,
            uint64 activationRotation,
            uint64 scheduledExitRotation,
            uint64 cooldownUntilRotation
        ) = _parametersFor(beforeState, source, target, f.registry.lastRotationSnapshot());

        vm.prank(SYSTEM_CALLER);
        (bool ok,) = address(f.registry).call(
            abi.encodeWithSelector(
                f.registry.applyConsensusState.selector,
                f.id,
                target,
                effectiveSlot,
                activationRotation,
                scheduledExitRotation,
                cooldownUntilRotation
            )
        );

        bool expected = _canonicalEdge(source, target);
        require((ok) == (expected), "STAKE-INV-003 transition graph mismatch");
        if (!expected) {
            ValidatorRegistry.Validator memory afterRejected = f.registry.getValidator(f.id);
            require((uint8(afterRejected.status)) == (uint8(beforeState.status)), "rejected transition changed status");
            require((afterRejected.ownedBond) == (beforeState.ownedBond), "rejected transition changed owned bond");
            require((afterRejected.protocolCredit) == (beforeState.protocolCredit), "rejected transition changed credit");
        }
    }

    function _fixtureAt(ValidatorRegistry.Status source, uint256 seed) internal returns (Fixture memory f) {
        f.env = new GenesisMockEnvironment420();
        f.registry = new ValidatorRegistry(address(this), address(f.env.registry()), keccak256(abi.encode("stake-audit-4-transition", seed)));
        f.registry.bindConsensusSystemCaller(SYSTEM_CALLER);

        f.id = keccak256(abi.encode("transition-validator", seed));
        f.owner = address(uint160(0x110000 + (seed % 0xFFFF)));
        f.withdrawal = address(uint160(0x220000 + (seed % 0xFFFF)));
        vm.deal(f.owner, 42_000 ether);
        vm.prank(f.owner);
        f.registry.register{value: 42_000 ether}(f.id, _pubkey(seed), f.withdrawal, keccak256(abi.encode(seed)));

        if (source == ValidatorRegistry.Status.REGISTERED) return f;

        _state(f.registry, f.id, ValidatorRegistry.Status.PROBATION, 1, 0, 0, 0);
        if (source == ValidatorRegistry.Status.PROBATION) return f;

        if (source == ValidatorRegistry.Status.SUSPENDED) {
            _state(f.registry, f.id, ValidatorRegistry.Status.SUSPENDED, 2, 0, 0, 0);
            return f;
        }

        if (source == ValidatorRegistry.Status.WITHDRAWAL_HOLD || source == ValidatorRegistry.Status.WITHDRAWABLE || source == ValidatorRegistry.Status.EXITED) {
            vm.prank(SYSTEM_CALLER);
            f.registry.applyExitNotice(f.id, 1);
            f.registry.applyRotationSnapshot(2, 0);
            _state(f.registry, f.id, ValidatorRegistry.Status.WITHDRAWAL_HOLD, 2, 0, 0, 0);
            if (source == ValidatorRegistry.Status.WITHDRAWAL_HOLD) return f;

            ValidatorRegistry.Validator memory held = f.registry.getValidator(f.id);
            vm.roll(held.withdrawableBlock);
            _state(f.registry, f.id, ValidatorRegistry.Status.WITHDRAWABLE, 3, 0, 0, 0);
            if (source == ValidatorRegistry.Status.WITHDRAWABLE) return f;

            vm.prank(f.withdrawal);
            f.registry.withdrawBond(f.id);
            return f;
        }

        ValidatorRegistry.Validator memory registered = f.registry.getValidator(f.id);
        vm.roll(uint256(registered.registrationBlock) + f.registry.ACTIVATION_DELAY_BLOCKS());
        _state(f.registry, f.id, ValidatorRegistry.Status.ELIGIBLE, 2, 1, 0, 0);
        if (source == ValidatorRegistry.Status.ELIGIBLE) return f;

        _state(f.registry, f.id, ValidatorRegistry.Status.ACTIVE, 3, 1, 4, 0);
        if (source == ValidatorRegistry.Status.ACTIVE) return f;

        for (uint64 rotation = 1; rotation <= 4; ++rotation) {
            vm.prank(SYSTEM_CALLER);
            f.registry.applyRotationSnapshot(rotation, 1);
        }
        _state(f.registry, f.id, ValidatorRegistry.Status.NORMAL_COOLDOWN, 4, 1, 4, 7);
        return f;
    }

    function _prepareEdge(Fixture memory f, ValidatorRegistry.Status source, ValidatorRegistry.Status target) internal {
        if (source == ValidatorRegistry.Status.PROBATION && target == ValidatorRegistry.Status.ELIGIBLE) {
            ValidatorRegistry.Validator memory v = f.registry.getValidator(f.id);
            uint256 activationBlock = uint256(v.registrationBlock) + f.registry.ACTIVATION_DELAY_BLOCKS();
            if (block.number < activationBlock) vm.roll(activationBlock);
        }

        if (target == ValidatorRegistry.Status.WITHDRAWAL_HOLD && source != ValidatorRegistry.Status.WITHDRAWAL_HOLD) {
            ValidatorRegistry.Validator memory v = f.registry.getValidator(f.id);
            if (v.status == ValidatorRegistry.Status.EXITED || v.status == ValidatorRegistry.Status.WITHDRAWABLE) return;

            uint64 last = f.registry.lastRotationSnapshot();
            uint64 notice = last == 0 ? 1 : last;
            if (source == ValidatorRegistry.Status.ACTIVE && notice < v.scheduledExitRotation - 1) {
                notice = v.scheduledExitRotation - 1;
            }
            vm.prank(SYSTEM_CALLER);
            f.registry.applyExitNotice(f.id, notice);
            uint64 required = notice + f.registry.EXIT_NOTICE_ROTATIONS();
            if (source == ValidatorRegistry.Status.ACTIVE && required < v.scheduledExitRotation) {
                required = v.scheduledExitRotation;
            }
            if (required > f.registry.lastRotationSnapshot()) {
                uint256 eligible = (source == ValidatorRegistry.Status.ELIGIBLE || source == ValidatorRegistry.Status.ACTIVE) ? 1 : 0;
                vm.prank(SYSTEM_CALLER);
                f.registry.applyRotationSnapshot(required, eligible);
            }
        }

        if (source == ValidatorRegistry.Status.ACTIVE && target == ValidatorRegistry.Status.NORMAL_COOLDOWN) {
            ValidatorRegistry.Validator memory v = f.registry.getValidator(f.id);
            if (f.registry.lastRotationSnapshot() < v.scheduledExitRotation) {
                vm.prank(SYSTEM_CALLER);
                vm.prank(SYSTEM_CALLER);
            f.registry.applyRotationSnapshot(v.scheduledExitRotation, 1);
            }
        }

        if (source == ValidatorRegistry.Status.NORMAL_COOLDOWN && target == ValidatorRegistry.Status.ELIGIBLE) {
            ValidatorRegistry.Validator memory v = f.registry.getValidator(f.id);
            if (f.registry.lastRotationSnapshot() < v.cooldownUntilRotation) {
                vm.prank(SYSTEM_CALLER);
                vm.prank(SYSTEM_CALLER);
            f.registry.applyRotationSnapshot(v.cooldownUntilRotation, 0);
            }
        }

        if (source == ValidatorRegistry.Status.WITHDRAWAL_HOLD && target == ValidatorRegistry.Status.WITHDRAWABLE) {
            ValidatorRegistry.Validator memory v = f.registry.getValidator(f.id);
            if (block.number < v.withdrawableBlock) vm.roll(v.withdrawableBlock);
        }
    }

    function _parametersFor(
        ValidatorRegistry.Validator memory v,
        ValidatorRegistry.Status source,
        ValidatorRegistry.Status target,
        uint64 lastRotation
    )
        internal
        pure
        returns (uint64 effectiveSlot, uint64 activationRotation, uint64 scheduledExitRotation, uint64 cooldownUntilRotation)
    {
        effectiveSlot = v.effectiveSlot + 1;
        activationRotation = v.activationRotation;
        scheduledExitRotation = v.scheduledExitRotation;
        cooldownUntilRotation = v.cooldownUntilRotation;

        if (target == ValidatorRegistry.Status.ACTIVE) {
            activationRotation = source == ValidatorRegistry.Status.ACTIVE ? v.activationRotation : (lastRotation == 0 ? 1 : lastRotation);
            scheduledExitRotation = activationRotation + 3;
        }
        if (source == ValidatorRegistry.Status.ACTIVE && target == ValidatorRegistry.Status.NORMAL_COOLDOWN) {
            activationRotation = v.activationRotation;
            scheduledExitRotation = v.scheduledExitRotation;
            cooldownUntilRotation = lastRotation + 3;
        }
    }

    function _canonicalEdge(ValidatorRegistry.Status a, ValidatorRegistry.Status b) internal pure returns (bool) {
        if (a == b) return true;
        if (a == ValidatorRegistry.Status.REGISTERED) return b == ValidatorRegistry.Status.PROBATION || b == ValidatorRegistry.Status.SUSPENDED;
        if (a == ValidatorRegistry.Status.PROBATION) return b == ValidatorRegistry.Status.ELIGIBLE || b == ValidatorRegistry.Status.SUSPENDED || b == ValidatorRegistry.Status.WITHDRAWAL_HOLD;
        if (a == ValidatorRegistry.Status.ELIGIBLE) return b == ValidatorRegistry.Status.ACTIVE || b == ValidatorRegistry.Status.SUSPENDED || b == ValidatorRegistry.Status.WITHDRAWAL_HOLD;
        if (a == ValidatorRegistry.Status.ACTIVE) return b == ValidatorRegistry.Status.NORMAL_COOLDOWN || b == ValidatorRegistry.Status.SUSPENDED || b == ValidatorRegistry.Status.WITHDRAWAL_HOLD;
        if (a == ValidatorRegistry.Status.NORMAL_COOLDOWN) return b == ValidatorRegistry.Status.ELIGIBLE || b == ValidatorRegistry.Status.SUSPENDED || b == ValidatorRegistry.Status.WITHDRAWAL_HOLD;
        if (a == ValidatorRegistry.Status.SUSPENDED) return b == ValidatorRegistry.Status.PROBATION || b == ValidatorRegistry.Status.WITHDRAWAL_HOLD;
        if (a == ValidatorRegistry.Status.WITHDRAWAL_HOLD) return b == ValidatorRegistry.Status.WITHDRAWABLE || b == ValidatorRegistry.Status.SUSPENDED;
        return false;
    }

    function _state(
        ValidatorRegistry registry,
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

    function _pubkey(uint256 seed) internal pure returns (bytes memory out) {
        out = new bytes(48);
        bytes32 a = keccak256(abi.encode(seed, uint256(1)));
        bytes32 b = keccak256(abi.encode(seed, uint256(2)));
        for (uint256 i; i < 32; ++i) out[i] = a[i];
        for (uint256 i; i < 16; ++i) out[32 + i] = b[i];
    }
}
