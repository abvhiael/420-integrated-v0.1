// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/system/SystemAccess.sol";
import "../src/interfaces/I420IS.sol";
import "../src/interop/InteropProviderRegistry420.sol";
import "../src/interop/InteropNamespaceRegistry420.sol";
import "../src/interop/InteropCheckpointRegistry420.sol";
import "../src/interop/InteropRouter420.sol";

interface VmInteropAudit420 {
    function prank(
        address
    ) external;
    function expectRevert(
        bytes4
    ) external;
}

contract InteropAuditAdapter420 is I420ISAdapter {
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

    function publish(
        InteropNamespaceRegistry420 registry,
        uint64 sequence,
        bytes32 stateHash,
        bytes32 previousHash
    ) external returns (bytes32) {
        return registry.publishCheckpoint(providerId, domainId, sequence, stateHash, previousHash);
    }
}

contract InteropWrongVersionAdapter420 is I420ISAdapter {
    function standardVersion() external pure override returns (uint32) {
        return 2;
    }

    function adapterType() external pure override returns (bytes32) {
        return keccak256("wrong/type");
    }

    function supportsDomain(
        bytes32
    ) external pure override returns (bool) {
        return true;
    }

    function adapterManifestHash() external pure override returns (bytes32) {
        return keccak256("wrong/manifest");
    }
}

contract InteropAudit420Test {
    VmInteropAudit420 constant vm = VmInteropAudit420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ALICE = address(0xA11CE);
    bytes32 constant PROVIDER = keccak256("provider/audit");
        require(router.providerSupports(PROVIDER, DOMAIN), "domain support");
    }
}
