// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";

/// @notice Frozen 0x0437 compatibility surface for 420Civic governance.
/// @dev Legacy proposal/vote/result mutation paths are permanently retired. Canonical governance
/// authority lives in CivicGovernor420 and executes only through GovernanceTimelock at 0x0429.
contract Governance420 is SystemAccess, I420System {
    enum Class { G1, G2, G3, G4 }
    enum State { NONE, ACTIVE, PASSED, FAILED, QUEUED, EXECUTED }

    struct Proposal {
        address proposer;
        Class class_;
        bytes32 metadataHash;
        uint64 snapshotBlock;
        uint64 voteEnd;
        uint256 communityYes;
        uint256 communityNo;
        uint256 validatorYes;
        uint256 validatorNo;
        State state;
    }

    /// @notice Retained only for ABI/state-layout compatibility with the original predeploy surface.
    /// @dev No function in this contract can create or mutate legacy proposals anymore.
    mapping(bytes32 => Proposal) public proposals;

    address public civicGovernor;

    error LegacySurfaceRetired();
    error InvalidCivicGovernor();
    error CivicGovernorAlreadyBound();

    event CivicGovernorBound(address indexed civicGovernor);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) {
        return "Governance420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 2;
    }

    /// @notice One-time compatibility pointer from the frozen 0x0437 identity to canonical Civic governance.
    /// @dev Binding is controlled only by the GovernanceTimelock and cannot be replaced once set.
    function bindCivicGovernor(address governor) external onlyGovernance {
        if (civicGovernor != address(0)) revert CivicGovernorAlreadyBound();
        if (governor == address(0) || governor.code.length == 0) revert InvalidCivicGovernor();
        civicGovernor = governor;
        emit CivicGovernorBound(governor);
    }

    /// @dev Retained selector; permanently disabled so 0x0437 cannot host a parallel proposal system.
    function createProposal(bytes32, Class, bytes32, uint64, uint64) external pure {
        revert LegacySurfaceRetired();
    }

    /// @dev Retained selector; permanently disabled so vote weights cannot be injected by any authority.
    function applyVote(bytes32, bool, bool, uint256) external pure {
        revert LegacySurfaceRetired();
    }

    /// @dev Retained selector; permanently disabled so pass/fail results cannot be injected by any authority.
    function applyResult(bytes32, bool) external pure {
        revert LegacySurfaceRetired();
    }
}
