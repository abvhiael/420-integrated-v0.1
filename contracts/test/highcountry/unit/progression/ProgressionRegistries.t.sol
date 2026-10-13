// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {bindRetainedR04Emergency,retainedR04AuthorizationRoot} from "../../mocks/R04EmergencyFixture.sol";
import {
    SkillRegistry,
    ResearchRegistry,
    DiscoveryRegistry
} from "../../../../src/highcountry/progression/ProgressionRegistries.sol";

contract R046Attacker {
    function forge(
        SkillRegistry r,
        address player,
        bytes32 id,
        bytes32 proof
    ) external {
        r.attest(player, id, proof, 2);
    }
}

contract ProgressionR046Test {
    SkillRegistry skill;
    ResearchRegistry research;
    DiscoveryRegistry discovery;
    R046Attacker attacker;
    bytes32 constant FIRST = keccak256("skill:first");
    bytes32 constant SECOND = keccak256("skill:second");
    address constant PLAYER = address(0x1234);

    function setUp() public {
        skill = new SkillRegistry(retainedR04AuthorizationRoot());
        bindRetainedR04Emergency(address(skill));
        research = new ResearchRegistry(retainedR04AuthorizationRoot());
        bindRetainedR04Emergency(address(research));
        discovery = new DiscoveryRegistry(retainedR04AuthorizationRoot());
        bindRetainedR04Emergency(address(discovery));
        attacker = new R046Attacker();
        skill.registerTrack(FIRST, bytes32(uint256(1)), bytes32(0), 4, 2, 10);
        skill.registerTrack(SECOND, bytes32(uint256(1)), FIRST, 2, 2, 0);
        research.registerTrack(FIRST, bytes32(uint256(1)), bytes32(0), 2, 2, 1);
        discovery.registerTrack(FIRST, bytes32(uint256(1)), bytes32(0), 1, 1, 0);
        skill.setVerifier(address(this), true);
        research.setVerifier(address(this), true);
        discovery.setVerifier(address(this), true);
    }

    function testProgressCompletionPrerequisiteAndReplay() public {
        (bool early,) =
            address(skill).call(abi.encodeCall(skill.attest, (PLAYER, SECOND, bytes32(uint256(1)), uint32(2))));
        require(!early, "prerequisite bypass");
        skill.attest(PLAYER, FIRST, bytes32(uint256(1)), 2);
        skill.attest(PLAYER, FIRST, bytes32(uint256(2)), 2);
        require(skill.unlocked(PLAYER, FIRST), "not unlocked");
        skill.attest(PLAYER, SECOND, bytes32(uint256(3)), 2);
        require(skill.unlocked(PLAYER, SECOND), "dependent unlock");
        (bool replay,) =
            address(skill).call(abi.encodeCall(skill.attest, (PLAYER, SECOND, bytes32(uint256(3)), uint32(2))));
        require(!replay, "replay accepted");
        require(skill.track(FIRST).rewardUnits == 10, "catalogue metadata");
    }

    function testUntrustedAndOverflowAreRejected() public {
        (bool untrusted,) =
            address(attacker).call(abi.encodeCall(attacker.forge, (skill, PLAYER, FIRST, bytes32(uint256(1)))));
        require(!untrusted, "unauthorized progression");
        (bool overflow,) =
            address(skill).call(abi.encodeCall(skill.attest, (PLAYER, FIRST, bytes32(uint256(11)), uint32(3))));
        require(!overflow, "unbounded progress");
        skill.attest(PLAYER, FIRST, bytes32(uint256(1)), 2);
        (bool reuse,) =
            address(skill).call(abi.encodeCall(skill.attest, (PLAYER, FIRST, bytes32(uint256(1)), uint32(2))));
        require(!reuse, "double evidence");
    }

    function testImmutableCatalogueAndIndependentNamespaces() public {
        (bool overwrite,) = address(skill)
            .call(
                abi.encodeCall(
                    skill.registerTrack, (FIRST, bytes32(uint256(2)), bytes32(0), uint32(4), uint32(2), uint32(100))
                )
            );
        require(!overwrite, "catalogue mutation");
        skill.attest(PLAYER, FIRST, bytes32(uint256(9)), 2);
        research.attest(PLAYER, FIRST, bytes32(uint256(9)), 2);
        discovery.attest(PLAYER, FIRST, bytes32(uint256(9)), 1);
        require(research.unlocked(PLAYER, FIRST), "research missing");
        require(discovery.unlocked(PLAYER, FIRST), "discovery missing");
        require(!skill.unlocked(PLAYER, FIRST), "cross-registry completion");
    }
}

