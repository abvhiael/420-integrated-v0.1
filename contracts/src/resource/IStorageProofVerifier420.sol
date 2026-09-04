// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IStorageProofVerifier420 {
    function verifyStorageProof(
        bytes32 proofSchemeId,
        bytes32 commitmentId,
        bytes32 providerId,
        bytes32 nodeId,
        bytes32 contentRoot,
        bytes32 replicaRoot,
        bytes32 challengeId,
        uint64 challengeEpoch,
        bytes calldata proof
    ) external view returns (bool);
}
