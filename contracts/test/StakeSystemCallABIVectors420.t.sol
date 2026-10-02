// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/system/ValidatorRegistry.sol";
import "../src/system/RewardController.sol";

contract StakeSystemCallABIVectors420Test {
    bytes32 internal constant ID_01 = 0x0101010101010101010101010101010101010101010101010101010101010101;
    bytes32 internal constant ID_02 = 0x0202020202020202020202020202020202020202020202020202020202020202;
    bytes32 internal constant ID_03 = 0x0303030303030303030303030303030303030303030303030303030303030303;
    bytes32 internal constant EVIDENCE_AA = 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa;

    function testExactStakeSystemCallABIVectors() external pure {
        bytes memory validatorState = abi.encodeWithSelector(
            ValidatorRegistry.applyConsensusState.selector,
            ID_03,
            ValidatorRegistry.Status.ACTIVE,
            uint64(4201),
            uint64(2),
            uint64(5),
            uint64(0)
        );
        require(
            keccak256(validatorState) == keccak256(
                hex"17e619d80303030303030303030303030303030303030303030303030303030303030303"
                hex"0000000000000000000000000000000000000000000000000000000000000004"
                hex"0000000000000000000000000000000000000000000000000000000000001069"
                hex"0000000000000000000000000000000000000000000000000000000000000002"
                hex"0000000000000000000000000000000000000000000000000000000000000005"
                hex"0000000000000000000000000000000000000000000000000000000000000000"
            ),
            "validator-state ABI vector"
        );

        bytes memory exitNotice = abi.encodeWithSelector(
            ValidatorRegistry.applyExitNotice.selector,
            ID_01,
            uint64(2)
        );
        require(
            keccak256(exitNotice) == keccak256(
                hex"3dc84ed00101010101010101010101010101010101010101010101010101010101010101"
                hex"0000000000000000000000000000000000000000000000000000000000000002"
            ),
            "exit ABI vector"
        );

        bytes memory slash = abi.encodeWithSelector(
            ValidatorRegistry.applySlash.selector,
            ID_02,
            ValidatorRegistry.SlashOffense.DOUBLE_PROPOSAL,
            uint8(1),
            uint256(3000 ether),
            uint256(1200 ether),
            EVIDENCE_AA,
            ValidatorRegistry.Status.SUSPENDED
        );
        require(
            keccak256(slash) == keccak256(
                hex"0c6c52040202020202020202020202020202020202020202020202020202020202020202"
                hex"0000000000000000000000000000000000000000000000000000000000000003"
                hex"0000000000000000000000000000000000000000000000000000000000000001"
                hex"0000000000000000000000000000000000000000000000a2a15d09519be00000"
                hex"0000000000000000000000000000000000000000000000410d586a20a4c00000"
                hex"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                hex"0000000000000000000000000000000000000000000000000000000000000006"
            ),
            "slash ABI vector"
        );

        bytes memory rotation = abi.encodeWithSelector(
            ValidatorRegistry.applyRotationSnapshot.selector,
            uint64(2),
            uint256(60)
        );
        require(
            keccak256(rotation) == keccak256(
                hex"6594414c"
                hex"0000000000000000000000000000000000000000000000000000000000000002"
                hex"000000000000000000000000000000000000000000000000000000000000003c"
            ),
            "rotation ABI vector"
        );

        address[] memory participants = new address[](2);
        participants[0] = address(0x2222222222222222222222222222222222222222);
        participants[1] = address(0x3333333333333333333333333333333333333333);
        bytes memory reward = abi.encodeWithSelector(
            RewardController.applyConsensusReward.selector,
            uint64(4201),
            address(0x1111111111111111111111111111111111111111),
            participants,
            uint256(595238095237800000),
            uint256(42517006802700000),
            uint256(1504761904762200000),
            uint256(1504761904762200000)
        );
        require(
            keccak256(reward) == keccak256(
                hex"ac11b5e1"
                hex"0000000000000000000000000000000000000000000000000000000000001069"
                hex"0000000000000000000000001111111111111111111111111111111111111111"
                hex"00000000000000000000000000000000000000000000000000000000000000e0"
                hex"0000000000000000000000000000000000000000000000000842b5e4d76de040"
                hex"00000000000000000000000000000000000000000000000000970cfe0f6346e0"
                hex"00000000000000000000000000000000000000000000000014e1fcfad4e41fc0"
                hex"00000000000000000000000000000000000000000000000014e1fcfad4e41fc0"
                hex"0000000000000000000000000000000000000000000000000000000000000002"
                hex"0000000000000000000000002222222222222222222222222222222222222222"
                hex"0000000000000000000000003333333333333333333333333333333333333333"
            ),
            "reward ABI vector"
        );
    }
}
