// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library AIIds420 {
    bytes32 internal constant WORKLOAD_TEXT = keccak256("420/AI/WORKLOAD/TEXT/V1");
    bytes32 internal constant WORKLOAD_MULTIMODAL = keccak256("420/AI/WORKLOAD/MULTIMODAL/V1");
    bytes32 internal constant WORKLOAD_IMAGE = keccak256("420/AI/WORKLOAD/IMAGE/V1");
    bytes32 internal constant WORKLOAD_AUDIO = keccak256("420/AI/WORKLOAD/AUDIO/V1");
    bytes32 internal constant WORKLOAD_VIDEO = keccak256("420/AI/WORKLOAD/VIDEO/V1");
    bytes32 internal constant WORKLOAD_EMBEDDING = keccak256("420/AI/WORKLOAD/EMBEDDING/V1");
    bytes32 internal constant WORKLOAD_RERANK = keccak256("420/AI/WORKLOAD/RERANK/V1");
    bytes32 internal constant WORKLOAD_FINE_TUNE = keccak256("420/AI/WORKLOAD/FINE_TUNE/V1");
    bytes32 internal constant WORKLOAD_BATCH = keccak256("420/AI/WORKLOAD/BATCH/V1");

    bytes32 internal constant OUTCOME_COMPLETED = keccak256("420/AI/OUTCOME/COMPLETED/V1");
    bytes32 internal constant OUTCOME_DISPUTED = keccak256("420/AI/OUTCOME/DISPUTED/V1");
    bytes32 internal constant OUTCOME_UPHELD = keccak256("420/AI/OUTCOME/UPHELD/V1");
    bytes32 internal constant OUTCOME_FAILED = keccak256("420/AI/OUTCOME/FAILED/V1");
}
