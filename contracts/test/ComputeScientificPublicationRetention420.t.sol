// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeScientificPublicationRetention420.sol";

contract PublicationLineageMock420 is IComputeScientificMetadataPublicationSource420 {
    mapping(bytes32 => LineageRecord) internal records;
    mapping(bytes32 => bool) internal canonical;

    function systemName() external pure returns (string memory) {
        return "ComputeScientificMetadataLineage420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function set(bytes32 id, LineageRecord memory r, bool ok) external {
        records[id] = r;
        canonical[id] = ok;
    }

    function record(bytes32 id) external view returns (LineageRecord memory r) {
        r = records[id];
        require(r.exists, "missing lineage");
    }

    function isCanonical(bytes32 id) external view returns (bool) {
        return canonical[id];
    }
}

contract PublicationOutsider420 {
    function register(
        ComputeScientificPublicationRetention420 target,
        bytes32 lineageId,
        ComputeScientificPublicationRetention420.Visibility visibility,
        bytes32 accessPolicy,
        bytes32 retentionPolicy,
        bytes32 publicationManifest,
        uint64 notBefore,
        uint64 retainUntil
    ) external returns (bytes32) {
        return target.registerPolicy(
            lineageId,
            visibility,
            accessPolicy,
            retentionPolicy,
            publicationManifest,
            notBefore,
            retainUntil
        );
    }
}

contract ComputeScientificPublicationRetention420Test {
    PublicationLineageMock420 lineage;
    ComputeScientificPublicationRetention420 policy;

    bytes32 constant LINEAGE = keccak256("lineage");
    bytes32 constant ACCESS = keccak256("access-policy");
    bytes32 constant RETENTION = keccak256("retention-policy");
    bytes32 constant MANIFEST = keccak256("publication-manifest");

    function setUp() public {
        lineage = new PublicationLineageMock420();
        policy = new ComputeScientificPublicationRetention420(lineage);
        lineage.set(
            LINEAGE,
            IComputeScientificMetadataPublicationSource420.LineageRecord({
                provenanceId: keccak256("provenance"),
                scientificWorkUnitCommitment: keccak256("scientific-unit"),
                publisher: address(this),
                metadataSchemaCommitment: keccak256("metadata-schema"),
                metadataCommitment: keccak256("metadata"),
                relationCommitment: bytes32(0),
                parentSetCommitment: keccak256("parents"),
                parentCount: 0,
                recordedAt: 1,
                exists: true
            }),
            true
        );
    }

    function testPrivatePolicyIsCanonicalButNotPubliclyAuthorized() public {
        bytes32 id = policy.registerPolicy(
            LINEAGE,
            ComputeScientificPublicationRetention420.Visibility.PRIVATE,
            ACCESS,
            RETENTION,
            bytes32(0),
            0,
            0
        );
        ComputeScientificPublicationRetention420.Policy memory p = policy.policy(id);
        bytes32 exact = policy.commitment(id, 1);
        require(p.lineageId == LINEAGE && p.publisher == address(this), "identity");
        require(p.visibility == ComputeScientificPublicationRetention420.Visibility.PRIVATE, "visibility");
        require(policy.isCurrentPolicy(id, 1, exact), "canonical policy");
        require(!policy.isPublicationAuthorized(id), "private became public");
    }

    function testPublicAndRestrictedPolicyRequirePublicationManifest() public {
        (bool ok,) = address(policy).call(
            abi.encodeCall(
                policy.registerPolicy,
                (
                    LINEAGE,
                    ComputeScientificPublicationRetention420.Visibility.PUBLIC,
                    ACCESS,
                    RETENTION,
                    bytes32(0),
                    uint64(0),
                    uint64(0)
                )
            )
        );
        require(!ok, "public without manifest");

        bytes32 id = policy.registerPolicy(
            LINEAGE,
            ComputeScientificPublicationRetention420.Visibility.RESTRICTED,
            ACCESS,
            RETENTION,
            MANIFEST,
            0,
            0
        );
        require(policy.isPublicationAuthorized(id), "restricted authorization missing");
    }

    function testOutsiderCannotCreatePolicyForCanonicalLineage() public {
        PublicationOutsider420 outsider = new PublicationOutsider420();
        (bool ok,) = address(outsider).call(
            abi.encodeCall(
                outsider.register,
                (
                    policy,
                    LINEAGE,
                    ComputeScientificPublicationRetention420.Visibility.PRIVATE,
                    ACCESS,
                    RETENTION,
                    bytes32(0),
                    uint64(0),
                    uint64(0)
                )
            )
        );
        require(!ok && policy.policyForLineage(LINEAGE) == bytes32(0), "outsider admitted");
    }

    function testRevisionIsAppendOnlyStaleSafeAndNoOpRejected() public {
        bytes32 id = policy.registerPolicy(
            LINEAGE,
            ComputeScientificPublicationRetention420.Visibility.PRIVATE,
            ACCESS,
            RETENTION,
            bytes32(0),
            0,
            0
        );
        bytes32 first = policy.commitment(id, 1);
        policy.revisePolicy(
            id,
            1,
            ComputeScientificPublicationRetention420.Visibility.PUBLIC,
            keccak256("public-access"),
            keccak256("public-retention"),
            MANIFEST,
            0,
            0
        );
        ComputeScientificPublicationRetention420.Policy memory p2 = policy.revision(id, 2);
        require(p2.predecessorCommitment == first, "predecessor");
        require(policy.commitment(id, 1) == first, "history rewritten");

        (bool ok,) = address(policy).call(
            abi.encodeCall(
                policy.revisePolicy,
                (
                    id,
                    uint64(1),
                    ComputeScientificPublicationRetention420.Visibility.PUBLIC,
                    keccak256("x"),
                    keccak256("y"),
                    MANIFEST,
                    uint64(0),
                    uint64(0)
                )
            )
        );
        require(!ok, "stale revision");

        (ok,) = address(policy).call(
            abi.encodeCall(
                policy.revisePolicy,
                (
                    id,
                    uint64(2),
                    ComputeScientificPublicationRetention420.Visibility.PUBLIC,
                    keccak256("public-access"),
                    keccak256("public-retention"),
                    MANIFEST,
                    uint64(0),
                    uint64(0)
                )
            )
        );
        require(!ok, "no-op revision");
    }

    function testEmbargoAndRetentionBoundsFailClosed() public {
        bytes32 futureManifest = keccak256("future-manifest");
        bytes32 id = policy.registerPolicy(
            LINEAGE,
            ComputeScientificPublicationRetention420.Visibility.PUBLIC,
            ACCESS,
            RETENTION,
            futureManifest,
            uint64(block.timestamp + 100),
            uint64(block.timestamp + 200)
        );
        require(!policy.isPublicationAuthorized(id), "embargo ignored");

        bytes32 secondLineage = keccak256("lineage-2");
        IComputeScientificMetadataPublicationSource420.LineageRecord memory r = lineage.record(LINEAGE);
        r.provenanceId = keccak256("provenance-2");
        lineage.set(secondLineage, r, true);
        (bool ok,) = address(policy).call(
            abi.encodeCall(
                policy.registerPolicy,
                (
                    secondLineage,
                    ComputeScientificPublicationRetention420.Visibility.PUBLIC,
                    ACCESS,
                    RETENTION,
                    MANIFEST,
                    uint64(block.timestamp + 100),
                    uint64(block.timestamp + 50)
                )
            )
        );
        require(!ok, "retention before embargo");
    }

    function testLineageDriftAndDeactivationFailClosed() public {
        bytes32 id = policy.registerPolicy(
            LINEAGE,
            ComputeScientificPublicationRetention420.Visibility.PUBLIC,
            ACCESS,
            RETENTION,
            MANIFEST,
            0,
            0
        );
        require(policy.isPublicationAuthorized(id), "public not authorized");

        IComputeScientificMetadataPublicationSource420.LineageRecord memory r = lineage.record(LINEAGE);
        lineage.set(LINEAGE, r, false);
        require(!policy.isPublicationAuthorized(id), "lineage drift ignored");
        require(!policy.isCurrentPolicy(id, 1, policy.commitment(id, 1)), "drift canonical");

        lineage.set(LINEAGE, r, true);
        policy.setActive(id, 1, false);
        require(!policy.isPublicationAuthorized(id), "inactive authorized");
    }

    function testPolicyCreatesNoStorageDeletionCorrectnessOrEconomicAuthority() public {
        bytes32 id = policy.registerPolicy(
            LINEAGE,
            ComputeScientificPublicationRetention420.Visibility.RESTRICTED,
            ACCESS,
            RETENTION,
            MANIFEST,
            0,
            0
        );
        ComputeScientificPublicationRetention420.Policy memory p = policy.policy(id);
        require(p.accessPolicyCommitment == ACCESS, "access");
        require(p.retentionPolicyCommitment == RETENTION, "retention");
        require(address(policy.lineageRegistry()) == address(lineage), "source");
    }
}
