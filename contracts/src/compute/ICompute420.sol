// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Read-only discovery surface for the deployed ComputeMarket V1 component graph.
/// @dev This interface intentionally exposes no custody, settlement, matching, verification,
/// dispute, governance or job-mutation entry point. Callers execute against the canonical
/// underlying components after independently checking their own authorization requirements.
interface ICompute420 {
    function componentGraphHash() external view returns (bytes32);
    function jobRegistry() external view returns (address);
    function fundingAdapter() external view returns (address);
    function matchRegistry() external view returns (address);
    function workerEvidence() external view returns (address);
    function verificationRouter() external view returns (address);
    function disputeResolver() external view returns (address);
    function settlementAdapter() external view returns (address);
    function providerRegistry() external view returns (address);
    function nodeRegistry() external view returns (address);
    function resourceRegistry() external view returns (address);
    function offerRegistry() external view returns (address);
}
