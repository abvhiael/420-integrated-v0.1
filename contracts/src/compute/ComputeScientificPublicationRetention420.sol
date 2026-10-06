// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";

interface IComputeScientificMetadataPublicationSource420 {
    struct LineageRecord {
        bytes32 provenanceId;
        bytes32 scientificWorkUnitCommitment;
        address publisher;
        bytes32 metadataSchemaCommitment;
        bytes32 metadataCommitment;
        bytes32 relationCommitment;
        bytes32 parentSetCommitment;
        uint32 parentCount;
        uint64 recordedAt;
        bool exists;
    }

    function systemName() external view returns (string memory);
    function protocolVersion() external view returns (uint32);
    function record(bytes32 lineageId) external view returns (LineageRecord memory);
    function isCanonical(bytes32 lineageId) external view returns (bool);
}

/// @notice CMP-4.8 versioned publication/retention policy over canonical CMP-4.7 lineage.
/// @dev Declares authorization commitments only. Raw metadata/results remain off-chain and this
/// contract cannot erase, retrieve, publish, custody or grant access to those bytes.
contract ComputeScientificPublicationRetention420 is I420System {
    bytes32 public constant POLICY_ID_DOMAIN =
        keccak256("420/COMPUTE/SCIENTIFIC_PUBLICATION_RETENTION_ID/V1");
    bytes32 public constant POLICY_COMMITMENT_DOMAIN =
        keccak256("420/COMPUTE/SCIENTIFIC_PUBLICATION_RETENTION_COMMITMENT/V1");

    enum Visibility { NONE, PRIVATE, RESTRICTED, PUBLIC }

    struct Policy {
        bytes32 lineageId;
        address publisher;
        Visibility visibility;
        bytes32 accessPolicyCommitment;
        bytes32 retentionPolicyCommitment;
        bytes32 publicationManifestCommitment;
        bytes32 predecessorCommitment;
        uint64 notBefore;
        uint64 retainUntil;
        uint64 revision;
        bool active;
    }

    IComputeScientificMetadataPublicationSource420 public immutable lineageRegistry;

    mapping(bytes32 => Policy) private _policies;
    mapping(bytes32 => mapping(uint64 => Policy)) private _history;
    mapping(bytes32 => bytes32) public policyForLineage;

    error InvalidSource();
    error InvalidPolicy();
    error UnknownPolicy();
    error Unauthorized();
    error StaleRevision();
    error NoChange();

    event PublicationRetentionPolicyRegistered(
        bytes32 indexed policyId,
        bytes32 indexed lineageId,
        address indexed publisher,
        uint64 revision,
        bytes32 policyCommitment
    );
    event PublicationRetentionPolicyRevised(
        bytes32 indexed policyId,
        uint64 indexed previousRevision,
        uint64 indexed currentRevision,
        bytes32 policyCommitment
    );
    event PublicationRetentionPolicyActivationSet(
        bytes32 indexed policyId,
        bool active,
        uint64 revision,
        bytes32 policyCommitment
    );

    constructor(IComputeScientificMetadataPublicationSource420 lineageRegistry_) {
        address lineageAddress = address(lineageRegistry_);
        if (lineageAddress == address(0) || lineageAddress.code.length == 0) revert InvalidSource();
        if (
            keccak256(bytes(lineageRegistry_.systemName()))
                != keccak256(bytes("ComputeScientificMetadataLineage420"))
                || lineageRegistry_.protocolVersion() != 1
        ) revert InvalidSource();
        lineageRegistry = lineageRegistry_;
    }

    function systemName() external pure returns (string memory) {
        return "ComputeScientificPublicationRetention420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function registerPolicy(
        bytes32 lineageId,
        Visibility visibility,
        bytes32 accessPolicyCommitment,
        bytes32 retentionPolicyCommitment,
        bytes32 publicationManifestCommitment,
        uint64 notBefore,
        uint64 retainUntil
    ) external returns (bytes32 policyId) {
        IComputeScientificMetadataPublicationSource420.LineageRecord memory l =
            _requireCanonicalPublisher(lineageId, msg.sender);
        if (policyForLineage[lineageId] != bytes32(0)) revert InvalidPolicy();
        _validatePolicy(
            visibility,
            accessPolicyCommitment,
            retentionPolicyCommitment,
            publicationManifestCommitment,
            notBefore,
            retainUntil
        );

        policyId = keccak256(
            abi.encode(
                POLICY_ID_DOMAIN,
                block.chainid,
                address(this),
                address(lineageRegistry),
                lineageId,
                l.provenanceId,
                l.scientificWorkUnitCommitment,
                msg.sender
            )
        );
        if (_policies[policyId].revision != 0) revert InvalidPolicy();

        Policy memory p = Policy({
            lineageId: lineageId,
            publisher: msg.sender,
            visibility: visibility,
            accessPolicyCommitment: accessPolicyCommitment,
            retentionPolicyCommitment: retentionPolicyCommitment,
            publicationManifestCommitment: publicationManifestCommitment,
            predecessorCommitment: bytes32(0),
            notBefore: notBefore,
            retainUntil: retainUntil,
            revision: 1,
            active: true
        });
        _policies[policyId] = p;
        _history[policyId][1] = p;
        policyForLineage[lineageId] = policyId;

        emit PublicationRetentionPolicyRegistered(
            policyId, lineageId, msg.sender, 1, _commitment(policyId, p)
        );
    }

    function revisePolicy(
        bytes32 policyId,
        uint64 expectedRevision,
        Visibility visibility,
        bytes32 accessPolicyCommitment,
        bytes32 retentionPolicyCommitment,
        bytes32 publicationManifestCommitment,
        uint64 notBefore,
        uint64 retainUntil
    ) external {
        Policy storage p = _guardPublisher(policyId, expectedRevision);
        _validatePolicy(
            visibility,
            accessPolicyCommitment,
            retentionPolicyCommitment,
            publicationManifestCommitment,
            notBefore,
            retainUntil
        );
        if (
            p.visibility == visibility
                && p.accessPolicyCommitment == accessPolicyCommitment
                && p.retentionPolicyCommitment == retentionPolicyCommitment
                && p.publicationManifestCommitment == publicationManifestCommitment
                && p.notBefore == notBefore
                && p.retainUntil == retainUntil
        ) revert NoChange();

        uint64 previousRevision = p.revision;
        bytes32 predecessor = _commitment(policyId, p);
        p.visibility = visibility;
        p.accessPolicyCommitment = accessPolicyCommitment;
        p.retentionPolicyCommitment = retentionPolicyCommitment;
        p.publicationManifestCommitment = publicationManifestCommitment;
        p.predecessorCommitment = predecessor;
        p.notBefore = notBefore;
        p.retainUntil = retainUntil;
        p.revision = previousRevision + 1;
        _history[policyId][p.revision] = p;

        emit PublicationRetentionPolicyRevised(
            policyId, previousRevision, p.revision, _commitment(policyId, p)
        );
    }

    function setActive(bytes32 policyId, uint64 expectedRevision, bool active) external {
        Policy storage p = _guardPublisher(policyId, expectedRevision);
        if (p.active == active) revert NoChange();
        if (active && !lineageRegistry.isCanonical(p.lineageId)) revert InvalidPolicy();

        bytes32 predecessor = _commitment(policyId, p);
        p.active = active;
        p.predecessorCommitment = predecessor;
        p.revision += 1;
        _history[policyId][p.revision] = p;

        emit PublicationRetentionPolicyActivationSet(
            policyId, active, p.revision, _commitment(policyId, p)
        );
    }

    function policy(bytes32 policyId) external view returns (Policy memory p) {
        p = _policies[policyId];
        if (p.revision == 0) revert UnknownPolicy();
    }

    function revision(bytes32 policyId, uint64 revision_) external view returns (Policy memory p) {
        p = _history[policyId][revision_];
        if (p.revision == 0) revert UnknownPolicy();
    }

    function commitment(bytes32 policyId, uint64 revision_) public view returns (bytes32) {
        Policy memory p = _history[policyId][revision_];
        if (p.revision == 0) revert UnknownPolicy();
        return _commitment(policyId, p);
    }

    function currentCommitment(bytes32 policyId) external view returns (bytes32) {
        Policy memory p = _policies[policyId];
        if (p.revision == 0) revert UnknownPolicy();
        return _commitment(policyId, p);
    }

    function isCurrentPolicy(bytes32 policyId, uint64 revision_, bytes32 exactCommitment)
        external view returns (bool)
    {
        Policy memory p = _policies[policyId];
        return p.revision != 0
            && p.active
            && p.revision == revision_
            && exactCommitment != bytes32(0)
            && exactCommitment == _commitment(policyId, p)
            && lineageRegistry.isCanonical(p.lineageId);
    }

    function isPublicationAuthorized(bytes32 policyId) external view returns (bool) {
        Policy memory p = _policies[policyId];
        if (
            p.revision == 0 || !p.active || p.visibility == Visibility.PRIVATE
                || !lineageRegistry.isCanonical(p.lineageId)
        ) return false;
        if (p.notBefore != 0 && block.timestamp < p.notBefore) return false;
        if (p.retainUntil != 0 && block.timestamp >= p.retainUntil) return false;
        return true;
    }

    function _guardPublisher(bytes32 policyId, uint64 expectedRevision)
        private view returns (Policy storage p)
    {
        p = _policies[policyId];
        if (p.revision == 0) revert UnknownPolicy();
        if (p.revision != expectedRevision) revert StaleRevision();
        if (p.publisher != msg.sender) revert Unauthorized();
        IComputeScientificMetadataPublicationSource420.LineageRecord memory l =
            _requireCanonicalPublisher(p.lineageId, msg.sender);
        if (l.publisher != p.publisher) revert Unauthorized();
    }

    function _requireCanonicalPublisher(bytes32 lineageId, address actor)
        private view returns (IComputeScientificMetadataPublicationSource420.LineageRecord memory l)
    {
        if (lineageId == bytes32(0) || !lineageRegistry.isCanonical(lineageId))
            revert InvalidPolicy();
        l = lineageRegistry.record(lineageId);
        if (!l.exists || l.publisher == address(0) || l.publisher != actor) revert Unauthorized();
    }

    function _validatePolicy(
        Visibility visibility,
        bytes32 accessPolicyCommitment,
        bytes32 retentionPolicyCommitment,
        bytes32 publicationManifestCommitment,
        uint64 notBefore,
        uint64 retainUntil
    ) private view {
        if (
            visibility == Visibility.NONE
                || accessPolicyCommitment == bytes32(0)
                || retentionPolicyCommitment == bytes32(0)
        ) revert InvalidPolicy();

        if (visibility == Visibility.PRIVATE) {
            if (publicationManifestCommitment != bytes32(0) || notBefore != 0)
                revert InvalidPolicy();
        } else if (publicationManifestCommitment == bytes32(0)) {
            revert InvalidPolicy();
        }

        if (
            retainUntil != 0
                && (
                    retainUntil <= block.timestamp
                        || (notBefore != 0 && retainUntil <= notBefore)
                )
        ) revert InvalidPolicy();
    }

    function _commitment(bytes32 policyId, Policy memory p) private view returns (bytes32) {
        return keccak256(
            abi.encode(
                POLICY_COMMITMENT_DOMAIN,
                block.chainid,
                address(this),
                address(lineageRegistry),
                policyId,
                p.lineageId,
                p.publisher,
                p.visibility,
                p.accessPolicyCommitment,
                p.retentionPolicyCommitment,
                p.publicationManifestCommitment,
                p.predecessorCommitment,
                p.notBefore,
                p.retainUntil,
                p.revision,
                p.active
            )
        );
    }
}
