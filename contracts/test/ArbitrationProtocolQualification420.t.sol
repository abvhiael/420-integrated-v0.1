// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/system/SystemAccess.sol";
import "../src/arbitration/ArbitrationPolicyRegistry420.sol";
import "../src/arbitration/ArbitrationCaseRegistry420.sol";
import "../src/arbitration/ArbitrationRulingRegistry420.sol";
import "../src/arbitration/ArbitrationRouter420.sol";

interface VmArbPre02 {
    function prank(
        address
    ) external;
    function warp(
        uint256
    ) external;
    function expectRevert(
        bytes4
    ) external;
    function expectRevert() external;
    function assume(
        bool
    ) external;
}

contract ArbitrationProtocolQualification420Test {
    VmArbPre02 internal constant vm = VmArbPre02(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 internal constant DOMAIN = keccak256("420/arbitration/domain/qualification/v1");
    bytes32 internal constant ORIGIN = keccak256("420/component/qualification/v1");
    address internal constant CLAIMANT = address(0xA11CE);
    address internal constant RESPONDENT = address(0xB0B);
    address internal constant OUTSIDER = address(0xBAD);
    address internal constant APPEAL = address(0xBEEF);

    ArbitrationPolicyRegistry420 internal policies;
    ArbitrationCaseRegistry420 internal cases;
    ArbitrationRulingRegistry420 internal rulings;
    ArbitrationRouter420 internal router;

    function setUp() public {
        policies = new ArbitrationPolicyRegistry420(address(this));
        policies.setPolicy(DOMAIN, address(this), APPEAL, 100, 100, 3, true);
        cases = new ArbitrationCaseRegistry420(address(this), address(policies));
        rulings = new ArbitrationRulingRegistry420(address(cases));
        cases.bindRulingRegistry(address(rulings));
        router = new ArbitrationRouter420(address(policies), address(cases), address(rulings));
    }

    function _open(
        uint256 nonce
    ) internal returns (bytes32 id) {
        vm.prank(CLAIMANT);
        id = cases.openCase(
            DOMAIN,
            RESPONDENT,
            ORIGIN,
            bytes32(nonce + 1),
            keccak256(abi.encode(nonce)),
            keccak256(abi.encode("remedy", nonce))
        );
    }

    function _rule(
        bytes32 id,
        uint32 outcome
    ) internal {
        rulings.submitRuling(
            id, outcome, keccak256(abi.encode("ruling", outcome)), keccak256(abi.encode("remedy", outcome)), bytes32(0)
        );
    }

    function testPolicyStartsInactiveAndRejectsUnknown() public {
        vm.expectRevert(ArbitrationPolicyRegistry420.UnknownPolicy.selector);
        policies.getPolicy(keccak256("unknown"));
        policies.setPolicy(bytes32(uint256(9)), address(this), address(0), 1, 1, 0, false);
        vm.prank(CLAIMANT);
        vm.expectRevert(ArbitrationCaseRegistry420.InvalidCase.selector);
        cases.openCase(
            bytes32(uint256(9)), RESPONDENT, ORIGIN, bytes32(uint256(1)), bytes32(uint256(2)), bytes32(uint256(3))
        );
    }

    function testPolicyRejectsInvalidBoundaries() public {
        vm.expectRevert(ArbitrationPolicyRegistry420.InvalidPolicy.selector);
        policies.setPolicy(bytes32(0), address(this), APPEAL, 1, 1, 3, true);
        vm.expectRevert(ArbitrationPolicyRegistry420.InvalidPolicy.selector);
        policies.setPolicy(DOMAIN, address(0), APPEAL, 1, 1, 3, true);
        vm.expectRevert(ArbitrationPolicyRegistry420.InvalidPolicy.selector);
        policies.setPolicy(DOMAIN, address(this), APPEAL, 0, 1, 3, true);
        vm.expectRevert(ArbitrationPolicyRegistry420.InvalidPolicy.selector);
        policies.setPolicy(DOMAIN, address(this), APPEAL, 1, 0, 3, true);
        vm.expectRevert(ArbitrationPolicyRegistry420.InvalidPolicy.selector);
        policies.setPolicy(DOMAIN, address(this), APPEAL, 1, 1, 4, true);
        vm.expectRevert(ArbitrationPolicyRegistry420.InvalidPolicy.selector);
        policies.setPolicy(DOMAIN, address(this), address(0), 1, 1, 1, true);
        policies.setPolicy(DOMAIN, address(this), address(0), 1, 1, 0, true);
        require(policies.getPolicy(DOMAIN).maxAppeals == 0, "zero appeals policy");
    }

    function testGovernanceOnlyPolicyAndBinding() public {
        vm.prank(OUTSIDER);
        vm.expectRevert(SystemAccess.Unauthorized.selector);
        policies.setPolicy(DOMAIN, OUTSIDER, APPEAL, 1, 1, 1, true);
        ArbitrationCaseRegistry420 other = new ArbitrationCaseRegistry420(address(this), address(policies));
        vm.prank(OUTSIDER);
        vm.expectRevert(SystemAccess.Unauthorized.selector);
        other.bindRulingRegistry(address(rulings));
    }

    function testOneTimeBindingRejectsEOAAndOtherCaseRegistry() public {
        ArbitrationCaseRegistry420 other = new ArbitrationCaseRegistry420(address(this), address(policies));
        vm.expectRevert(SystemAccess.ZeroAddress.selector);
        other.bindRulingRegistry(address(0));
        vm.expectRevert(ArbitrationCaseRegistry420.InvalidRulingRegistry.selector);
        other.bindRulingRegistry(OUTSIDER);
        vm.expectRevert(ArbitrationCaseRegistry420.InvalidRulingRegistry.selector);
        other.bindRulingRegistry(address(rulings));
        ArbitrationRulingRegistry420 matching = new ArbitrationRulingRegistry420(address(other));
        other.bindRulingRegistry(address(matching));
        vm.expectRevert(ArbitrationCaseRegistry420.RulingRegistryAlreadyBound.selector);
        other.bindRulingRegistry(address(matching));
    }

    function testRouterRejectsUnboundOrMismatchedRuling() public {
        ArbitrationCaseRegistry420 other = new ArbitrationCaseRegistry420(address(this), address(policies));
        ArbitrationRulingRegistry420 otherRulings = new ArbitrationRulingRegistry420(address(other));
        vm.expectRevert(ArbitrationRouter420.DependencyMismatch.selector);
        new ArbitrationRouter420(address(policies), address(other), address(otherRulings));
        vm.expectRevert(ArbitrationRouter420.DependencyMismatch.selector);
        new ArbitrationRouter420(address(policies), address(cases), address(otherRulings));
        vm.expectRevert(ArbitrationRouter420.ZeroAddress.selector);
        new ArbitrationRouter420(address(0), address(cases), address(rulings));
    }

    function testCaseOriginAndUniqueIdentity() public {
        bytes32 first = _open(1);
        bytes32 second = _open(1);
        require(first != second, "nonce replay");
        require(cases.nextNonce() == 3, "nonce drift");
        ArbitrationCaseRegistry420.CaseRecord memory c = router.getCase(first);
        require(c.claimant == CLAIMANT && c.respondent == RESPONDENT, "parties");
        require(c.domainId == DOMAIN && c.originComponentId == ORIGIN, "domain/origin");
        require(c.originObjectId == bytes32(uint256(2)), "object");
        require(c.claimHash != bytes32(0) && c.requestedRemedyHash != bytes32(0), "commitments");
        require(c.round == 0 && c.state == ArbitrationCaseRegistry420.State.OPEN, "initial state");
        require(c.evidenceDeadline == c.openedAt + c.evidenceWindow, "window");
    }

    function testCaseRejectsInvalidFields() public {
        bytes32 valid = bytes32(uint256(1));
        vm.prank(CLAIMANT);
        vm.expectRevert(ArbitrationCaseRegistry420.InvalidCase.selector);
        cases.openCase(DOMAIN, address(0), ORIGIN, valid, valid, valid);
        vm.prank(CLAIMANT);
        vm.expectRevert(ArbitrationCaseRegistry420.InvalidCase.selector);
        cases.openCase(DOMAIN, CLAIMANT, ORIGIN, valid, valid, valid);
        vm.prank(CLAIMANT);
        vm.expectRevert(ArbitrationCaseRegistry420.InvalidCase.selector);
        cases.openCase(DOMAIN, RESPONDENT, bytes32(0), valid, valid, valid);
        vm.prank(CLAIMANT);
        vm.expectRevert(ArbitrationCaseRegistry420.InvalidCase.selector);
        cases.openCase(DOMAIN, RESPONDENT, ORIGIN, bytes32(0), valid, valid);
        vm.prank(CLAIMANT);
        vm.expectRevert(ArbitrationCaseRegistry420.InvalidCase.selector);
        cases.openCase(DOMAIN, RESPONDENT, ORIGIN, valid, bytes32(0), valid);
        vm.prank(CLAIMANT);
        vm.expectRevert(ArbitrationCaseRegistry420.InvalidCase.selector);
        cases.openCase(DOMAIN, RESPONDENT, ORIGIN, valid, valid, bytes32(0));
    }

    function testPolicyDeactivationDoesNotChangeExistingCase() public {
        bytes32 id = _open(3);
        policies.setPolicy(DOMAIN, OUTSIDER, OUTSIDER, 5, 7, 0, false);
        ArbitrationCaseRegistry420.CaseRecord memory c = cases.getCase(id);
        require(c.resolver == address(this) && c.appealResolver == APPEAL, "resolver snapshot");
        require(c.maxAppeals == 3 && c.evidenceWindow == 100 && c.appealWindow == 100, "window snapshot");
        _rule(id, 1);
        require(cases.caseState(id) == ArbitrationCaseRegistry420.State.RULED, "existing case ruled");
        vm.prank(CLAIMANT);
        vm.expectRevert(ArbitrationCaseRegistry420.InvalidCase.selector);
        cases.openCase(DOMAIN, RESPONDENT, ORIGIN, bytes32(uint256(1)), bytes32(uint256(2)), bytes32(uint256(3)));
    }

    function testEvidencePartyDeadlineAndRoundIsolation() public {
        bytes32 id = _open(4);
        bytes32 evidence = keccak256("evidence");
        vm.prank(OUTSIDER);
        vm.expectRevert(ArbitrationCaseRegistry420.NotParty.selector);
        cases.submitEvidence(id, evidence);
        vm.prank(CLAIMANT);
        vm.expectRevert(ArbitrationCaseRegistry420.InvalidCase.selector);
        cases.submitEvidence(id, bytes32(0));
        vm.prank(CLAIMANT);
        cases.submitEvidence(id, evidence);
        vm.prank(RESPONDENT);
        vm.expectRevert(ArbitrationCaseRegistry420.EvidenceAlreadyCommitted.selector);
        cases.submitEvidence(id, evidence);
        _rule(id, 1);
        vm.prank(CLAIMANT);
        vm.expectRevert(ArbitrationCaseRegistry420.CaseNotOpen.selector);
        cases.submitEvidence(id, keccak256("late state"));
        vm.prank(CLAIMANT);
        cases.appeal(id);
        vm.prank(RESPONDENT);
        cases.submitEvidence(id, evidence);
        require(cases.evidenceCommitted(id, 0, evidence), "round zero");
        require(cases.evidenceCommitted(id, 1, evidence), "round one");
    }

    function testEvidenceExactDeadlineAndAfter() public {
        bytes32 id = _open(5);
        uint256 deadline = cases.getCase(id).evidenceDeadline;
        vm.warp(deadline);
        vm.prank(CLAIMANT);
        cases.submitEvidence(id, keccak256("at boundary"));
        vm.warp(deadline + 1);
        vm.prank(CLAIMANT);
        vm.expectRevert(ArbitrationCaseRegistry420.EvidenceWindowClosed.selector);
        cases.submitEvidence(id, keccak256("after boundary"));
    }

    function testRulingAndFinalityAuthorization() public {
        bytes32 id = _open(6);
        vm.prank(OUTSIDER);
        vm.expectRevert(ArbitrationCaseRegistry420.OnlyRulingRegistry.selector);
        cases.markRuled(id);
        vm.prank(OUTSIDER);
        vm.expectRevert(ArbitrationCaseRegistry420.OnlyRulingRegistry.selector);
        cases.finalize(id);
        vm.prank(OUTSIDER);
        vm.expectRevert(ArbitrationRulingRegistry420.UnauthorizedResolver.selector);
        rulings.submitRuling(id, 1, keccak256("bad"), keccak256("bad remedy"), bytes32(0));
        vm.expectRevert(ArbitrationRulingRegistry420.InvalidRuling.selector);
        rulings.submitRuling(id, 0, keccak256("ruling"), keccak256("remedy"), bytes32(0));
        vm.expectRevert(ArbitrationRulingRegistry420.InvalidRuling.selector);
        rulings.submitRuling(id, 1, bytes32(0), keccak256("remedy"), bytes32(0));
        vm.expectRevert(ArbitrationRulingRegistry420.InvalidRuling.selector);
        rulings.submitRuling(id, 1, keccak256("ruling"), bytes32(0), bytes32(0));
        _rule(id, 2);
        require(router.getRuling(id, 0).outcomeCode == 2, "outcome");
        vm.expectRevert(ArbitrationRulingRegistry420.NotOpen.selector);
        rulings.submitRuling(id, 3, keccak256("duplicate"), keccak256("duplicate remedy"), bytes32(0));
        vm.expectRevert(ArbitrationRulingRegistry420.AppealWindowOpen.selector);
        rulings.finalizeRuling(id);
    }

    function testAppealDeadlineAndExhaustedAppeals() public {
        bytes32 id = _open(7);
        _rule(id, 1);
        uint256 deadline = cases.getCase(id).appealDeadline;
        vm.warp(deadline);
        vm.prank(CLAIMANT);
        cases.appeal(id);
        vm.prank(APPEAL);
        rulings.submitRuling(id, 2, keccak256("appeal 1"), keccak256("remedy 1"), bytes32(0));
        vm.prank(RESPONDENT);
        cases.appeal(id);
        vm.prank(APPEAL);
        rulings.submitRuling(id, 3, keccak256("appeal 2"), keccak256("remedy 2"), bytes32(0));
        vm.prank(CLAIMANT);
        cases.appeal(id);
        vm.prank(APPEAL);
        rulings.submitRuling(id, 4, keccak256("appeal 3"), keccak256("remedy 3"), bytes32(0));
        require(cases.caseRound(id) == 3, "appeal cap");
        vm.prank(CLAIMANT);
        vm.expectRevert(ArbitrationCaseRegistry420.AppealUnavailable.selector);
        cases.appeal(id);
        require(router.getRuling(id, 0).exists && router.getRuling(id, 3).exists, "history");
        vm.warp(uint256(cases.getCase(id).appealDeadline) + 1);
        vm.prank(OUTSIDER);
        rulings.finalizeRuling(id);
        require(cases.caseState(id) == ArbitrationCaseRegistry420.State.FINALIZED, "final");
        vm.expectRevert(ArbitrationRulingRegistry420.NotRuled.selector);
        rulings.finalizeRuling(id);
        vm.prank(CLAIMANT);
        vm.expectRevert(ArbitrationCaseRegistry420.AppealUnavailable.selector);
        cases.appeal(id);
    }

    function testExpiredAppealNotAvailable() public {
        bytes32 id = _open(8);
        _rule(id, 1);
        vm.warp(uint256(cases.getCase(id).appealDeadline) + 1);
        vm.prank(RESPONDENT);
        vm.expectRevert(ArbitrationCaseRegistry420.AppealUnavailable.selector);
        cases.appeal(id);
    }

    function testTimestampOverflowRejectsCaseWithoutNonceConsumption() public {
        uint256 beforeNonce = cases.nextNonce();
        vm.warp(type(uint64).max - 50);
        vm.prank(CLAIMANT);
        vm.expectRevert(ArbitrationCaseRegistry420.InvalidCase.selector);
        cases.openCase(
            DOMAIN, RESPONDENT, ORIGIN, bytes32(uint256(71)), keccak256("overflow-claim"),
            keccak256("overflow-remedy")
        );
        require(cases.nextNonce() == beforeNonce, "overflow consumed case nonce");

        vm.warp(uint256(type(uint64).max) + 1);
        vm.prank(CLAIMANT);
        vm.expectRevert(ArbitrationCaseRegistry420.InvalidCase.selector);
        cases.openCase(
            DOMAIN, RESPONDENT, ORIGIN, bytes32(uint256(72)), keccak256("cast-claim"),
            keccak256("cast-remedy")
        );
        require(cases.nextNonce() == beforeNonce, "timestamp cast consumed nonce");
    }

    function testRulingDeadlineOverflowAtomicallyRejectsCommitment() public {
        vm.warp(10);
        policies.setPolicy(DOMAIN, address(this), APPEAL, 100, type(uint64).max - 100, 1, true);
        bytes32 id = _open(73);
        vm.warp(200);
        vm.expectRevert(ArbitrationCaseRegistry420.InvalidCase.selector);
        _rule(id, 1);
        require(cases.caseState(id) == ArbitrationCaseRegistry420.State.OPEN, "failed ruling advanced case");
        vm.expectRevert(ArbitrationRulingRegistry420.InvalidRuling.selector);
        rulings.getRuling(id, 0);
    }

    function testAppealedEvidenceDeadlineOverflowRetainsOriginalRound() public {
        vm.warp(1);
        policies.setPolicy(
            DOMAIN, address(this), APPEAL, type(uint64).max - 500, type(uint64).max - 500, 3, true
        );
        bytes32 id = _open(74);
        _rule(id, 1);
        vm.warp(type(uint64).max - 500);
        vm.prank(CLAIMANT);
        vm.expectRevert(ArbitrationCaseRegistry420.AppealUnavailable.selector);
        cases.appeal(id);
        require(cases.caseRound(id) == 0, "failed appeal advanced round");
        require(cases.caseState(id) == ArbitrationCaseRegistry420.State.RULED, "failed appeal changed state");
        require(rulings.getRuling(id, 0).exists, "original ruling lost");
    }

    function testRulingDeadlineExactUint64Boundary() public {
        vm.warp(type(uint64).max - 200);
        bytes32 id = _open(75);
        vm.warp(type(uint64).max - 100);
        _rule(id, 1);
        require(cases.getCase(id).appealDeadline == type(uint64).max, "exact uint64 boundary");
        vm.expectRevert(ArbitrationRulingRegistry420.AppealWindowOpen.selector);
        rulings.finalizeRuling(id);
        vm.warp(uint256(type(uint64).max) + 1);
        rulings.finalizeRuling(id);
        require(cases.caseState(id) == ArbitrationCaseRegistry420.State.FINALIZED, "post-boundary finality");
    }

    function testCanonicalIntrospectionAndReadOnlyRouterViews() public {
        require(policies.protocolVersion() == 1 && cases.protocolVersion() == 1, "policy/case version");
        require(rulings.protocolVersion() == 1 && router.protocolVersion() == 1, "ruling/router version");
        require(keccak256(bytes(policies.systemName())) == keccak256("ArbitrationPolicyRegistry420"), "policy name");
        require(keccak256(bytes(cases.systemName())) == keccak256("ArbitrationCaseRegistry420"), "case name");
        require(keccak256(bytes(rulings.systemName())) == keccak256("ArbitrationRulingRegistry420"), "ruling name");
        require(keccak256(bytes(router.systemName())) == keccak256("ArbitrationRouter420"), "router name");
        require(router.getPolicy(DOMAIN).maxAppeals == 3, "router policy");

        bytes32 id = _open(12);
        (
            address claimant,
            address respondent,
            bytes32 domain,
            bytes32 origin,
            bytes32 objectId,
            ArbitrationCaseRegistry420.State state
        ) = cases.caseOrigin(id);
        require(claimant == CLAIMANT && respondent == RESPONDENT && domain == DOMAIN, "origin parties/domain");
        require(origin == ORIGIN && objectId == bytes32(uint256(13)), "origin object");
        require(state == ArbitrationCaseRegistry420.State.OPEN, "case origin state");
        (
            bytes32 readDomain,
            address resolver,
            uint8 round,
            ArbitrationCaseRegistry420.State readState,
            uint64 deadline
        ) = cases.rulingContext(id);
        require(readDomain == DOMAIN && resolver == address(this), "resolver context");
        require(round == 0 && readState == ArbitrationCaseRegistry420.State.OPEN && deadline == 0, "open context");
        _rule(id, 1);
        (uint8 finalRound, ArbitrationCaseRegistry420.State finalState, uint64 appealDeadline) =
            cases.finalizationContext(id);
        require(finalRound == 0 && finalState == ArbitrationCaseRegistry420.State.RULED, "final context");
        vm.warp(appealDeadline);
        vm.expectRevert(ArbitrationRulingRegistry420.AppealWindowOpen.selector);
        rulings.finalizeRuling(id);
        vm.warp(uint256(appealDeadline) + 1);
        rulings.finalizeRuling(id);
        require(router.getCase(id).state == ArbitrationCaseRegistry420.State.FINALIZED, "router final view");
        require(router.getRuling(id, 0).outcomeCode == 1, "router ruling view");
    }

    function testUnknownCaseAndRulingReadsFailClosed() public {
        bytes32 id = keccak256("missing");
        vm.expectRevert(ArbitrationCaseRegistry420.UnknownCase.selector);
        cases.getCase(id);
        vm.expectRevert(ArbitrationCaseRegistry420.UnknownCase.selector);
        cases.caseState(id);
        vm.expectRevert(ArbitrationRulingRegistry420.InvalidRuling.selector);
        rulings.getRuling(id, 0);
    }

    function testFuzzCaseNonceAndSnapshot(
        uint64 origin,
        uint64 claim,
        uint64 remedy
    ) public {
        vm.assume(origin != 0 && claim != 0 && remedy != 0);
        vm.prank(CLAIMANT);
        bytes32 id = cases.openCase(
            DOMAIN, RESPONDENT, ORIGIN, bytes32(uint256(origin)), bytes32(uint256(claim)), bytes32(uint256(remedy))
        );
        ArbitrationCaseRegistry420.CaseRecord memory c = router.getCase(id);
        require(c.originObjectId == bytes32(uint256(origin)), "fuzz origin");
        require(c.claimHash == bytes32(uint256(claim)), "fuzz claim");
        require(c.requestedRemedyHash == bytes32(uint256(remedy)), "fuzz remedy");
        require(c.resolver == address(this) && c.maxAppeals == 3, "fuzz snapshot");
    }

    function testFuzzPolicyWindows(
        uint32 evidence,
        uint32 appealWindow,
        uint8 maximum
    ) public {
        vm.assume(evidence > 0 && appealWindow > 0 && maximum <= 3);
        policies.setPolicy(DOMAIN, address(this), APPEAL, evidence, appealWindow, maximum, true);
        bytes32 id = _open(9);
        ArbitrationCaseRegistry420.CaseRecord memory c = cases.getCase(id);
        require(c.evidenceDeadline == c.openedAt + evidence, "fuzz evidence deadline");
        require(c.appealWindow == appealWindow && c.maxAppeals == maximum, "fuzz policy");
    }
}
