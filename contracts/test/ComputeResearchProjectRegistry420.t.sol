// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeResearchProjectRegistry420.sol";

interface VmResearchProject420 {
    function prank(address actor) external;
}

contract ComputeResearchProjectRegistry420Test {
    VmResearchProject420 constant vm =
        VmResearchProject420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant OWNER = address(0xA11CE);
    address constant OUTSIDER = address(0xB0B);
    bytes32 constant DOMAIN_A = keccak256("oncology");
    bytes32 constant DOMAIN_B = keccak256("protein-folding");
    bytes32 constant DEF_A = keccak256("project-definition-a");
    bytes32 constant DEF_B = keccak256("project-definition-b");

    ComputeResearchProjectRegistry420 registry;

    function setUp() public {
        registry = new ComputeResearchProjectRegistry420();
    }

    function _create() private returns (bytes32 id) {
        vm.prank(OWNER);
        id = registry.registerProject(DOMAIN_A, DEF_A);
    }

    function _attempt(address actor, bytes memory call_) private returns (bool ok) {
        vm.prank(actor);
        (ok,) = address(registry).call(call_);
    }

    function testCanonicalIdentityAndCommitmentAreReconstructable() public {
        bytes32 id = _create();
        bytes32 expectedId = keccak256(abi.encode(
            registry.PROJECT_DOMAIN(), block.chainid, address(registry), OWNER, uint64(1)
        ));
        require(id == expectedId, "project id");

        ComputeResearchProjectRegistry420.Project memory p = registry.project(id);
        require(p.owner == OWNER && p.researchDomain == DOMAIN_A, "owner/domain");
        require(p.definitionCommitment == DEF_A && p.revision == 1, "definition/revision");
        require(p.acceptingNewWork, "accepting");
        require(p.status == ComputeResearchProjectRegistry420.Status.ACTIVE, "status");

        bytes32 expectedCommitment = keccak256(abi.encode(
            registry.COMMITMENT_DOMAIN(),
            block.chainid,
            address(registry),
            id,
            OWNER,
            DOMAIN_A,
            DEF_A,
            bytes32(0),
            uint64(1),
            true,
            ComputeResearchProjectRegistry420.Status.ACTIVE
        ));
        require(registry.commitment(id, 1) == expectedCommitment, "commitment");
        require(registry.currentCommitment(id) == expectedCommitment, "current");
        require(registry.isCurrentAcceptable(id, 1, expectedCommitment), "admission");
    }

    function testInvalidCreationRejectsWithoutConsumingIdentity() public {
        require(
            !_attempt(OWNER, abi.encodeCall(registry.registerProject, (bytes32(0), DEF_A))),
            "zero domain"
        );
        require(
            !_attempt(OWNER, abi.encodeCall(registry.registerProject, (DOMAIN_A, bytes32(0)))),
            "zero definition"
        );
        require(registry.nextProjectNonce() == 0, "nonce consumed");
        bytes32 id = _create();
        require(registry.nextProjectNonce() == 1 && id != bytes32(0), "allocation");
    }

    function testOwnerOnlyRevisionAndImmutableHistory() public {
        bytes32 id = _create();
        bytes32 oldCommitment = registry.commitment(id, 1);

        require(
            !_attempt(OUTSIDER, abi.encodeCall(registry.reviseProject, (id, uint64(1), DOMAIN_B, DEF_B))),
            "outsider revised"
        );

        vm.prank(OWNER);
        registry.reviseProject(id, 1, DOMAIN_B, DEF_B);

        ComputeResearchProjectRegistry420.Project memory oldP = registry.revision(id, 1);
        ComputeResearchProjectRegistry420.Project memory current = registry.project(id);
        require(oldP.researchDomain == DOMAIN_A && oldP.definitionCommitment == DEF_A, "history drift");
        require(current.researchDomain == DOMAIN_B && current.definitionCommitment == DEF_B, "revision");
        require(current.predecessorCommitment == oldCommitment && current.revision == 2, "chain");
        require(registry.commitment(id, 1) == oldCommitment, "old commitment drift");
        require(
            !_attempt(OWNER, abi.encodeCall(registry.reviseProject, (id, uint64(1), DOMAIN_A, DEF_A))),
            "stale revision"
        );
    }

    function testAcceptancePauseResumeIsRevisionedAndFailClosed() public {
        bytes32 id = _create();
        bytes32 c1 = registry.commitment(id, 1);

        vm.prank(OWNER);
        registry.setNewWorkAcceptance(id, 1, false);
        bytes32 c2 = registry.commitment(id, 2);
        require(c2 != c1, "acceptance not committed");
        require(!registry.isCurrentAcceptable(id, 1, c1), "stale accepted");
        require(!registry.isCurrentAcceptable(id, 2, c2), "paused accepted");
        require(
            !_attempt(OWNER, abi.encodeCall(registry.setNewWorkAcceptance, (id, uint64(2), false))),
            "noop accepted"
        );

        vm.prank(OWNER);
        registry.setNewWorkAcceptance(id, 2, true);
        bytes32 c3 = registry.commitment(id, 3);
        require(registry.isCurrentAcceptable(id, 3, c3), "resume failed");
        require(!registry.isCurrentAcceptable(id, 3, c2), "wrong commitment");
    }

    function testRetirementIsTerminalButHistoryRemainsReadable() public {
        bytes32 id = _create();
        bytes32 c1 = registry.commitment(id, 1);
        require(
            !_attempt(OUTSIDER, abi.encodeCall(registry.retireProject, (id, uint64(1)))),
            "outsider retired"
        );

        vm.prank(OWNER);
        registry.retireProject(id, 1);

        ComputeResearchProjectRegistry420.Project memory p = registry.project(id);
        require(p.status == ComputeResearchProjectRegistry420.Status.RETIRED, "not retired");
        require(!p.acceptingNewWork && p.revision == 2, "retirement state");
        require(registry.commitment(id, 1) == c1, "history lost");
        require(!registry.isCurrentAcceptable(id, 2, registry.commitment(id, 2)), "retired accepted");
        require(
            !_attempt(OWNER, abi.encodeCall(registry.reviseProject, (id, uint64(2), DOMAIN_B, DEF_B))),
            "retired revised"
        );
        require(
            !_attempt(OWNER, abi.encodeCall(registry.setNewWorkAcceptance, (id, uint64(2), true))),
            "retired resumed"
        );
        require(
            !_attempt(OWNER, abi.encodeCall(registry.retireProject, (id, uint64(2)))),
            "duplicate retirement"
        );
    }

    function testCrossProjectAndRevisionReplayFailAdmission() public {
        bytes32 first = _create();
        vm.prank(OWNER);
        bytes32 second = registry.registerProject(DOMAIN_A, DEF_A);
        bytes32 firstCommitment = registry.commitment(first, 1);
        bytes32 secondCommitment = registry.commitment(second, 1);
        require(first != second && firstCommitment != secondCommitment, "identity collision");
        require(!registry.isCurrentAcceptable(second, 1, firstCommitment), "cross-project replay");

        vm.prank(OWNER);
        registry.reviseProject(first, 1, DOMAIN_B, DEF_B);
        require(!registry.isCurrentAcceptable(first, 1, firstCommitment), "stale revision accepted");
        require(registry.isCurrentAcceptable(first, 2, registry.commitment(first, 2)), "current rejected");
    }
}
