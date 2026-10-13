// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { OrganizationRegistry } from "../../../../src/highcountry/organization/OrganizationRegistry.sol";
import { CooperativeRegistry } from "../../../../src/highcountry/cooperative/CooperativeRegistry.sol";
import { CooperativeGovernance } from "../../../../src/highcountry/cooperative/CooperativeGovernance.sol";
import { GovernanceExecutor } from "../../../../src/highcountry/cooperative/GovernanceExecutor.sol";

interface VmR0411 {
    function warp(
        uint256
    ) external;
}

contract CoopMemberR0411 {
    function join(
        OrganizationRegistry r,
        bytes32 org
    ) external {
        r.join(org);
    }

    function enroll(
        CooperativeRegistry r,
        bytes32 coop
    ) external {
        r.enroll(coop);
    }

    function vote(
        CooperativeGovernance g,
        bytes32 id,
        bool yes
    ) external {
        g.vote(id, yes);
    }

    function leave(
        OrganizationRegistry r,
        bytes32 org
    ) external {
        r.requestLeave(org);
    }
}

contract R0411GovernanceTest {
    VmR0411 constant vm = VmR0411(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 constant ORG = keccak256("test-org");
    bytes32 constant COOP = keccak256("test-coop");
    bytes32 constant SCOPE = keccak256("policy-scope");
    OrganizationRegistry o;
    CooperativeRegistry r;
    CooperativeGovernance g;
    GovernanceExecutor e;
    CoopMemberR0411 alice;
    CoopMemberR0411 bob;

    function setUp() public {
        o = new OrganizationRegistry();
        o.create(ORG, keccak256("meta"));
        r = new CooperativeRegistry(address(o));
        r.create(COOP, ORG);
        r.enroll(COOP);
        alice = new CoopMemberR0411();
        bob = new CoopMemberR0411();
        o.invite(ORG, address(alice), true);
        o.invite(ORG, address(bob), true);
        alice.join(o, ORG);
        bob.join(o, ORG);
        alice.enroll(r, COOP);
        bob.enroll(r, COOP);
        g = new CooperativeGovernance(address(r));
        e = new GovernanceExecutor(address(g));
        g.bindExecutor(address(e));
    }

    function _proposal() internal returns (bytes32) {
        return g.propose(COOP, g.ACTION_SET_POLICY(), SCOPE, keccak256("yes"));
    }

    function testQuorumTimelockAndSingleExecution() public {
        bytes32 id = _proposal();
        alice.vote(g, id, true);
        bob.vote(g, id, true);
        (bool early,) = address(e).call(abi.encodeCall(e.execute, (id)));
        require(!early, "early execution");
        vm.warp(block.timestamp + g.VOTING_PERIOD() + g.TIMELOCK());
        e.execute(id);
        require(e.policy(COOP, SCOPE) == keccak256("yes"), "missing policy");
        (bool replay,) = address(e).call(abi.encodeCall(e.execute, (id)));
        require(!replay, "execution replay");
    }

    function testQuorumAndDuplicateVoteFailClosed() public {
        bytes32 id = _proposal();
        alice.vote(g, id, true);
        (bool duplicate,) = address(alice).call(abi.encodeCall(alice.vote, (g, id, true)));
        require(!duplicate, "double vote");
        vm.warp(block.timestamp + g.VOTING_PERIOD() + g.TIMELOCK());
        require(!g.executable(id), "one voter reached quorum");
    }

    function testExitedMemberCannotVoteAndSnapshotExcludesLateJoin() public {
        bytes32 id = _proposal();
        alice.leave(o, ORG);
        (bool stale,) = address(alice).call(abi.encodeCall(alice.vote, (g, id, true)));
        require(!stale, "departed vote");
        CoopMemberR0411 late = new CoopMemberR0411();
        o.invite(ORG, address(late), true);
        late.join(o, ORG);
        late.enroll(r, COOP);
        (bool added,) = address(late).call(abi.encodeCall(late.vote, (g, id, true)));
        require(!added, "post-snapshot voter");
    }

    function testRejectUnknownActionAndWrongMembership() public {
        (bool arbitrary,) =
            address(g).call(abi.encodeCall(g.propose, (COOP, keccak256("wallet-transfer"), SCOPE, bytes32(uint256(1)))));
        require(!arbitrary, "arbitrary wallet action accepted");
        (bool outsider,) = address(bob).call(abi.encodeCall(bob.enroll, (r, bytes32(uint256(99)))));
        require(!outsider, "nonexistent cooperative enrollment");
    }

    function testVoteBoundaryAndDefeatedProposal() public {
        bytes32 id = _proposal();
        alice.vote(g, id, false);
        bob.vote(g, id, true);
        vm.warp(block.timestamp + g.VOTING_PERIOD());
        (bool late,) = address(bob).call(abi.encodeCall(bob.vote, (g, id, true)));
        require(!late, "vote past deadline");
        vm.warp(block.timestamp + g.TIMELOCK());
        require(!g.executable(id), "tied outcome executed");
    }

    function testCancellationAndExecutorBinding() public {
        bytes32 id = _proposal();
        g.cancel(id);
        require(!g.executable(id), "cancelled executable");
        (bool rebind,) = address(g).call(abi.encodeCall(g.bindExecutor, (address(e))));
        require(!rebind, "executor replaced");
    }
}
