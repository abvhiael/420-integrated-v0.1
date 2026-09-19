// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library AIIds420 {
    bytes32 internal constant COMPONENT_AI = keccak256("420/AI/COMPONENT/V1");

    bytes32 internal constant WORKLOAD_TEXT = keccak256("420/AI/WORKLOAD/TEXT/V1");
    bytes32 internal constant WORKLOAD_MULTIMODAL = keccak256("420/AI/WORKLOAD/MULTIMODAL/V1");
    bytes32 internal constant WORKLOAD_IMAGE = keccak256("420/AI/WORKLOAD/IMAGE/V1");
    bytes32 internal constant WORKLOAD_AUDIO = keccak256("420/AI/WORKLOAD/AUDIO/V1");
    bytes32 internal constant WORKLOAD_VIDEO = keccak256("420/AI/WORKLOAD/VIDEO/V1");
    bytes32 internal constant WORKLOAD_EMBEDDING = keccak256("420/AI/WORKLOAD/EMBEDDING/V1");
    bytes32 internal constant WORKLOAD_RERANK = keccak256("420/AI/WORKLOAD/RERANK/V1");
    bytes32 internal constant WORKLOAD_FINE_TUNE = keccak256("420/AI/WORKLOAD/FINE_TUNE/V1");
    bytes32 internal constant WORKLOAD_BATCH = keccak256("420/AI/WORKLOAD/BATCH/V1");

    bytes32 internal constant ACTION_REGISTER_DEPLOYMENT = keccak256("420/AI/ACTION/REGISTER_DEPLOYMENT/V1");
    bytes32 internal constant ACTION_UPDATE_DEPLOYMENT = keccak256("420/AI/ACTION/UPDATE_DEPLOYMENT/V1");
    bytes32 internal constant ACTION_SET_DEPLOYMENT_STATE = keccak256("420/AI/ACTION/SET_DEPLOYMENT_STATE/V1");
    bytes32 internal constant ACTION_BIND_COMPUTE = keccak256("420/AI/ACTION/BIND_COMPUTE/V1");
    bytes32 internal constant ACTION_SYNC_JOB = keccak256("420/AI/ACTION/SYNC_JOB/V1");

    bytes32 internal constant OUTCOME_COMPLETED = keccak256("420/AI/OUTCOME/COMPLETED/V1");
    bytes32 internal constant OUTCOME_DISPUTED = keccak256("420/AI/OUTCOME/DISPUTED/V1");
    bytes32 internal constant OUTCOME_UPHELD = keccak256("420/AI/OUTCOME/UPHELD/V1");
    bytes32 internal constant OUTCOME_FAILED = keccak256("420/AI/OUTCOME/FAILED/V1");

    function isWorkload(bytes32 x) internal pure returns (bool) {
        return x == WORKLOAD_TEXT || x == WORKLOAD_MULTIMODAL || x == WORKLOAD_IMAGE
            || x == WORKLOAD_AUDIO || x == WORKLOAD_VIDEO || x == WORKLOAD_EMBEDDING
            || x == WORKLOAD_RERANK || x == WORKLOAD_FINE_TUNE || x == WORKLOAD_BATCH;
    }
}
