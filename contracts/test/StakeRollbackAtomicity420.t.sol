// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./helpers/GenesisMocks420.sol";
import "../src/system/ValidatorRegistry.sol";
import "../src/system/CommunityValidatorReserve.sol";
import "../src/system/ConsensusSystemCall420.sol";

contract RevertingReserve420 {
    function fund(ValidatorRegistry registry, bytes32 validatorId, address beneficiary) external payable {
        registry.receiveProtocolCredit{value: msg.value}(validatorId, beneficiary);
    }

    function returnCredit(bytes32) external payable {
        revert("reserve rejects credit return");
    }

    receive() external payable {}
}

contract RejectingWithdrawal420 {
    function attemptWithdraw(ValidatorRegistry registry, bytes32 validatorId) external returns (bool ok) {
        (ok,) = address(registry).call(abi.encodeWithSelector(registry.withdrawBond.selector, validatorId));
    }

    receive() external payable {
        revert("withdrawal rejects native 420");
    }
}

contract RevertingValidatorTarget420 {
    uint256 public touched;

    function applyRotationSnapshot(uint64, uint256) external {
        touched = 1;
        revert("downstream revert");
    }
}

interface VmStakeRollback420 {
    function deal(address account, uint256 newBalance) external;
    function prank(address msgSender) external;
    function roll(uint256 newHeight) external;
    function etch(address target, bytes calldata code) external;
}

contract StakeRollbackAtomicity420Test {
    VmStakeRollback420 internal constant vm =
        VmStakeRollback420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address internal constant NATIVE_SYSTEM_ORIGIN = 0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE;

    function testFuzz_ProtocolCreditReplacementRollbackOnReserveFailure(uint96 rawAmount) public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        ValidatorRegistry registry =
            new ValidatorRegistry(address(this), address(env.registry()), keccak256("stake-audit-4-rollback-credit"));
        RevertingReserve420 reserve = new RevertingReserve420();
        registry.bindCommunityValidatorReserve(address(reserve));

        bytes32 id = keccak256("rollback-credit-validator");
        address owner = address(0x4401);
        address withdrawal = address(0x4402);

        vm.deal(address(reserve), 21_000 ether);
        reserve.fund{value: 21_000 ether}(registry, id, owner);
        vm.deal(owner, 42_000 ether);
        vm.prank(owner);
        registry.register{value: 21_000 ether}(id, _pubkey(1), withdrawal, keccak256("rollback"));

        ValidatorRegistry.Validator memory beforeState = registry.getValidator(id);
        uint256 registryBalanceBefore = address(registry).balance;
        uint256 reserveBalanceBefore = address(reserve).balance;
        uint256 amount = 1 + (uint256(rawAmount) % beforeState.protocolCredit);

        vm.prank(owner);
        (bool ok,) = address(registry).call{value: amount}(
            abi.encodeWithSelector(registry.replaceProtocolCredit.selector, id)
        );
        require(!(ok), "STAKE-INV-007 replacement survived reserve failure");

        ValidatorRegistry.Validator memory afterState = registry.getValidator(id);
        require((afterState.ownedBond) == (beforeState.ownedBond), "owned bond changed on rollback");
        require((afterState.protocolCredit) == (beforeState.protocolCredit), "credit changed on rollback");
        require((registry.totalOwnedCustody()) == (beforeState.ownedBond), "owned custody changed on rollback");
        require((registry.totalProtocolCreditCustody()) == (beforeState.protocolCredit), "credit custody changed on rollback");
        require((address(registry).balance) == (registryBalanceBefore), "registry balance changed on rollback");
        require((address(reserve).balance) == (reserveBalanceBefore), "reserve balance changed on rollback");
        require((registry.custodyInvariant()), "custody invariant failed after rollback");
    }

    function testWithdrawalRollbackRestoresRegistryAndReserveWhenRecipientRejects() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        ValidatorRegistry registry =
            new ValidatorRegistry(address(this), address(env.registry()), keccak256("stake-audit-4-rollback-withdraw"));
        CommunityValidatorReserve reserve = new CommunityValidatorReserve(address(this));
        RejectingWithdrawal420 withdrawal = new RejectingWithdrawal420();

        registry.bindConsensusSystemCaller(address(this));
        registry.bindCommunityValidatorReserve(address(reserve));
        reserve.bindValidatorRegistry(address(registry));
        vm.deal(address(reserve), reserve.GENESIS_RESERVE());

        bytes32 id = keccak256("rollback-withdraw-validator");
        address owner = address(0x4501);
        reserve.assignCredit(id, owner, 21_000 ether);
        reserve.fundCredit(id);

        vm.deal(owner, 21_000 ether);
        vm.prank(owner);
        registry.register{value: 21_000 ether}(id, _pubkey(2), address(withdrawal), keccak256("withdraw-rollback"));

        registry.applyConsensusState(id, ValidatorRegistry.Status.PROBATION, 1, 0, 0, 0);
        ValidatorRegistry.Validator memory registered = registry.getValidator(id);
        vm.roll(uint256(registered.registrationBlock) + registry.ACTIVATION_DELAY_BLOCKS());
        registry.applyConsensusState(id, ValidatorRegistry.Status.ELIGIBLE, 2, 1, 0, 0);
        registry.applyExitNotice(id, 1);
        registry.applyRotationSnapshot(2, 1);
        registry.applyConsensusState(id, ValidatorRegistry.Status.WITHDRAWAL_HOLD, 3, 1, 0, 0);
        ValidatorRegistry.Validator memory held = registry.getValidator(id);
        vm.roll(held.withdrawableBlock);
        registry.applyConsensusState(id, ValidatorRegistry.Status.WITHDRAWABLE, 4, 1, 0, 0);

        ValidatorRegistry.Validator memory beforeState = registry.getValidator(id);
        uint256 registryBalanceBefore = address(registry).balance;
        uint256 reserveBalanceBefore = address(reserve).balance;
        uint256 reserveAssignedBefore = reserve.assignedCredit(id);
        uint256 reserveFundedBefore = reserve.fundedCredit(id);

        bool ok = withdrawal.attemptWithdraw(registry, id);
        require(!(ok), "STAKE-INV-007 withdrawal survived recipient failure");

        ValidatorRegistry.Validator memory afterState = registry.getValidator(id);
        require((uint8(afterState.status)) == (uint8(ValidatorRegistry.Status.WITHDRAWABLE)), "status changed on rollback");
        require((afterState.ownedBond) == (beforeState.ownedBond), "owned bond changed on rollback");
        require((afterState.protocolCredit) == (beforeState.protocolCredit), "credit changed on rollback");
        require((address(registry).balance) == (registryBalanceBefore), "registry value changed on rollback");
        require((address(reserve).balance) == (reserveBalanceBefore), "reserve value changed on rollback");
        require((reserve.assignedCredit(id)) == (reserveAssignedBefore), "reserve assignment changed on rollback");
        require((reserve.fundedCredit(id)) == (reserveFundedBefore), "reserve funded amount changed on rollback");
        require((registry.custodyInvariant()), "registry insolvent after rollback");
        require((reserve.reserveInvariant()), "reserve invariant failed after rollback");
    }

    function testSystemCallFailureRollsBackSequenceHashAndDownstreamState() public {
        ConsensusSystemCall420 gateway = new ConsensusSystemCall420(address(this));
        RevertingValidatorTarget420 implementation = new RevertingValidatorTarget420();
        address target = gateway.VALIDATOR_REGISTRY();
        vm.etch(target, address(implementation).code);

        uint64 sequence = 1;
        uint64 executionBlock = uint64(block.number);
        bytes32 parentHash = blockhash(block.number - 1);
        bytes memory payload = abi.encodeWithSignature("applyRotationSnapshot(uint64,uint256)", uint64(1), uint256(60));

        vm.prank(NATIVE_SYSTEM_ORIGIN);
        (bool ok,) = address(gateway).call(
            abi.encodeWithSelector(
                gateway.execute.selector,
                sequence,
                executionBlock,
                parentHash,
                block.chainid,
                gateway.ACTION_ROTATION_SNAPSHOT(),
                target,
                payload
            )
        );
        require(!(ok), "STAKE-INV-008 failing downstream call accepted");
        require((gateway.lastSequence()) == (0), "sequence advanced despite atomic revert");
        require((gateway.lastCallHash()) == (bytes32(0)), "call hash persisted despite atomic revert");
        require((RevertingValidatorTarget420(target).touched()) == (0), "downstream storage persisted despite revert");
    }

    function _pubkey(uint256 seed) internal pure returns (bytes memory out) {
        out = new bytes(48);
        bytes32 a = keccak256(abi.encode(seed, uint256(1)));
        bytes32 b = keccak256(abi.encode(seed, uint256(2)));
        for (uint256 i; i < 32; ++i) out[i] = a[i];
        for (uint256 i; i < 16; ++i) out[32 + i] = b[i];
    }
}
