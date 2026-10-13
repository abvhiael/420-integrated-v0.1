// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {bindRetainedR04Emergency,retainedR04AuthorizationRoot} from "../../mocks/R04EmergencyFixture.sol";
import { MissionEngine } from "../../../../src/highcountry/missions/MissionEngine.sol";

contract MissionR047Test {
    MissionEngine e;
    bytes32 constant ID = keccak256("mission");
    bytes32 constant NEXT = keccak256("next");

    function setUp() public {
        e = new MissionEngine(retainedR04AuthorizationRoot());
        bindRetainedR04Emergency(address(e));
        e.setVerifier(address(this), true);
        e.registerTemplate(ID, bytes32(uint256(1)), keccak256("objective"), bytes32(0), 1000, 2, 10);
        e.registerTemplate(NEXT, bytes32(uint256(1)), keccak256("next-objective"), ID, 1000, 1, 0);
    }

    function testLifecycleAndReplay() public {
        e.activate(ID);
        (bool duplicate,) = address(e).call(abi.encodeCall(e.activate, (ID)));
        require(!duplicate, "duplicate activation");
        e.attest(address(this), ID, bytes32(uint256(1)), 1);
        (bool replay,) = address(e).call(abi.encodeCall(e.attest, (address(this), ID, bytes32(uint256(1)), uint32(1))));
        require(!replay, "duplicate proof");
        e.attest(address(this), ID, bytes32(uint256(2)), 1);
        require(e.completed(address(this), ID), "no eligibility");
        e.claim(ID);
        (bool doubleClaim,) = address(e).call(abi.encodeCall(e.claim, (ID)));
        require(!doubleClaim, "double claim");
        e.activate(NEXT);
    }

    function testRejectInvalidAndNoUnpaidReward() public {
        (bool premature,) = address(e).call(abi.encodeCall(e.activate, (NEXT)));
        require(!premature, "prerequisite");
        e.activate(ID);
        (bool overflow,) =
            address(e).call(abi.encodeCall(e.attest, (address(this), ID, bytes32(uint256(3)), uint32(3))));
        require(!overflow, "overflow");
        (bool uncompleted,) = address(e).call(abi.encodeCall(e.claim, (ID)));
        require(!uncompleted, "unearned reward");
        require(e.template(ID).rewardUnits == 10, "immutable reward catalogue");
    }

    function testMissionFailureAndNoReactivation() public {
        e.activate(ID);
        e.fail(address(this), ID);
        (bool revive,) = address(e).call(abi.encodeCall(e.activate, (ID)));
        require(!revive, "revival");
        (bool award,) = address(e).call(abi.encodeCall(e.claim, (ID)));
        require(!award, "failed claim");
    }

    function testImmutableTemplates() public {
        (bool overwrite,) = address(e)
            .call(
                abi.encodeCall(
                    e.registerTemplate,
                    (ID, bytes32(uint256(2)), keccak256("other"), bytes32(0), uint64(20), uint32(1), uint32(100))
                )
            );
        require(!overwrite, "template overwritten");
    }
}

