// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library CapabilityIds420 {
    bytes32 internal constant PAY_SETTLE = keccak256("420/APP/CAP/PAY_SETTLE");
    bytes32 internal constant PAY_REFUND = keccak256("420/APP/CAP/PAY_REFUND");
    bytes32 internal constant BRIDGE_VERIFY = keccak256("420/APP/CAP/BRIDGE_VERIFY");
    bytes32 internal constant BRIDGE_COMPLETE = keccak256("420/APP/CAP/BRIDGE_COMPLETE");
    bytes32 internal constant ORACLE_PUBLISH = keccak256("420/APP/CAP/ORACLE_PUBLISH");
    bytes32 internal constant TREASURY_SPEND = keccak256("420/APP/CAP/TREASURY_SPEND");
    bytes32 internal constant AI_JOB_SETTLE = keccak256("420/APP/CAP/AI_JOB_SETTLE");
    bytes32 internal constant REGISTRY_UPDATE = keccak256("420/APP/CAP/REGISTRY_UPDATE");
    bytes32 internal constant SESSION_EXECUTE = keccak256("420/APP/CAP/SESSION_EXECUTE");
    bytes32 internal constant GAS_SPONSOR = keccak256("420/APP/CAP/GAS_SPONSOR");
}
