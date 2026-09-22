// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeIds420.sol";

contract ComputeIds420Test {
    function _plan() private pure returns (ComputeIds420.WorkUnitV1 memory p) {
        p.jobId = bytes32(uint256(11));
        p.manifestHash = bytes32(uint256(22));
        p.partitionSchemeId = bytes32(uint256(33));
        p.partitionSchemeVersion = 1;
        p.partitionPlanHash = bytes32(uint256(44));
        p.partitionCount = 3;
        p.replicationFactor = 2;
        p.partitionIndex = 1;
        p.replicaIndex = 0;
    }

    function derive(uint256 chainId, ComputeIds420.WorkUnitV1 memory p) external pure returns (bytes32) {
        return ComputeIds420.workUnitId(chainId, p);
    }

    function deriveAttempt(uint256 chainId, bytes32 unitId, uint64 nonce) external pure returns (bytes32) {
        return ComputeIds420.attemptId(chainId, unitId, nonce);
    }

    // A try/catch surrounding a caller-side revert can pass despite a successful call.
    // Inspect the exact target call and its revert selector instead.
    function _rejectUnit(uint256 chainId, ComputeIds420.WorkUnitV1 memory p) private view {
        (bool ok, bytes memory errorData) = address(this).staticcall(abi.encodeCall(this.derive, (chainId, p)));
        require(!ok && errorData.length >= 4, "invalid unit input accepted");
        bytes4 selector;
        assembly { selector := mload(add(errorData, 32)) }
        require(selector == ComputeIds420.InvalidComputeIdentity.selector, "wrong unit rejection");
    }

    function _rejectAttempt(uint256 chainId, bytes32 unit, uint64 nonce) private view {
        (bool ok, bytes memory errorData) = address(this).staticcall(abi.encodeCall(this.deriveAttempt, (chainId, unit, nonce)));
        require(!ok && errorData.length >= 4, "invalid attempt input accepted");
        bytes4 selector;
        assembly { selector := mload(add(errorData, 32)) }
        require(selector == ComputeIds420.InvalidComputeIdentity.selector, "wrong attempt rejection");
    }

    function testWorkUnitStandardAbiOrderAndStability() public pure {
        ComputeIds420.WorkUnitV1 memory p = _plan();
        bytes32 expected = keccak256(abi.encode(
            keccak256("420Integrated.ComputeMarket.WorkUnit.v1"), uint256(420), uint32(1),
            p.jobId, p.manifestHash, p.partitionSchemeId, p.partitionSchemeVersion,
            p.partitionPlanHash, p.partitionCount, p.replicationFactor, p.partitionIndex, p.replicaIndex
        ));
        bytes32 actual = ComputeIds420.workUnitId(420, p);
        require(actual == expected, "unit abi encoding differs");
        require(actual == ComputeIds420.workUnitId(420, p), "unit not stable");
        require(actual != keccak256(abi.encodePacked(uint256(420), p.jobId)), "packed collision");
    }

    function testPartitionReplicaManifestAndChainAreDistinct() public pure {
        ComputeIds420.WorkUnitV1 memory p = _plan();
        bytes32 original = ComputeIds420.workUnitId(420, p);
        p.partitionIndex = 2;
        require(original != ComputeIds420.workUnitId(420, p), "partition reused");
        p = _plan();
        p.replicaIndex = 1;
        require(original != ComputeIds420.workUnitId(420, p), "replica reused");
        p = _plan();
        p.manifestHash = bytes32(uint256(23));
        require(original != ComputeIds420.workUnitId(420, p), "manifest reused");
        p = _plan();
        require(original != ComputeIds420.workUnitId(421, p), "chain reused");
    }

    function testRetriesDoNotChangePayableUnit() public pure {
        bytes32 unit = ComputeIds420.workUnitId(420, _plan());
        bytes32 first = ComputeIds420.attemptId(420, unit, 1);
        bytes32 second = ComputeIds420.attemptId(420, unit, 2);
        bytes32 expected = keccak256(abi.encode(
            keccak256("420Integrated.ComputeMarket.WorkAttempt.v1"), uint256(420), uint32(1), unit, uint64(1)
        ));
        require(first == expected && first != second, "attempt encoding/collision");
        require(unit == ComputeIds420.workUnitId(420, _plan()), "retry changed payable unit");
    }

    function testRejectInvalidWorkUnitInputs() public view {
        ComputeIds420.WorkUnitV1 memory p = _plan();
        _rejectUnit(0, p);
        p.jobId = bytes32(0);
        _rejectUnit(420, p);
        p = _plan(); p.manifestHash = bytes32(0);
        _rejectUnit(420, p);
        p = _plan(); p.partitionSchemeId = bytes32(0);
        _rejectUnit(420, p);
        p = _plan(); p.partitionSchemeVersion = 0;
        _rejectUnit(420, p);
        p = _plan(); p.partitionPlanHash = bytes32(0);
        _rejectUnit(420, p);
        p = _plan(); p.partitionCount = 0;
        _rejectUnit(420, p);
        p = _plan(); p.replicationFactor = 0;
        _rejectUnit(420, p);
        p = _plan(); p.partitionIndex = p.partitionCount;
        _rejectUnit(420, p);
        p = _plan(); p.replicaIndex = p.replicationFactor;
        _rejectUnit(420, p);
    }

    function testRejectInvalidAttemptInputs() public view {
        bytes32 unit = ComputeIds420.workUnitId(420, _plan());
        _rejectAttempt(0, unit, 1);
        _rejectAttempt(420, bytes32(0), 1);
        _rejectAttempt(420, unit, 0);
    }
}
