// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";
import "./AIIds420.sol";

contract AIReputationRegistry is SystemAccess, I420System {
    struct Reputation {
        uint64 completed;
        uint64 disputed;
        uint64 upheld;
        uint64 failed;
    }

    mapping(bytes32 => Reputation) public reputation;
    mapping(bytes32 => bool) public evidenceApplied;
    address public trustAdapter;
    bool public trustAdapterBound;

    error AdapterAlreadyBound();
    error NotTrustAdapter();
    error InvalidEvidence();
    error EvidenceAlreadyApplied();
    error InvalidOutcome();

    event TrustAdapterBound(address indexed adapter);
    event ReputationApplied(bytes32 indexed providerId, uint64 completed, uint64 disputed, uint64 upheld);
    event EvidenceApplied(bytes32 indexed providerId, bytes32 indexed evidenceId, bytes32 indexed outcome, uint64 completed, uint64 disputed, uint64 upheld, uint64 failed);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "AIReputationRegistry"; }
    function protocolVersion() external pure returns (uint32) { return 2; }

    function bindTrustAdapter(address adapter) external onlyGovernance {
        if (trustAdapterBound) revert AdapterAlreadyBound();
        if (adapter == address(0)) revert ZeroAddress();
        trustAdapter = adapter;
        trustAdapterBound = true;
        emit TrustAdapterBound(adapter);
    }

    /// @notice Legacy arbitrary counter replacement is intentionally disabled in V2.
    function setReputation(bytes32, uint64, uint64, uint64) external pure {
        revert InvalidEvidence();
    }

    function applyEvidence(bytes32 providerId, bytes32 evidenceId, bytes32 outcome) external onlyTrustAdapter {
        if (providerId == bytes32(0) || evidenceId == bytes32(0)) revert InvalidEvidence();
        if (evidenceApplied[evidenceId]) revert EvidenceAlreadyApplied();
        Reputation storage r = reputation[providerId];
        if (outcome == AIIds420.OUTCOME_COMPLETED) r.completed += 1;
        else if (outcome == AIIds420.OUTCOME_DISPUTED) r.disputed += 1;
        else if (outcome == AIIds420.OUTCOME_UPHELD) r.upheld += 1;
        else if (outcome == AIIds420.OUTCOME_FAILED) r.failed += 1;
        else revert InvalidOutcome();
        evidenceApplied[evidenceId] = true;
        emit EvidenceApplied(providerId, evidenceId, outcome, r.completed, r.disputed, r.upheld, r.failed);
        emit ReputationApplied(providerId, r.completed, r.disputed, r.upheld);
    }

    modifier onlyTrustAdapter() {
        if (!trustAdapterBound || msg.sender != trustAdapter) revert NotTrustAdapter();
        _;
    }
}
