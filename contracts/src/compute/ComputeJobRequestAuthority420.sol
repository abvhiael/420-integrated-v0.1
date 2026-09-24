// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Request records owned by the authenticated caller, for binding
/// immutable ComputeJob creation parameters to a prior on-chain commitment.
/// @dev This does not certify an off-chain execution manifest signature,
/// payer's financial authority, an execution match or its worker/verifier.
contract ComputeJobRequestAuthority420 {
    bytes32 private constant REQUEST_DOMAIN = keccak256("420/COMPUTE/CANONICAL_REQUEST/V1");

    struct Request {
        address owner;
        bytes32 requestCommitment;
        bytes32 manifestHash;
        bytes32 workloadType;
        bytes32 inputCommitment;
        bytes32 outputSchemaCommitment;
        uint64 deadline;
        bool exists;
    }

    uint64 public nextRequestNonce;
    mapping(bytes32 => Request) private _requests;

    error InvalidRequest();

    event RequestRegistered(bytes32 indexed requestId, address indexed owner, bytes32 indexed requestCommitment);

    function registerRequest(bytes32 manifestHash, bytes32 workloadType, bytes32 inputCommitment,
        bytes32 outputSchemaCommitment, uint64 deadline) external returns (bytes32 requestId) {
        if (msg.sender == address(0) || manifestHash == bytes32(0) || workloadType == bytes32(0)
            || inputCommitment == bytes32(0) || outputSchemaCommitment == bytes32(0)
            || deadline <= block.timestamp) revert InvalidRequest();
        uint64 nonce = ++nextRequestNonce;
        requestId = keccak256(abi.encode(REQUEST_DOMAIN, block.chainid, address(this), msg.sender, nonce));
        bytes32 commitment = keccak256(abi.encode(REQUEST_DOMAIN, block.chainid, address(this), requestId,
            msg.sender, manifestHash, workloadType, inputCommitment, outputSchemaCommitment, deadline));
        _requests[requestId] = Request(msg.sender, commitment, manifestHash, workloadType,
            inputCommitment, outputSchemaCommitment, deadline, true);
        emit RequestRegistered(requestId, msg.sender, commitment);
    }

    function getRequest(bytes32 requestId) external view returns (Request memory request_) {
        request_ = _requests[requestId];
        if (!request_.exists) revert InvalidRequest();
    }

    function validRequest(bytes32 requestId, address owner, bytes32 requestCommitment,
        bytes32 manifestHash, bytes32 workloadType, bytes32 inputCommitment,
        bytes32 outputSchemaCommitment, uint64 deadline) external view returns (bool) {
        Request storage r = _requests[requestId];
        return r.exists && requestId != bytes32(0) && owner != address(0) && r.owner == owner
            && r.requestCommitment == requestCommitment && r.manifestHash == manifestHash
            && r.workloadType == workloadType && r.inputCommitment == inputCommitment
            && r.outputSchemaCommitment == outputSchemaCommitment && r.deadline == deadline
            && deadline > block.timestamp;
    }
}
