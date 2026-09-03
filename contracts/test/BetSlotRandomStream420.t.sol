// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bet/SlotRandomStream420.sol";

interface VmBetSlotRandomStream420 {
    function expectRevert(bytes4) external;
}

contract BetSlotRandomStream420Test {
    VmBetSlotRandomStream420 constant vm = VmBetSlotRandomStream420(address(uint160(uint256(keccak256("hevm cheat code")))));

    bytes32 constant ROOT = keccak256("slot/root/v1");
    bytes32 constant WAGER = keccak256("slot/wager/v1");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.SLOT.V1");
    bytes32 constant RULESET = keccak256("420BET.RULESET.SLOT.V1");

    function testDrawIsDeterministicAndDomainSeparated() public {
        SlotRandomStream420 stream = new SlotRandomStream420();
        uint256 a = stream.draw(ROOT, WAGER, GAME_V1, RULESET, stream.BASE_PHASE(), 0, 0);
        uint256 b = stream.draw(ROOT, WAGER, GAME_V1, RULESET, stream.BASE_PHASE(), 0, 0);
        require(a == b, "draw changed");

        require(
            a != stream.draw(ROOT, WAGER, GAME_V1, RULESET, stream.BASE_PHASE(), 0, 1),
            "reel not separated"
        );
        require(
            a != stream.draw(ROOT, WAGER, GAME_V1, RULESET, stream.FEATURE_PHASE(), 0, 0),
            "phase not separated"
        );
        require(
            a != stream.draw(ROOT, WAGER, GAME_V1, RULESET, stream.BASE_PHASE(), 1, 0),
            "spin not separated"
        );
        require(
            a != stream.draw(keccak256("slot/root/v2"), WAGER, GAME_V1, RULESET, stream.BASE_PHASE(), 0, 0),
            "root not separated"
        );
    }

    function testReelStopIsAlwaysBounded() public {
        SlotRandomStream420 stream = new SlotRandomStream420();
        for (uint16 spin = 0; spin < 64; ++spin) {
            for (uint8 reel = 0; reel < 5; ++reel) {
                uint16 stop = stream.reelStop(ROOT, WAGER, GAME_V1, RULESET, stream.BASE_PHASE(), spin, reel, 64);
                require(stop < 64, "stop escaped strip");
            }
        }
    }

    function testInvalidInputsFailClosed() public {
        SlotRandomStream420 stream = new SlotRandomStream420();

        vm.expectRevert(SlotRandomStream420.InvalidRoot.selector);
        stream.draw(bytes32(0), WAGER, GAME_V1, RULESET, stream.BASE_PHASE(), 0, 0);

        vm.expectRevert(SlotRandomStream420.InvalidPhase.selector);
        stream.draw(ROOT, WAGER, GAME_V1, RULESET, keccak256("unknown"), 0, 0);

        vm.expectRevert(SlotRandomStream420.InvalidStripLength.selector);
        stream.reelStop(ROOT, WAGER, GAME_V1, RULESET, stream.BASE_PHASE(), 0, 0, 0);
    }

    function testFuzzDrawRemainsDeterministic(uint256 seed) public {
        SlotRandomStream420 stream = new SlotRandomStream420();
        bytes32 root = keccak256(abi.encode("slot/fuzz/root", seed));
        if (root == bytes32(0)) root = bytes32(uint256(1));
        uint256 a = stream.draw(root, WAGER, GAME_V1, RULESET, stream.FEATURE_PHASE(), 7, 4);
        uint256 b = stream.draw(root, WAGER, GAME_V1, RULESET, stream.FEATURE_PHASE(), 7, 4);
        require(a == b, "fuzz nondeterminism");
    }
}
