// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/SystemAccess.sol";
import "./ArbitrationPolicyRegistry420.sol";

contract ArbitrationCaseRegistry420 is I420System, SystemAccess {
    enum State { NONE, OPEN, RULED, FINALIZED }

    struct CaseRecord {
        address claimant;
        address respondent;
        bytes32 domainId;
        bytes32 originComponentId;
        bytes32 originObjectId;
        bytes32 claimHash;
        bytes32 requestedRemedyHash;
        address resolver;
        address appealResolver;
        uint64 evidenceWindow;
        uint64 appealWindow;
        uint64 openedAt;
        uint64 evidenceDeadline;
        uint64 appealDeadline;
        uint8 maxAppeals;
        uint8 round;
        State state;
        bool exists;
    }

    ArbitrationPolicyRegistry420 public immutable policies;
    address public rulingRegistry;
    uint256 public nextNonce = 1;
    mapping(bytes32 => CaseRecord) private _cases;
    mapping(bytes32 => mapping(uint8 => mapping(bytes32 => bool))) public evidenceCommitted;

    error InvalidCase();
    error UnknownCase();
    error CaseNotOpen();
    error NotParty();
    error EvidenceWindowClosed();
    error AppealUnavailable();
    error RulingRegistryAlreadyBound();
    error OnlyRulingRegistry();

    event RulingRegistryBound(address indexed rulingRegistry);
    event CaseOpened(bytes32 indexed caseId, bytes32 indexed domainId, address indexed claimant, address respondent, bytes32 originComponentId, bytes32 originObjectId);
    event EvidenceCommitted(bytes32 indexed caseId, uint8 indexed round, address indexed submitter, bytes32 evidenceHash);
    event CaseRuled(bytes32 indexed caseId, uint8 indexed round, uint64 appealDeadline);
    event CaseAppealed(bytes32 indexed caseId, uint8 indexed round, address indexed appellant, uint64 evidenceDeadline);
    event CaseFinalized(bytes32 indexed caseId, uint8 indexed round);

    constructor(address timelock_, address policyRegistry_) SystemAccess(timelock_) {
        if (policyRegistry_ == address(0)) revert ZeroAddress();
        policies = ArbitrationPolicyRegistry420(policyRegistry_);
    }

    function systemName() external pure returns (string memory) { return "ArbitrationCaseRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function bindRulingRegistry(address registry) external onlyGovernance {
        if (registry == address(0)) revert ZeroAddress();
        if (rulingRegistry != address(0)) revert RulingRegistryAlreadyBound();
        rulingRegistry = registry;
        emit RulingRegistryBound(registry);
    }

    function openCase(bytes32 domainId, address respondent, bytes32 originComponentId, bytes32 originObjectId, bytes32 claimHash, bytes32 requestedRemedyHash) external returns (bytes32 caseId) {
        ArbitrationPolicyRegistry420.Policy memory p = policies.getPolicy(domainId);
        if (!p.active || respondent == address(0) || respondent == msg.sender || originComponentId == bytes32(0) || originObjectId == bytes32(0) || claimHash == bytes32(0)) revert InvalidCase();
        uint256 nonce = nextNonce++;
        caseId = keccak256(abi.encode(block.chainid, address(this), nonce, msg.sender, respondent, domainId, originComponentId, originObjectId, claimHash));
        uint64 nowTs = uint64(block.timestamp);
        _cases[caseId] = CaseRecord(msg.sender, respondent, domainId, originComponentId, originObjectId, claimHash, requestedRemedyHash, p.resolver, p.appealResolver, p.evidenceWindow, p.appealWindow, nowTs, nowTs + p.evidenceWindow, 0, p.maxAppeals, 0, State.OPEN, true);
        emit CaseOpened(caseId, domainId, msg.sender, respondent, originComponentId, originObjectId);
    }

    function submitEvidence(bytes32 caseId, bytes32 evidenceHash) external {
        CaseRecord storage c = _cases[caseId];
        if (!c.exists) revert UnknownCase();
        if (c.state != State.OPEN) revert CaseNotOpen();
        if (msg.sender != c.claimant && msg.sender != c.respondent) revert NotParty();
        if (block.timestamp > c.evidenceDeadline) revert EvidenceWindowClosed();
        if (evidenceHash == bytes32(0)) revert InvalidCase();
        evidenceCommitted[caseId][c.round][evidenceHash] = true;
        emit EvidenceCommitted(caseId, c.round, msg.sender, evidenceHash);
    }

    function appeal(bytes32 caseId) external {
        CaseRecord storage c = _cases[caseId];
        if (!c.exists) revert UnknownCase();
        if (msg.sender != c.claimant && msg.sender != c.respondent) revert NotParty();
        if (c.state != State.RULED || block.timestamp > c.appealDeadline || c.round >= c.maxAppeals) revert AppealUnavailable();
        c.round += 1;
        c.state = State.OPEN;
        c.evidenceDeadline = uint64(block.timestamp) + c.evidenceWindow;
        c.appealDeadline = 0;
        emit CaseAppealed(caseId, c.round, msg.sender, c.evidenceDeadline);
    }

    function markRuled(bytes32 caseId) external {
        if (msg.sender != rulingRegistry || rulingRegistry == address(0)) revert OnlyRulingRegistry();
        CaseRecord storage c = _cases[caseId];
        if (!c.exists) revert UnknownCase();
        if (c.state != State.OPEN) revert CaseNotOpen();
        c.state = State.RULED;
        c.appealDeadline = uint64(block.timestamp) + c.appealWindow;
        emit CaseRuled(caseId, c.round, c.appealDeadline);
    }

    function finalize(bytes32 caseId) external {
        if (msg.sender != rulingRegistry || rulingRegistry == address(0)) revert OnlyRulingRegistry();
        CaseRecord storage c = _cases[caseId];
        if (!c.exists) revert UnknownCase();
        if (c.state != State.RULED || block.timestamp <= c.appealDeadline) revert AppealUnavailable();
        c.state = State.FINALIZED;
        emit CaseFinalized(caseId, c.round);
    }

    function rulingContext(bytes32 caseId) external view returns (bytes32 domainId, address resolver, uint8 round, State state, uint64 appealDeadline) {
        CaseRecord storage c = _cases[caseId];
        if (!c.exists) revert UnknownCase();
        address selected = c.round == 0 ? c.resolver : c.appealResolver;
        return (c.domainId, selected, c.round, c.state, c.appealDeadline);
    }

    function caseState(bytes32 caseId) external view returns (State) { if (!_cases[caseId].exists) revert UnknownCase(); return _cases[caseId].state; }
    function caseRound(bytes32 caseId) external view returns (uint8) { if (!_cases[caseId].exists) revert UnknownCase(); return _cases[caseId].round; }
}
