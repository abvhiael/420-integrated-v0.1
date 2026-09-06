// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/genesis/ICapabilityRegistry420.sol";
import "./BongGogglesAuthorization420.sol";
import "./BongGogglesProfileRegistry420.sol";
import "./BongGogglesIds420.sol";

contract BongGogglesSafetyRegistry420 {
    struct Report {
        bytes32 reportId;
        address reporter;
        address subjectAccount;
        BongGogglesTypes420.SafetyTargetType targetType;
        bytes32 targetId;
        bytes32 reasonCode;
        bytes32 evidenceHash;
        uint64 createdAt;
        bool exists;
    }

    struct CaseRecord {
        bytes32 caseId;
        bytes32 reportId;
        address subjectAccount;
        BongGogglesTypes420.SafetyTargetType targetType;
        bytes32 targetId;
        bytes32 policyVersion;
        address openedBy;
        BongGogglesTypes420.SafetyCaseState state;
        uint64 openedAt;
        uint64 closedAt;
        bool exists;
    }

    struct ActionRecord {
        bytes32 actionId;
        bytes32 caseId;
        BongGogglesTypes420.SafetyActionType actionType;
        bytes32 rationaleHash;
        address appliedBy;
        uint64 startsAt;
        uint64 expiresAt;
        uint64 revokedAt;
        bool exists;
    }

    struct Appeal {
        bytes32 appealId;
        bytes32 caseId;
        address appellant;
        bytes32 reasonHash;
        address resolvedBy;
        BongGogglesTypes420.AppealState state;
        uint64 createdAt;
        uint64 resolvedAt;
        bool exists;
    }

    BongGogglesAuthorization420 public immutable authorization;
    BongGogglesProfileRegistry420 public immutable profiles;
    ICapabilityRegistry420 public immutable capabilities;

    mapping(bytes32 => Report) private _reports;
    mapping(bytes32 => CaseRecord) private _cases;
    mapping(bytes32 => ActionRecord) private _actions;
    mapping(bytes32 => Appeal) private _appeals;
    mapping(bytes32 => bytes32) public latestActionForCase;
    mapping(bytes32 => bytes32) public pendingAppealForCase;
    mapping(bytes32 => uint64) public emergencyHiddenUntil;
    uint256 private _reportNonce;
    uint256 private _caseNonce;
    uint256 private _actionNonce;
    uint256 private _appealNonce;

    error ZeroAddress();
    error InactiveProfile();
    error InvalidReport();
    error ReportMissing();
    error UnauthorizedSafetyAction();
    error CaseMissing();
    error InvalidCaseState();
    error InvalidAction();
    error ActionMissing();
    error AppealMissing();
    error AppealPending();
    error NotSubject();
    error SameOperatorAppeal();
    error PermanentSuspensionReserved();
    error InvalidEmergencyWindow();

    event ReportSubmitted(bytes32 indexed reportId, address indexed reporter, address indexed subjectAccount, BongGogglesTypes420.SafetyTargetType targetType, bytes32 targetId, bytes32 reasonCode);
    event CaseOpened(bytes32 indexed caseId, bytes32 indexed reportId, address indexed operator, bytes32 policyVersion);
    event SafetyActionApplied(bytes32 indexed actionId, bytes32 indexed caseId, BongGogglesTypes420.SafetyActionType actionType, address indexed operator, uint64 expiresAt);
    event SafetyActionRevoked(bytes32 indexed actionId, bytes32 indexed caseId, address indexed operator);
    event CaseClosed(bytes32 indexed caseId, address indexed operator);
    event AppealFiled(bytes32 indexed appealId, bytes32 indexed caseId, address indexed appellant);
    event AppealResolved(bytes32 indexed appealId, bytes32 indexed caseId, BongGogglesTypes420.AppealState result, address indexed operator);
    event EmergencyHideSet(bytes32 indexed targetScope, uint64 hiddenUntil, address indexed operator);

    constructor(address authorization_, address profiles_) {
        if (authorization_ == address(0) || profiles_ == address(0)) revert ZeroAddress();
        authorization = BongGogglesAuthorization420(authorization_);
        profiles = BongGogglesProfileRegistry420(profiles_);
        capabilities = authorization.capabilityRegistry();
    }

    function scopeForTarget(BongGogglesTypes420.SafetyTargetType targetType, bytes32 targetId, address subjectAccount)
        public pure returns (bytes32)
    {
        return keccak256(abi.encode("420/BONG_GOGGLES/SAFETY_SCOPE/V1", targetType, targetId, subjectAccount));
    }

    function submitReport(
        address reporter,
        address subjectAccount,
        BongGogglesTypes420.SafetyTargetType targetType,
        bytes32 targetId,
        bytes32 reasonCode,
        bytes32 evidenceHash
    ) external returns (bytes32 reportId) {
        if (msg.sender != reporter) revert UnauthorizedSafetyAction();
        if (!profiles.isActive(reporter)) revert InactiveProfile();
        if (subjectAccount == address(0) || targetId == bytes32(0) || reasonCode == bytes32(0)) revert InvalidReport();
        reportId = keccak256(abi.encode("420/BONG_GOGGLES/SAFETY_REPORT/V1", block.chainid, reporter, subjectAccount, targetType, targetId, ++_reportNonce));
        _reports[reportId] = Report(reportId, reporter, subjectAccount, targetType, targetId, reasonCode, evidenceHash, uint64(block.timestamp), true);
        emit ReportSubmitted(reportId, reporter, subjectAccount, targetType, targetId, reasonCode);
    }

    function openCase(bytes32 reportId, bytes32 policyVersion) external returns (bytes32 caseId) {
        Report storage r = _reports[reportId];
        if (!r.exists) revert ReportMissing();
        if (policyVersion == bytes32(0)) revert InvalidReport();
        bytes32 scope = scopeForTarget(r.targetType, r.targetId, r.subjectAccount);
        _requireCapability(BongGogglesIds420.ACTION_SAFETY_CASE_OPEN, scope);
        caseId = keccak256(abi.encode("420/BONG_GOGGLES/SAFETY_CASE/V1", block.chainid, reportId, ++_caseNonce));
        _cases[caseId] = CaseRecord(caseId, reportId, r.subjectAccount, r.targetType, r.targetId, policyVersion, msg.sender, BongGogglesTypes420.SafetyCaseState.OPEN, uint64(block.timestamp), 0, true);
        emit CaseOpened(caseId, reportId, msg.sender, policyVersion);
    }

    function applyAction(bytes32 caseId, BongGogglesTypes420.SafetyActionType actionType, bytes32 rationaleHash, uint64 expiresAt)
        external returns (bytes32 actionId)
    {
        CaseRecord storage c = _openCase(caseId);
        bytes32 scope = scopeForTarget(c.targetType, c.targetId, c.subjectAccount);
        _requireCapability(BongGogglesIds420.ACTION_SAFETY_ACTION_APPLY, scope);
        if (actionType == BongGogglesTypes420.SafetyActionType.ACCOUNT_SUSPENSION) revert PermanentSuspensionReserved();
        if (rationaleHash == bytes32(0)) revert InvalidAction();
        if ((actionType == BongGogglesTypes420.SafetyActionType.RESTRICT_INTERACTION || actionType == BongGogglesTypes420.SafetyActionType.TEMP_ACCOUNT_RESTRICTION) && expiresAt <= block.timestamp) revert InvalidAction();
        actionId = keccak256(abi.encode("420/BONG_GOGGLES/SAFETY_ACTION/V1", block.chainid, caseId, actionType, ++_actionNonce));
        _actions[actionId] = ActionRecord(actionId, caseId, actionType, rationaleHash, msg.sender, uint64(block.timestamp), expiresAt, 0, true);
        latestActionForCase[caseId] = actionId;
        emit SafetyActionApplied(actionId, caseId, actionType, msg.sender, expiresAt);
    }

    function revokeAction(bytes32 actionId) external {
        ActionRecord storage a = _actions[actionId];
        if (!a.exists) revert ActionMissing();
        if (a.revokedAt != 0) revert InvalidAction();
        CaseRecord storage c = _cases[a.caseId];
        bytes32 scope = scopeForTarget(c.targetType, c.targetId, c.subjectAccount);
        _requireCapability(BongGogglesIds420.ACTION_SAFETY_ACTION_REVOKE, scope);
        a.revokedAt = uint64(block.timestamp);
        emit SafetyActionRevoked(actionId, a.caseId, msg.sender);
    }

    function closeCase(bytes32 caseId) external {
        CaseRecord storage c = _openCase(caseId);
        bytes32 scope = scopeForTarget(c.targetType, c.targetId, c.subjectAccount);
        _requireCapability(BongGogglesIds420.ACTION_SAFETY_CASE_CLOSE, scope);
        if (pendingAppealForCase[caseId] != bytes32(0)) revert AppealPending();
        c.state = BongGogglesTypes420.SafetyCaseState.CLOSED;
        c.closedAt = uint64(block.timestamp);
        emit CaseClosed(caseId, msg.sender);
    }

    function fileAppeal(bytes32 caseId, address appellant, bytes32 reasonHash) external returns (bytes32 appealId) {
        CaseRecord storage c = _cases[caseId];
        if (!c.exists) revert CaseMissing();
        if (msg.sender != appellant || appellant != c.subjectAccount) revert NotSubject();
        if (reasonHash == bytes32(0) || pendingAppealForCase[caseId] != bytes32(0)) revert AppealPending();
        appealId = keccak256(abi.encode("420/BONG_GOGGLES/SAFETY_APPEAL/V1", block.chainid, caseId, appellant, ++_appealNonce));
        _appeals[appealId] = Appeal(appealId, caseId, appellant, reasonHash, address(0), BongGogglesTypes420.AppealState.PENDING, uint64(block.timestamp), 0, true);
        pendingAppealForCase[caseId] = appealId;
        emit AppealFiled(appealId, caseId, appellant);
    }

    function resolveAppeal(bytes32 appealId, bool uphold) external {
        Appeal storage a = _appeals[appealId];
        if (!a.exists) revert AppealMissing();
        if (a.state != BongGogglesTypes420.AppealState.PENDING) revert InvalidCaseState();
        CaseRecord storage c = _cases[a.caseId];
        bytes32 scope = scopeForTarget(c.targetType, c.targetId, c.subjectAccount);
        _requireCapability(BongGogglesIds420.ACTION_SAFETY_APPEAL_RESOLVE, scope);
        if (msg.sender == c.openedBy) revert SameOperatorAppeal();
        a.state = uphold ? BongGogglesTypes420.AppealState.UPHELD : BongGogglesTypes420.AppealState.OVERTURNED;
        a.resolvedBy = msg.sender;
        a.resolvedAt = uint64(block.timestamp);
        pendingAppealForCase[a.caseId] = bytes32(0);
        if (!uphold) {
            bytes32 actionId = latestActionForCase[a.caseId];
            if (actionId != bytes32(0) && _actions[actionId].revokedAt == 0) _actions[actionId].revokedAt = uint64(block.timestamp);
            c.state = BongGogglesTypes420.SafetyCaseState.RESOLVED;
        }
        emit AppealResolved(appealId, a.caseId, a.state, msg.sender);
    }

    function setEmergencyHide(BongGogglesTypes420.SafetyTargetType targetType, bytes32 targetId, address subjectAccount, uint64 hiddenUntil) external {
        bytes32 scope = scopeForTarget(targetType, targetId, subjectAccount);
        _requireCapability(BongGogglesIds420.ACTION_SAFETY_EMERGENCY_HIDE, scope);
        if (hiddenUntil <= block.timestamp || hiddenUntil > block.timestamp + 1 days) revert InvalidEmergencyWindow();
        emergencyHiddenUntil[scope] = hiddenUntil;
        emit EmergencyHideSet(scope, hiddenUntil, msg.sender);
    }

    function isActionActive(bytes32 actionId) external view returns (bool) {
        ActionRecord storage a = _actions[actionId];
        return a.exists && a.revokedAt == 0 && (a.expiresAt == 0 || a.expiresAt > block.timestamp);
    }

    function report(bytes32 reportId) external view returns (Report memory) { return _reports[reportId]; }
    function safetyCase(bytes32 caseId) external view returns (CaseRecord memory) { return _cases[caseId]; }
    function action(bytes32 actionId) external view returns (ActionRecord memory) { return _actions[actionId]; }
    function appeal(bytes32 appealId) external view returns (Appeal memory) { return _appeals[appealId]; }

    function _openCase(bytes32 caseId) private view returns (CaseRecord storage c) {
        c = _cases[caseId];
        if (!c.exists) revert CaseMissing();
        if (c.state != BongGogglesTypes420.SafetyCaseState.OPEN) revert InvalidCaseState();
    }

    function _requireCapability(bytes32 actionId, bytes32 scope) private view {
        if (!capabilities.isAuthorized(msg.sender, BongGogglesIds420.COMPONENT_BONG_GOGGLES, actionId, scope, 0)) revert UnauthorizedSafetyAction();
    }
}
