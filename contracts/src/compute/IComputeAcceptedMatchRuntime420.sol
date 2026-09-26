// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IComputeAcceptedMatchRuntime420 {
    function jobs() external view returns (address);
    function authorizedResource(bytes32 jobId, bytes32 matchId, bytes32 acceptanceRef,
        bytes32 resourceId, address operator) external view returns (bool);
    function matchParties(bytes32 matchId)
        external view returns (bytes32 jobId, address owner, address operator, bool exists);
}
