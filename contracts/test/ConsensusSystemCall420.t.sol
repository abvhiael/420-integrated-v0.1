// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/system/ConsensusSystemCall420.sol";

interface VmConsensusSystemCall420 {
    function prank(address msgSender) external;
}

contract ConsensusSystemCall420Test {
    VmConsensusSystemCall420 internal constant vm =
        VmConsensusSystemCall420(address(uint160(uint256(keccak256("hevm cheat code")))));

    ConsensusSystemCall420 internal gateway;

    function setUp() public {
        gateway = new ConsensusSystemCall420(address(this));
    }

    function testFrozenIdentitiesAndRoutes() public view {
        require(gateway.NATIVE_SYSTEM_ORIGIN() == 0xfffffffffffffffffffffffffffffffffffffffe, "origin");
        require(gateway.REWARD_CONTROLLER() == 0x0000000000000000000000000000000000000420, "reward");
        require(gateway.VALIDATOR_REGISTRY() == 0x0000000000000000000000000000000000000423, "validator");

        (address target,) = gateway.route(gateway.ACTION_VALIDATOR_STATE());
        require(target == gateway.VALIDATOR_REGISTRY(), "validator route");
        (target,) = gateway.route(gateway.ACTION_REWARD());
        require(target == gateway.REWARD_CONTROLLER(), "reward route");
    }

    function testOrdinaryCallerCannotApplySystemCall() public {
        bytes memory payload = abi.encodeWithSignature("applyRotationSnapshot(uint64,uint256)", uint64(1), uint256(60));
        (bool ok,) = address(gateway).call(
            abi.encodeWithSelector(gateway.apply.selector,uint64(1),uint64(block.number),blockhash(block.number - 1),block.chainid,gateway.ACTION_ROTATION_SNAPSHOT(),gateway.VALIDATOR_REGISTRY(),payload)
        );
        require(!ok, "ordinary caller accepted");
    }

    function testNativeOriginRejectsWrongChainAndWrongBlock() public {
        bytes memory payload = abi.encodeWithSignature("applyRotationSnapshot(uint64,uint256)", uint64(1), uint256(60));
        vm.prank(gateway.NATIVE_SYSTEM_ORIGIN());
        (bool wrongChain,) = address(gateway).call(
            abi.encodeWithSelector(gateway.apply.selector,uint64(1),uint64(block.number),blockhash(block.number - 1),block.chainid + 1,gateway.ACTION_ROTATION_SNAPSHOT(),gateway.VALIDATOR_REGISTRY(),payload)
        );
        require(!wrongChain, "wrong chain accepted");

        vm.prank(gateway.NATIVE_SYSTEM_ORIGIN());
        (bool wrongBlock,) = address(gateway).call(
            abi.encodeWithSelector(gateway.apply.selector,uint64(1),uint64(block.number + 1),blockhash(block.number - 1),block.chainid,gateway.ACTION_ROTATION_SNAPSHOT(),gateway.VALIDATOR_REGISTRY(),payload)
        );
        require(!wrongBlock, "wrong block accepted");
    }

    function testActionCannotBeRedirectedToWrongTarget() public {
        bytes memory payload = abi.encodeWithSignature("applyRotationSnapshot(uint64,uint256)", uint64(1), uint256(60));
        vm.prank(gateway.NATIVE_SYSTEM_ORIGIN());
        (bool ok,) = address(gateway).call(
            abi.encodeWithSelector(gateway.apply.selector,uint64(1),uint64(block.number),blockhash(block.number - 1),block.chainid,gateway.ACTION_ROTATION_SNAPSHOT(),gateway.REWARD_CONTROLLER(),payload)
        );
        require(!ok, "action redirected");
    }

    function testActionCannotUseWrongSelector() public {
        bytes memory payload = abi.encodeWithSignature("applyExitNotice(bytes32,uint64)", bytes32(uint256(1)), uint64(1));
        vm.prank(gateway.NATIVE_SYSTEM_ORIGIN());
        (bool ok,) = address(gateway).call(
            abi.encodeWithSelector(gateway.apply.selector,uint64(1),uint64(block.number),blockhash(block.number - 1),block.chainid,gateway.ACTION_ROTATION_SNAPSHOT(),gateway.VALIDATOR_REGISTRY(),payload)
        );
        require(!ok, "wrong selector accepted");
    }

    function testUnknownActionFailsClosed() public {
        bytes memory payload = abi.encodeWithSignature("applyRotationSnapshot(uint64,uint256)", uint64(1), uint256(60));
        vm.prank(gateway.NATIVE_SYSTEM_ORIGIN());
        (bool ok,) = address(gateway).call(
            abi.encodeWithSelector(gateway.apply.selector,uint64(1),uint64(block.number),blockhash(block.number - 1),block.chainid,keccak256("420/SYSCALL/UNKNOWN/V1"),gateway.VALIDATOR_REGISTRY(),payload)
        );
        require(!ok, "unknown action accepted");
    }

    function testRemovedAccountingOnlyBondActionFailsClosed() public {
        bytes32 removedBondAction = keccak256("420/SYSCALL/VALIDATOR_BOND/V1");
        (bool ok,) = address(gateway).staticcall(abi.encodeWithSelector(gateway.route.selector, removedBondAction));
        require(!ok, "removed bond action remains routable");
    }
}
