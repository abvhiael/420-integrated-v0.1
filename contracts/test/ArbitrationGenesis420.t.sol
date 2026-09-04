// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/system/SystemAccess.sol";
import "../src/apps/ProtocolRegistry.sol";
import "../src/arbitration/ArbitrationPolicyRegistry420.sol";
import "../src/arbitration/ArbitrationCaseRegistry420.sol";
import "../src/arbitration/ArbitrationRulingRegistry420.sol";

interface Vm420Arb {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
}

contract ArbitrationGenesis420Test {
    Vm420Arb internal constant vm = Vm420Arb(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 internal constant DOMAIN = keccak256("420/arbitration/domain/market/v1");
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

    function testCanonicalCatalogIncludesArbitration() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        require(registry.isGenesisCanonicalServiceId(keccak256("420/service/arbitration/v1")), "arbitration service id missing");
    }

    function testGovernanceOnlyPolicy() public {
        vm.prank(CLAIMANT);
        vm.expectRevert(SystemAccess.Unauthorized.selector);
        policy.setPolicy(bytes32(uint256(2)), CLAIMANT, address(0), 10, 10, 0, true);
    }

    function testCaseEvidenceRulingAppealAndFinality() public {
        vm.prank(CLAIMANT);
        bytes32 caseId = cases.openCase(DOMAIN, RESPONDENT, keccak256("420/component/market/v1"), keccak256("order-1"), keccak256("claim"), keccak256("remedy-request"));
        vm.prank(RESPONDENT);
        cases.submitEvidence(caseId, keccak256("respondent-evidence"));
        rulings.submitRuling(caseId, 1, keccak256("round0-ruling"), keccak256("round0-remedy"), keccak256("panel0"));
        vm.prank(CLAIMANT);
        cases.appeal(caseId);
        require(cases.caseRound(caseId) == 1, "appeal round not advanced");
        vm.prank(APPEAL_RESOLVER);
        rulings.submitRuling(caseId, 2, keccak256("round1-ruling"), keccak256("round1-remedy"), keccak256("panel1"));
        (, , , , uint64 appealDeadline) = cases.rulingContext(caseId);
        vm.warp(uint256(appealDeadline) + 1);
        rulings.finalizeRuling(caseId);
        require(cases.caseState(caseId) == ArbitrationCaseRegistry420.State.FINALIZED, "case not finalized");
    }

    function testWrongResolverFailsClosed() public {
        vm.prank(CLAIMANT);
        bytes32 caseId = cases.openCase(DOMAIN, RESPONDENT, keccak256("420/component/market/v1"), keccak256("order-2"), keccak256("claim2"), bytes32(0));
        vm.prank(RESPONDENT);
        vm.expectRevert(ArbitrationRulingRegistry420.UnauthorizedResolver.selector);
        rulings.submitRuling(caseId, 1, keccak256("bad-ruling"), bytes32(0), bytes32(0));
    }
}
