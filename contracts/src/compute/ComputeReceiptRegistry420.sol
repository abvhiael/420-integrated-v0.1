// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ComputeJobRegistry420.sol";
import "./ComputeProviderRegistry420.sol";

contract ComputeReceiptRegistry420 is I420System {
    struct Receipt {
        bytes32 jobId;
        bytes32 providerId;
        bytes32 resourceId;
        uint64 sequence;
        bytes32 priorReceiptHash;
        uint128 cumulativeUnits;
        uint256 cumulativeCharge420;
        bytes32 executionManifestHash;
        bytes32 evidenceRef;
        uint64 observedAt;
        bool exists;
    }

    ComputeJobRegistry420 public immutable jobs;
    ComputeProviderRegistry420 public immutable providers;
    mapping(bytes32 => Receipt) private _receipts;
    mapping(bytes32 => bytes32) public lastReceiptId;
    mapping(bytes32 => uint64) public lastSequence;
    mapping(bytes32 => uint128) public lastUnits;
    mapping(bytes32 => uint256) public lastCharge420;

    error InvalidReceipt();
    error ReceiptExists();
    error Unauthorized();

    event ReceiptSubmitted(
        bytes32 indexed receiptId,
        bytes32 indexed jobId,
        uint64 sequence,
        uint128 cumulativeUnits,
        uint256 cumulativeCharge420
    );

    constructor(address jobs_, address providers_) {
        if (jobs_ == address(0) || providers_ == address(0)) revert InvalidReceipt();
        jobs = ComputeJobRegistry420(jobs_);
        providers = ComputeProviderRegistry420(providers_);
    }

    function systemName() external pure returns (string memory) { return "ComputeReceiptRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function canonicalReceiptId(
        bytes32 jobId,
        uint64 sequence,
        bytes32 priorReceiptHash,
        uint128 cumulativeUnits,
        uint256 cumulativeCharge420,
        bytes32 executionManifestHash
    ) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                "420/COMPUTE/RECEIPT/V1",
                block.chainid,
                address(this),
                jobId,
                sequence,
                priorReceiptHash,
                cumulativeUnits,
                cumulativeCharge420,
                executionManifestHash
            )
        );
    }

    function submitReceipt(
        bytes32 receiptId,
        bytes32 jobId,
        uint64 sequence,
        bytes32 priorReceiptHash,
        uint128 cumulativeUnits,
        uint256 cumulativeCharge420,
        bytes32 executionManifestHash,
        bytes32 evidenceRef
    ) external {
        if (
            receiptId
                != canonicalReceiptId(
                    jobId,
                    sequence,
                    priorReceiptHash,
                    cumulativeUnits,
                    cumulativeCharge420,
                    executionManifestHash
                ) || executionManifestHash == bytes32(0)
        ) revert InvalidReceipt();
        if (_receipts[receiptId].exists) revert ReceiptExists();

        ComputeJobRegistry420.Job memory j = jobs.getJob(jobId);
        ComputeProviderRegistry420.Provider memory p = providers.getProvider(j.providerId);
        if (msg.sender != p.operatorAccount) revert Unauthorized();

        if (
            sequence != lastSequence[jobId] + 1 || priorReceiptHash != lastReceiptId[jobId]
                || cumulativeUnits < lastUnits[jobId] || cumulativeCharge420 < lastCharge420[jobId]
        ) revert InvalidReceipt();

        _receipts[receiptId] = Receipt({
            jobId: jobId,
            providerId: j.providerId,
            resourceId: j.resourceId,
            sequence: sequence,
            priorReceiptHash: priorReceiptHash,
            cumulativeUnits: cumulativeUnits,
            cumulativeCharge420: cumulativeCharge420,
            executionManifestHash: executionManifestHash,
            evidenceRef: evidenceRef,
            observedAt: uint64(block.timestamp),
            exists: true
        });

        lastReceiptId[jobId] = receiptId;
        lastSequence[jobId] = sequence;
        lastUnits[jobId] = cumulativeUnits;
        lastCharge420[jobId] = cumulativeCharge420;
        emit ReceiptSubmitted(receiptId, jobId, sequence, cumulativeUnits, cumulativeCharge420);
    }

    function getReceipt(bytes32 receiptId) external view returns (Receipt memory r) {
        r = _receipts[receiptId];
        if (!r.exists) revert InvalidReceipt();
    }
}
