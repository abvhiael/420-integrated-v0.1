// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ArbitrationCaseRegistry420.sol";

contract ArbitrationRulingRegistry420 is I420System {
    struct Ruling {
        uint32 outcomeCode;
        bytes32 rulingHash;
        bytes32 remedyCommitment;
        bytes32 panelCommitment;
        address resolver;
        uint64 ruledAt;
        bool exists;
    }

    ArbitrationCaseRegistry420 public immutable cases;
    mapping(bytes32 => mapping(uint8 => Ruling)) private _rulings;

    error ZeroAddress();
    error UnauthorizedResolver();
    error InvalidRuling();
    error RulingExists();
    error NotOpen();
    error NotRuled();
    error AppealWindowOpen();

    event RulingSubmitted(bytes32 indexed caseId, uint8 indexed round, address indexed resolver, uint32 outcomeCode, bytes32 rulingHash, bytes32 remedyCommitment, bytes32 panelCommitment);
    event RulingFinalized(bytes32 indexed caseId, uint8 indexed round, bytes32 rulingHash, bytes32 remedyCommitment);

    constructor(address caseRegistry_) {
        if (caseRegistry_ == address(0)) revert ZeroAddress();
        cases = ArbitrationCaseRegistry420(caseRegistry_);
    }

    function systemName() external pure returns (string memory) { return "ArbitrationRulingRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function submitRuling(bytes32 caseId, uint32 outcomeCode, bytes32 rulingHash, bytes32 remedyCommitment, bytes32 panelCommitment) external {
        (, address resolver, uint8 round, ArbitrationCaseRegistry420.State state,) = cases.rulingContext(caseId);
        if (state != ArbitrationCaseRegistry420.State.OPEN) revert NotOpen();
        if (msg.sender != resolver) revert UnauthorizedResolver();
        if (outcomeCode == 0 || rulingHash == bytes32(0)) revert InvalidRuling();
        if (_rulings[caseId][round].exists) revert RulingExists();
        _rulings[caseId][round] = Ruling(outcomeCode, rulingHash, remedyCommitment, panelCommitment, msg.sender, uint64(block.timestamp), true);
        cases.markRuled(caseId);
        emit RulingSubmitted(caseId, round, msg.sender, outcomeCode, rulingHash, remedyCommitment, panelCommitment);
    }

    function finalizeRuling(bytes32 caseId) external {
        (, , uint8 round, ArbitrationCaseRegistry420.State state, uint64 appealDeadline) = cases.rulingContext(caseId);
        if (state != ArbitrationCaseRegistry420.State.RULED) revert NotRuled();
        if (block.timestamp <= appealDeadline) revert AppealWindowOpen();
        Ruling storage r = _rulings[caseId][round];
        if (!r.exists) revert InvalidRuling();
        cases.finalize(caseId);
        emit RulingFinalized(caseId, round, r.rulingHash, r.remedyCommitment);
    }

    function getRuling(bytes32 caseId, uint8 round) external view returns (Ruling memory r) {
        r = _rulings[caseId][round];
        if (!r.exists) revert InvalidRuling();
    }
}
