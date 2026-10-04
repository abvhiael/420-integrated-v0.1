// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/system/SystemAccess.sol";
import "../src/interop/InteropIds420.sol";
import "../src/interfaces/I420IS.sol";
import "../src/interop/InteropProviderRegistry420.sol";
import "../src/interop/InteropNamespaceRegistry420.sol";
import "../src/interop/InteropCheckpointRegistry420.sol";
import "../src/interop/InteropRouter420.sol";

interface VmInterop420 {
    function prank(
        address
    ) external;
    function expectRevert(
        bytes4
    ) external;
}

contract MockInteropAdapter420 is I420ISAdapter {
    bytes32 public immutable kind;
    bytes32 public immutable manifest;
    mapping(bytes32 => bool) public supported;

    constructor(
        bytes32 kind_,
        bytes32 manifest_
    ) {
        kind = kind_;
        manifest = manifest_;
    }

    function standardVersion() external pure override returns (uint32) {
        return 1;
    }

    function adapterType() external view override returns (bytes32) {
        return kind;
    }

    function supportsDomain(
        bytes32 domainId
    ) external view override returns (bool) {
        return supported[domainId];
    }

    function adapterManifestHash() external view override returns (bytes32) {
        return manifest;
    }

    function setSupported(
        bytes32 domainId,
        bool value
    ) external {
        supported[domainId] = value;
    }

    function map(
        InteropNamespaceRegistry420 registry,
        bytes32 ns,
        bytes32 externalHash,
        bytes32 canonicalId,
        bytes32 attestation
    ) external returns (bytes32) {
        return registry.publishMapping(ns, externalHash, canonicalId, attestation);
    }

    function supersede(
        InteropNamespaceRegistry420 registry,
        bytes32 ns,
        bytes32 externalHash,
        uint64 oldRevision,
        bytes32 canonicalId,
        bytes32 attestation
    ) external returns (bytes32) {
        return registry.supersedeMapping(ns, externalHash, oldRevision, canonicalId, attestation);
    }

    function checkpoint(
        InteropCheckpointRegistry420 registry,
        bytes32 providerId,
        bytes32 domainId,
        uint64 sequence,
        bytes32 stateHash,
        bytes32 previousHash
    ) external returns (bytes32) {
        return registry.publishCheckpoint(providerId, domainId, sequence, stateHash, previousHash);
    }
}