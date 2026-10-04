// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/system/SystemAccess.sol";
import "../src/apps/ProtocolRegistry.sol";
import "../src/arbitration/ArbitrationPolicyRegistry420.sol";
import "../src/arbitration/ArbitrationCaseRegistry420.sol";
import "../src/arbitration/ArbitrationRulingRegistry420.sol";

interface Vm420Arb {
    function prank(
        address
    ) external;
    function warp(
        uint256
    ) external;
    function expectRevert(
        bytes4
    ) external;
}

contract ArbitrationGenesis420Test {
    Vm420Arb internal constant vm = Vm420Arb(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 internal constant DOMAIN = keccak256("420/arbitration/domain/market/v1");
    bytes32 internal constant COMPONENT = keccak256("420/component/market/v1");
    address internal constant CLAIMANT = address(0xA11CE);
    address internal constant RESPONDENT = address(0xB0B);
    address internal constant APPEAL_RESOLVER = address(0xBEEF);

    ArbitrationPolicyRegistry420 internal policy;
    ArbitrationCaseRegistry420 internal cases;
    ArbitrationRulingRegistry420 internal rulings;

    function setUp() public {
        policy = new ArbitrationPolicyRegistry420(address(this));
        policy.setPolicy(DOMAIN, address(this), APPEAL_RESOLVER, 100, 100, 1, true);
        cases = new ArbitrationCaseRegistry420(address(this), address(policy));
        rulings = new ArbitrationRulingRegistry420(address(cases));
        cases.bindRulingRegistry(address(rulings));
    }

    function _open(
        bytes32 suffix
    ) internal returns (bytes32 caseId) {
        vm.prank(CLAIMANT);
        caseId = cases.openCase(
            DOMAIN,
            RESPONDENT,
            COMPONENT,
            keccak256(abi.encodePacked("order", suffix)),
            keccak256(abi.encodePacked("claim", suffix)),
            keccak256(abi.encodePacked("requested-remedy", suffix))
        );
    }

    function testCanonicalCatalogIncludesArbitration() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        require(
            registry.isGenesisCanonicalServiceId(keccak256("420/service/arbitration/v1")),
            "arbitration service id missing"
        );
    }

    function testGovernanceOnlyPolicy() public {
        vm.prank(CLAIMANT);
        vm.expectRevert(SystemAccess.Unauthorized.selector);
        policy.setPolicy(bytes32(uint256(2)), CLAIMANT, address(0), 10, 10, 0, true);
    }

    function testCaseEvidenceRulingAppealAndFinality() public {
        bytes32 caseId = _open(bytes32(uint256(1)));
        vm.prank(RESPONDENT);
        cases.submitEvidence(caseId, keccak256("respondent-evidence"));

        rulings.submitRuling(caseId, 1, keccak256("round0-ruling"), keccak256("round0-remedy"), keccak256("panel0"));
        vm.prank(CLAIMANT);
        cases.appeal(caseId);
        require(cases.caseRound(caseId) == 1, "appeal round not advanced");

        vm.prank(APPEAL_RESOLVER);
        rulings.submitRuling(caseId, 2, keccak256("round1-ruling"), keccak256("round1-remedy"), keccak256("panel1"));
        (,,,, uint64 appealDeadline) = cases.rulingContext(caseId);
        vm.warp(uint256(appealDeadline) + 1);
        rulings.finalizeRuling(caseId);
        require(cases.caseState(caseId) == ArbitrationCaseRegistry420.State.FINALIZED, "case not finalized");
    }

    function testOpenCaseRequiresRequestedRemedyCommitment() public {
        vm.prank(CLAIMANT);
        vm.expectRevert(ArbitrationCaseRegistry420.InvalidCase.selector);
        cases.openCase(DOMAIN, RESPONDENT, COMPONENT, keccak256("order-zero"), keccak256("claim-zero"), bytes32(0));
    }

    function testCaseReadPreservesPolicySnapshot() public {
        bytes32 caseId = _open(bytes32(uint256(2)));
        policy.setPolicy(DOMAIN, address(0xCAFE), address(0xD00D), 200, 300, 2, true);

        ArbitrationCaseRegistry420.CaseRecord memory c = cases.getCase(caseId);
        require(c.resolver == address(this), "resolver snapshot changed");
        require(c.appealResolver == APPEAL_RESOLVER, "appeal resolver snapshot changed");
        require(c.evidenceWindow == 100 && c.appealWindow == 100 && c.maxAppeals == 1, "policy snapshot changed");
        require(c.requestedRemedyHash != bytes32(0), "requested remedy missing");
    }

    function testDuplicateEvidenceCommitmentFailsClosed() public {
        bytes32 caseId = _open(bytes32(uint256(3)));
        bytes32 evidenceHash = keccak256("same-evidence");

        vm.prank(CLAIMANT);
        cases.submitEvidence(caseId, evidenceHash);
        vm.prank(RESPONDENT);
        vm.expectRevert(ArbitrationCaseRegistry420.EvidenceAlreadyCommitted.selector);
        cases.submitEvidence(caseId, evidenceHash);
    }

    function testEvidenceAfterDeadlineFailsClosed() public {
        bytes32 caseId = _open(bytes32(uint256(4)));
        ArbitrationCaseRegistry420.CaseRecord memory c = cases.getCase(caseId);
        vm.warp(uint256(c.evidenceDeadline) + 1);

        vm.prank(CLAIMANT);
        vm.expectRevert(ArbitrationCaseRegistry420.EvidenceWindowClosed.selector);
        cases.submitEvidence(caseId, keccak256("late-evidence"));
    }

    function testRulingRequiresRemedyCommitment() public {
        bytes32 caseId = _open(bytes32(uint256(5)));
        vm.expectRevert(ArbitrationRulingRegistry420.InvalidRuling.selector);
        rulings.submitRuling(caseId, 1, keccak256("ruling"), bytes32(0), bytes32(0));
    }

    function testWrongResolverFailsClosed() public {
        bytes32 caseId = _open(bytes32(uint256(6)));
        vm.prank(RESPONDENT);
        vm.expectRevert(ArbitrationRulingRegistry420.UnauthorizedResolver.selector);
        rulings.submitRuling(caseId, 1, keccak256("bad-ruling"), keccak256("remedy"), bytes32(0));
    }

    function testAppealCapFailsClosed() public {
        bytes32 caseId = _open(bytes32(uint256(7)));
        rulings.submitRuling(caseId, 1, keccak256("r0"), keccak256("remedy0"), bytes32(0));

        vm.prank(RESPONDENT);
        cases.appeal(caseId);
        vm.prank(APPEAL_RESOLVER);
        rulings.submitRuling(caseId, 2, keccak256("r1"), keccak256("remedy1"), bytes32(0));

        vm.prank(CLAIMANT);
        vm.expectRevert(ArbitrationCaseRegistry420.AppealUnavailable.selector);
        cases.appeal(caseId);
    }

    function testCannotFinalizeBeforeAppealWindowCloses() public {
        bytes32 caseId = _open(bytes32(uint256(8)));
        rulings.submitRuling(caseId, 1, keccak256("ruling"), keccak256("remedy"), bytes32(0));

        vm.expectRevert(ArbitrationRulingRegistry420.AppealWindowOpen.selector);
        rulings.finalizeRuling(caseId);
    }
}
