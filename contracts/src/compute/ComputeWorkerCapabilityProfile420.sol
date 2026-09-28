// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ComputeWorkerRegistry420.sol";

/// @notice Canonical bounded capability detail for one exact ComputeMarket worker revision.
/// @dev Profiles are self-reported claims unless an admission path separately requires trusted
///      CMP-1.3.2 attestation. This registry grants no custody, verifier, staking or settlement authority.
contract ComputeWorkerCapabilityProfile420 is I420System {
    bytes32 public constant PROFILE_DOMAIN_V1 =
        keccak256("420Integrated.ComputeMarket.WorkerCapabilityProfile.v1");
    uint256 public constant MAX_SET_ENTRIES = 16;

    struct ProfileInput {
        bytes32[] architectures;
        bytes32[] cpuClasses;
        bytes32[] gpuClasses;
        bytes32[] softwareCapabilities;
        uint64 vramMiB;
        uint64 memoryMiB;
        uint64 storageGiB;
        uint64 networkMbps;
        bytes32 storageClassHash;
        bytes32 networkCapabilityHash;
        bytes32 runtimeCapabilityHash;
    }

    struct ProfileMeta {
        bytes32 profileHash;
        uint64 vramMiB;
        uint64 memoryMiB;
        uint64 storageGiB;
        uint64 networkMbps;
        bytes32 storageClassHash;
        bytes32 networkCapabilityHash;
        bytes32 runtimeCapabilityHash;
        bool exists;
    }

    struct Requirements {
        bytes32 requiredResourceComputeClass;
        bytes32 requiredArchitecture;
        bytes32 requiredCpuClass;
        bytes32 requiredGpuClass;
        bytes32 requiredSoftwareCapability;
        uint64 minVramMiB;
        uint64 minMemoryMiB;
        uint64 minStorageGiB;
        uint64 minNetworkMbps;
        bytes32 requiredStorageClassHash;
        bytes32 requiredNetworkCapabilityHash;
        bytes32 requiredRuntimeCapabilityHash;
    }

    ComputeWorkerRegistry420 public immutable workers;
    ComputeResourceRegistry420 public immutable resources;

    mapping(bytes32 => mapping(uint64 => ProfileMeta)) private _profiles;
    mapping(bytes32 => mapping(uint64 => bytes32[])) private _architectures;
    mapping(bytes32 => mapping(uint64 => bytes32[])) private _cpuClasses;
    mapping(bytes32 => mapping(uint64 => bytes32[])) private _gpuClasses;
    mapping(bytes32 => mapping(uint64 => bytes32[])) private _softwareCapabilities;

    error InvalidConfiguration();
    error InvalidProfile();
    error UnauthorizedOperator();
    error ProfileAlreadyPublished();

    event CapabilityProfilePublished(
        bytes32 indexed workerId,
        uint64 indexed workerRevision,
        bytes32 indexed profileHash
    );

    constructor(address workerRegistry_) {
        if (workerRegistry_ == address(0) || workerRegistry_.code.length == 0) {
            revert InvalidConfiguration();
        }
        workers = ComputeWorkerRegistry420(workerRegistry_);
        resources = workers.resources();
    }

    function systemName() external pure returns (string memory) {
        return "ComputeWorkerCapabilityProfile420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function profileCommitment(ProfileInput memory p) public pure returns (bytes32) {
        _validateInput(p);
        return keccak256(
            abi.encode(
                PROFILE_DOMAIN_V1,
                p.architectures,
                p.cpuClasses,
                p.gpuClasses,
                p.softwareCapabilities,
                p.vramMiB,
                p.memoryMiB,
                p.storageGiB,
                p.networkMbps,
                p.storageClassHash,
                p.networkCapabilityHash,
                p.runtimeCapabilityHash
            )
        );
    }

    /// @notice Publishes the bounded preimage of the worker's already-authorized capabilityProfileHash.
    /// @dev Publishing cannot change worker identity or claims: the exact commitment must already be
    ///      present in the referenced worker revision.
    function publish(bytes32 workerId, uint64 workerRevision, ProfileInput calldata p)
        external
        returns (bytes32 profileHash)
    {
        ComputeWorkerRegistry420.Worker memory w = workers.revision(workerId, workerRevision);
        if (msg.sender != w.operator) revert UnauthorizedOperator();
        if (_profiles[workerId][workerRevision].exists) revert ProfileAlreadyPublished();

        ProfileInput memory copy = p;
        profileHash = profileCommitment(copy);
        if (profileHash != w.capabilityProfileHash) revert InvalidProfile();

        _profiles[workerId][workerRevision] = ProfileMeta({
            profileHash: profileHash,
            vramMiB: p.vramMiB,
            memoryMiB: p.memoryMiB,
            storageGiB: p.storageGiB,
            networkMbps: p.networkMbps,
            storageClassHash: p.storageClassHash,
            networkCapabilityHash: p.networkCapabilityHash,
            runtimeCapabilityHash: p.runtimeCapabilityHash,
            exists: true
        });

        _copySet(_architectures[workerId][workerRevision], p.architectures);
        _copySet(_cpuClasses[workerId][workerRevision], p.cpuClasses);
        _copySet(_gpuClasses[workerId][workerRevision], p.gpuClasses);
        _copySet(_softwareCapabilities[workerId][workerRevision], p.softwareCapabilities);

        emit CapabilityProfilePublished(workerId, workerRevision, profileHash);
    }

    function profile(bytes32 workerId, uint64 workerRevision) external view returns (ProfileMeta memory p) {
        p = _profiles[workerId][workerRevision];
        if (!p.exists) revert InvalidProfile();
    }

    function architectures(bytes32 workerId, uint64 workerRevision) external view returns (bytes32[] memory) {
        return _architectures[workerId][workerRevision];
    }

    function cpuClasses(bytes32 workerId, uint64 workerRevision) external view returns (bytes32[] memory) {
        return _cpuClasses[workerId][workerRevision];
    }

    function gpuClasses(bytes32 workerId, uint64 workerRevision) external view returns (bytes32[] memory) {
        return _gpuClasses[workerId][workerRevision];
    }

    function softwareCapabilities(bytes32 workerId, uint64 workerRevision)
        external
        view
        returns (bytes32[] memory)
    {
        return _softwareCapabilities[workerId][workerRevision];
    }

    /// @notice Fail-closed NEW-admission capability predicate for one exact current worker revision.
    /// @dev This proves only that the published self-report satisfies requested predicates.
    ///      Trusted-hardware admission must additionally compose CMP-1.3.2 attestation.
    function matches(bytes32 workerId, uint64 workerRevision, Requirements calldata r)
        external
        view
        returns (bool)
    {
        if (!workers.isEligible(workerId, workerRevision)) return false;

        ProfileMeta storage p = _profiles[workerId][workerRevision];
        if (!p.exists) return false;

        ComputeWorkerRegistry420.Worker memory w = workers.worker(workerId);
        if (p.profileHash != w.capabilityProfileHash) return false;

        if (r.requiredResourceComputeClass != bytes32(0)) {
            ComputeResourceRegistry420.Resource memory resource = resources.resource(w.resourceId);
            if (resource.revision != w.resourceRevision || resource.computeClass != r.requiredResourceComputeClass) {
                return false;
            }
        }

        if (r.requiredArchitecture != bytes32(0)
            && !_contains(_architectures[workerId][workerRevision], r.requiredArchitecture)) return false;
        if (r.requiredCpuClass != bytes32(0)
            && !_contains(_cpuClasses[workerId][workerRevision], r.requiredCpuClass)) return false;
        if (r.requiredGpuClass != bytes32(0)
            && !_contains(_gpuClasses[workerId][workerRevision], r.requiredGpuClass)) return false;
        if (r.requiredSoftwareCapability != bytes32(0)
            && !_contains(_softwareCapabilities[workerId][workerRevision], r.requiredSoftwareCapability)) return false;

        if (
            p.vramMiB < r.minVramMiB
                || p.memoryMiB < r.minMemoryMiB
                || p.storageGiB < r.minStorageGiB
                || p.networkMbps < r.minNetworkMbps
        ) return false;

        if (r.requiredStorageClassHash != bytes32(0) && p.storageClassHash != r.requiredStorageClassHash) {
            return false;
        }
        if (
            r.requiredNetworkCapabilityHash != bytes32(0)
                && p.networkCapabilityHash != r.requiredNetworkCapabilityHash
        ) return false;
        if (
            r.requiredRuntimeCapabilityHash != bytes32(0)
                && p.runtimeCapabilityHash != r.requiredRuntimeCapabilityHash
        ) return false;

        return true;
    }

    function _validateInput(ProfileInput memory p) private pure {
        if (
            !_validSortedSet(p.architectures, false)
                || !_validSortedSet(p.cpuClasses, true)
                || !_validSortedSet(p.gpuClasses, true)
                || !_validSortedSet(p.softwareCapabilities, false)
                || (p.cpuClasses.length == 0 && p.gpuClasses.length == 0)
                || p.memoryMiB == 0
                || p.storageGiB == 0
                || p.networkMbps == 0
                || p.storageClassHash == bytes32(0)
                || p.networkCapabilityHash == bytes32(0)
                || p.runtimeCapabilityHash == bytes32(0)
        ) revert InvalidProfile();
    }

    function _validSortedSet(bytes32[] memory values, bool allowEmpty) private pure returns (bool) {
        if (values.length == 0) return allowEmpty;
        if (values.length > MAX_SET_ENTRIES || values[0] == bytes32(0)) return false;
        for (uint256 i = 1; i < values.length; ++i) {
            if (values[i] == bytes32(0) || uint256(values[i - 1]) >= uint256(values[i])) return false;
        }
        return true;
    }

    function _copySet(bytes32[] storage target, bytes32[] calldata source) private {
        for (uint256 i = 0; i < source.length; ++i) {
            target.push(source[i]);
        }
    }

    function _contains(bytes32[] storage values, bytes32 needle) private view returns (bool) {
        for (uint256 i = 0; i < values.length; ++i) {
            if (values[i] == needle) return true;
        }
        return false;
    }
}
