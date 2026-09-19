// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library ComputeIds420 {
    bytes32 internal constant COMPONENT_COMPUTE = keccak256("420/COMPUTE/COMPONENT/V1");

    bytes32 internal constant CLASS_CPU_GENERAL = keccak256("420/COMPUTE/CLASS/CPU_GENERAL/V1");
    bytes32 internal constant CLASS_GPU_INFERENCE = keccak256("420/COMPUTE/CLASS/GPU_INFERENCE/V1");
    bytes32 internal constant CLASS_GPU_TRAINING = keccak256("420/COMPUTE/CLASS/GPU_TRAINING/V1");
    bytes32 internal constant CLASS_GPU_RENDER = keccak256("420/COMPUTE/CLASS/GPU_RENDER/V1");
    bytes32 internal constant CLASS_ACCELERATOR_GENERAL = keccak256("420/COMPUTE/CLASS/ACCELERATOR_GENERAL/V1");
    bytes32 internal constant CLASS_ZK_PROVER = keccak256("420/COMPUTE/CLASS/ZK_PROVER/V1");
    bytes32 internal constant CLASS_HIGH_MEMORY = keccak256("420/COMPUTE/CLASS/HIGH_MEMORY/V1");

    bytes32 internal constant WORKLOAD_AI_INFERENCE = keccak256("420/COMPUTE/WORKLOAD/AI_INFERENCE/V1");
    bytes32 internal constant WORKLOAD_AI_TRAINING = keccak256("420/COMPUTE/WORKLOAD/AI_TRAINING/V1");
    bytes32 internal constant WORKLOAD_RENDER = keccak256("420/COMPUTE/WORKLOAD/RENDER/V1");
    bytes32 internal constant WORKLOAD_ZK_PROVING = keccak256("420/COMPUTE/WORKLOAD/ZK_PROVING/V1");
    bytes32 internal constant WORKLOAD_SIMULATION = keccak256("420/COMPUTE/WORKLOAD/SIMULATION/V1");
    bytes32 internal constant WORKLOAD_TRANSCODE = keccak256("420/COMPUTE/WORKLOAD/TRANSCODE/V1");
    bytes32 internal constant WORKLOAD_BATCH_GENERAL = keccak256("420/COMPUTE/WORKLOAD/BATCH_GENERAL/V1");
    bytes32 internal constant WORKLOAD_CUSTOM_VERSIONED = keccak256("420/COMPUTE/WORKLOAD/CUSTOM_VERSIONED/V1");

    bytes32 internal constant ACTION_REGISTER_PROVIDER = keccak256("420/COMPUTE/ACTION/REGISTER_PROVIDER/V1");
    bytes32 internal constant ACTION_UPDATE_PROVIDER = keccak256("420/COMPUTE/ACTION/UPDATE_PROVIDER/V1");
    bytes32 internal constant ACTION_SET_PROVIDER_STATE = keccak256("420/COMPUTE/ACTION/SET_PROVIDER_STATE/V1");
    bytes32 internal constant ACTION_REGISTER_NODE = keccak256("420/COMPUTE/ACTION/REGISTER_NODE/V1");
    bytes32 internal constant ACTION_UPDATE_NODE = keccak256("420/COMPUTE/ACTION/UPDATE_NODE/V1");
    bytes32 internal constant ACTION_SET_NODE_STATE = keccak256("420/COMPUTE/ACTION/SET_NODE_STATE/V1");
    bytes32 internal constant ACTION_REGISTER_RESOURCE = keccak256("420/COMPUTE/ACTION/REGISTER_RESOURCE/V1");
    bytes32 internal constant ACTION_UPDATE_RESOURCE = keccak256("420/COMPUTE/ACTION/UPDATE_RESOURCE/V1");
    bytes32 internal constant ACTION_SET_RESOURCE_STATE = keccak256("420/COMPUTE/ACTION/SET_RESOURCE_STATE/V1");
    bytes32 internal constant ACTION_PUBLISH_OFFER = keccak256("420/COMPUTE/ACTION/PUBLISH_OFFER/V1");
    bytes32 internal constant ACTION_CREATE_REQUEST = keccak256("420/COMPUTE/ACTION/CREATE_REQUEST/V1");
    bytes32 internal constant ACTION_FUND_REQUEST = keccak256("420/COMPUTE/ACTION/FUND_REQUEST/V1");
    bytes32 internal constant ACTION_ACCEPT_MATCH = keccak256("420/COMPUTE/ACTION/ACCEPT_MATCH/V1");
    bytes32 internal constant ACTION_ADVANCE_JOB = keccak256("420/COMPUTE/ACTION/ADVANCE_JOB/V1");
    bytes32 internal constant ACTION_SUBMIT_RECEIPT = keccak256("420/COMPUTE/ACTION/SUBMIT_RECEIPT/V1");
    bytes32 internal constant ACTION_VERIFY = keccak256("420/COMPUTE/ACTION/VERIFY/V1");
    bytes32 internal constant ACTION_SETTLE = keccak256("420/COMPUTE/ACTION/SETTLE/V1");
    bytes32 internal constant ACTION_DISPUTE = keccak256("420/COMPUTE/ACTION/DISPUTE/V1");

    function isComputeClass(bytes32 x) internal pure returns (bool) {
        return x == CLASS_CPU_GENERAL || x == CLASS_GPU_INFERENCE || x == CLASS_GPU_TRAINING
            || x == CLASS_GPU_RENDER || x == CLASS_ACCELERATOR_GENERAL || x == CLASS_ZK_PROVER
            || x == CLASS_HIGH_MEMORY;
    }

    function isWorkload(bytes32 x) internal pure returns (bool) {
        return x == WORKLOAD_AI_INFERENCE || x == WORKLOAD_AI_TRAINING || x == WORKLOAD_RENDER
            || x == WORKLOAD_ZK_PROVING || x == WORKLOAD_SIMULATION || x == WORKLOAD_TRANSCODE
            || x == WORKLOAD_BATCH_GENERAL || x == WORKLOAD_CUSTOM_VERSIONED;
    }
}
