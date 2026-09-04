// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bonggoggles/BongGogglesAuthorization420.sol";
import "../src/bonggoggles/BongGogglesProfileRegistry420.sol";
import "../src/bonggoggles/BongGogglesSafetyRegistry420.sol";

interface VmBGSafety420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract MockBGSafetyCapabilities420 is ICapabilityRegistry420 {
    mapping(address => bool) public allowed;
    function setAllowed(address principal, bool value) external { allowed[principal] = value; }
    function grant(bytes32) external pure override returns (CapabilityGrant memory g) { return g; }
    function isAuthorized(address principal, bytes32, bytes32, bytes32, uint256) external view override returns (bool) { return allowed[principal]; }
}

contract BongGogglesTrustSafety420Test {
    VmBGSafety420 constant vm = VmBGSafety420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    address constant MOD = address(0xD00D);
    address constant APPEALER = address(0xA99EA1);

    MockBGSafetyCapabilities420 caps;
    BongGogglesAuthorization420 auth;
    BongGogglesProfileRegistry420 profiles;
    BongGogglesSafetyRegistry420 safety;

    function setUp() public {
        caps = new MockBGSafetyCapabilities420();
        auth = new BongGogglesAuthorization420(address(caps));
        profiles = new BongGogglesProfileRegistry420(address(auth));
        safety = new BongGogglesSafetyRegistry420(address(auth), address(profiles));
        _create(ALICE);
        _create(BOB);
        caps.setAllowed(MOD, true);
        caps.setAllowed(APPEALER, true);
    }

    function _create(address account) internal {
        vm.prank(account);
        profiles.createProfile(account, BongGogglesTypes420.ProfileType.PERSONAL, keccak256("name"), bytes32(0), bytes32(0), bytes32(0), bytes32(0));
    }

    function _report() internal returns (bytes32 reportId) {
        vm.prank(ALICE);
        reportId = safety.submitReport(ALICE, BOB, BongGogglesTypes420.SafetyTargetType.OBJECT, keccak256("post/1"), keccak256("harassment"), keccak256("evidence"));
    }

    function _case() internal returns (bytes32 caseId) {
        bytes32 reportId = _report();
        vm.prank(MOD);
        caseId = safety.openCase(reportId, keccak256("policy/v1"));
    }

    function testReportIsAllegationNotEnforcement() public {
        bytes32 reportId = _report();
        BongGogglesSafetyRegistry420.Report memory r = safety.report(reportId);
        require(r.exists && r.reporter == ALICE && r.subjectAccount == BOB, "report retained");
    }

    function testUnprivilegedActorCannotOpenCase() public {
        bytes32 reportId = _report();
        vm.prank(ALICE);
        vm.expectRevert(BongGogglesSafetyRegistry420.UnauthorizedSafetyAction.selector);
        safety.openCase(reportId, keccak256("policy/v1"));
    }

    function testScopedModeratorCanApplyTemporaryRestriction() public {
        bytes32 caseId = _case();
        vm.prank(MOD);
        bytes32 actionId = safety.applyAction(caseId, BongGogglesTypes420.SafetyActionType.TEMP_ACCOUNT_RESTRICTION, keccak256("rationale"), uint64(block.timestamp + 1 hours));
        require(safety.isActionActive(actionId), "temporary action active");
    }

    function testPermanentSuspensionReserved() public {
        bytes32 caseId = _case();
        vm.prank(MOD);
        vm.expectRevert(BongGogglesSafetyRegistry420.PermanentSuspensionReserved.selector);
        safety.applyAction(caseId, BongGogglesTypes420.SafetyActionType.ACCOUNT_SUSPENSION, keccak256("rationale"), 0);
    }

    function testSubjectCanAppealAndSameOperatorCannotResolve() public {
        bytes32 caseId = _case();
        vm.prank(MOD);
        bytes32 actionId = safety.applyAction(caseId, BongGogglesTypes420.SafetyActionType.REMOVE_CONTENT, keccak256("rationale"), 0);
        vm.prank(BOB);
        bytes32 appealId = safety.fileAppeal(caseId, BOB, keccak256("appeal/reason"));
        vm.prank(MOD);
        vm.expectRevert(BongGogglesSafetyRegistry420.SameOperatorAppeal.selector);
        safety.resolveAppeal(appealId, false);
        vm.prank(APPEALER);
        safety.resolveAppeal(appealId, false);
        require(!safety.isActionActive(actionId), "overturn revokes latest action");
        require(safety.appeal(appealId).state == BongGogglesTypes420.AppealState.OVERTURNED, "appeal overturned");
    }

    function testEmergencyHideIsStrictlyTimeBound() public {
        bytes32 targetId = keccak256("post/1");
        vm.prank(MOD);
        vm.expectRevert(BongGogglesSafetyRegistry420.InvalidEmergencyWindow.selector);
        safety.setEmergencyHide(BongGogglesTypes420.SafetyTargetType.OBJECT, targetId, BOB, uint64(block.timestamp + 2 days));
        vm.prank(MOD);
        safety.setEmergencyHide(BongGogglesTypes420.SafetyTargetType.OBJECT, targetId, BOB, uint64(block.timestamp + 12 hours));
        bytes32 scope = safety.scopeForTarget(BongGogglesTypes420.SafetyTargetType.OBJECT, targetId, BOB);
        require(safety.emergencyHiddenUntil(scope) > block.timestamp, "hide recorded");
    }
}
