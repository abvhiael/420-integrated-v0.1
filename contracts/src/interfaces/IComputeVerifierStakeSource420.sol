// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Narrow read interface for CMP-1.5 verifier collateral.
/// @dev Verifier identity/lifecycle, capability and appointment remain independently authoritative.
interface IComputeVerifierStakeSource420 {
    struct PositionRead {
        bytes32 positionId;
        uint64 positionRevision;
        address authority;
        uint64 verifierRevision;
        uint256 activeAmount;
        uint256 slashableAmount;
        bool active;
        bool exiting;
        uint64 withdrawableAt;
    }

    function computeVerifierStakeSourceId() external pure returns (bytes32);

    function readVerifierPosition(bytes32 verifierId, bytes32 stakePolicyId)
        external
        view
        returns (PositionRead memory out);
}
