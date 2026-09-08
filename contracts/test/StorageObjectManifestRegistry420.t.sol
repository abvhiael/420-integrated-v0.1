// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/resource/ResourceAuthorization420.sol";
import "../src/resource/ResourceIds420.sol";
import "../src/resource/ResourceNodeRegistry420.sol";
import "../src/resource/ResourceOfferRegistry420.sol";
import "../src/resource/ResourcePolicyRegistry420.sol";
import "../src/resource/ResourceProviderRegistry420.sol";
import "../src/resource/StorageAgreementRegistry420.sol";
import "../src/resource/StorageCapacityRegistry420.sol";
import "../src/resource/StorageCommitmentRegistry420.sol";
import "../src/resource/StorageObjectManifestRegistry420.sol";
import "../src/resource/StorageProofIds420.sol";
import "../src/resource/StorageProofSchemeRegistry420.sol";
import "../src/resource/IStorageProofVerifier420.sol";

interface VmStorageManifest420 { function prank(address) external; function warp(uint256) external; }

contract MockStorageManifestCaps420 is ICapabilityRegistry420 {
    mapping(bytes32 => bool) internal ok;
    function key(address p, bytes32 c, bytes32 a, bytes32 s) public pure returns (bytes32) { return keccak256(abi.encode(p,c,a,s)); }
    function set(address p, bytes32 c, bytes32 a, bytes32 s, bool v) external { ok[key(p,c,a,s)] = v; }
    function grant(bytes32) external pure returns (CapabilityGrant memory g) { return g; }
    function isAuthorized(address p, bytes32 c, bytes32 a, bytes32 s, uint256) external view returns (bool) { return ok[key(p,c,a,s)]; }
}

contract MockStorageManifestVerifier420 is IStorageProofVerifier420 {
    function verifyStorageProof(bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,uint64,bytes calldata) external pure returns (bool) { return true; }
}

contract StorageObjectManifestRegistry420Test {
    VmStorageManifest420 constant vm = VmStorageManifest420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant PROVIDER = address(0xA11CE);
    address constant CONSUMER = address(0xB0B);
    address constant GOVERNOR = address(0x420420);

    struct Env {
        MockStorageManifestCaps420 caps;
        ResourceAuthorization420 auth;
        ResourceProviderRegistry420 providers;
        ResourceNodeRegistry420 nodes;
        ResourcePolicyRegistry420 policy;
        ResourceOfferRegistry420 offers;
        MockStorageManifestVerifier420 verifier;
        StorageProofSchemeRegistry420 schemes;
        StorageCommitmentRegistry420 commitments;
        StorageCapacityRegistry420 capacity;
        StorageAgreementRegistry420 agreements;
        StorageObjectManifestRegistry420 manifests;
        bytes32 providerId;
        bytes32 nodeId;
        bytes32 offerId;
        bytes32 schemeId;
        bytes32 objectId;
        bytes32 manifestHash;
    }

    function setup() internal returns (Env memory e) {
        e.caps = new MockStorageManifestCaps420();
        e.auth = new ResourceAuthorization420(address(e.caps));
        e.providers = new ResourceProviderRegistry420(address(e.auth));
        e.nodes = new ResourceNodeRegistry420(address(e.auth), address(e.providers));
        e.policy = new ResourcePolicyRegistry420(address(this));
        e.offers = new ResourceOfferRegistry420(address(e.nodes), address(e.providers), address(e.policy), address(e.auth));
        e.verifier = new MockStorageManifestVerifier420();
        e.schemes = new StorageProofSchemeRegistry420(address(e.auth));
        e.commitments = new StorageCommitmentRegistry420(address(e.auth), address(e.providers), address(e.nodes), address(e.schemes));
        e.capacity = new StorageCapacityRegistry420(address(e.auth), address(e.nodes), address(e.providers));
        e.agreements = new StorageAgreementRegistry420(address(e.auth), address(e.offers), address(e.nodes), address(e.providers), address(e.schemes), address(e.commitments), address(e.capacity));
        e.manifests = new StorageObjectManifestRegistry420(address(e.agreements), address(e.commitments));

        e.providerId = keccak256("manifest-provider");
        e.nodeId = keccak256("manifest-store-node");
        e.offerId = keccak256("manifest-store-offer");
        e.schemeId = keccak256("manifest-proof-scheme");
        e.objectId = keccak256("object-1");
        e.manifestHash = keccak256("manifest-v1");

        vm.prank(PROVIDER); e.providers.registerProvider(e.providerId, PROVIDER, keccak256("provider-meta"), keccak256("stake"));
        vm.prank(PROVIDER); e.providers.setState(e.providerId, ResourceProviderRegistry420.State.ACTIVE);
        vm.prank(PROVIDER); e.nodes.registerNode(e.nodeId, e.providerId, ResourceIds420.SERVICE_STORE, PROVIDER, keccak256("endpoint"), keccak256("capacity"));
        vm.prank(PROVIDER); e.nodes.setState(e.nodeId, ResourceNodeRegistry420.State.ACTIVE);
        vm.prank(PROVIDER); e.capacity.configureCapacity(e.nodeId, 10_000_000, keccak256("capacity-meta"));
        e.policy.setPolicy(ResourceIds420.SERVICE_STORE, keccak256("terms"), 30 days, type(uint128).max, true);
        vm.prank(PROVIDER); e.offers.publishOffer(e.offerId, e.nodeId, 42, type(uint128).max, keccak256("offer-terms"), uint64(block.timestamp + 30 days));
        e.caps.set(GOVERNOR, ResourceIds420.COMPONENT_RESOURCE, StorageProofIds420.ACTION_REGISTER_PROOF_SCHEME, e.auth.scopeProofScheme(e.schemeId), true);
        vm.prank(GOVERNOR); e.schemes.registerScheme(e.schemeId, address(e.verifier), StorageProofIds420.PROOF_AVAILABILITY_WINDOW, keccak256("proof-spec"), 300);
    }

    function activateAgreement(Env memory e, uint256 nonce) internal returns (bytes32 agreementId, uint64 startTime, uint64 endTime) {
        startTime = uint64(block.timestamp + 600);
        endTime = uint64(block.timestamp + 1 days);
        vm.prank(CONSUMER);
        agreementId = e.agreements.proposeAgreement(
            e.offerId, e.objectId, keccak256("agreement-content-root"), e.manifestHash,
            keccak256("standard"), keccak256("repair"), e.schemeId, 1_048_576,
            startTime, endTime, 300, 1, 1, nonce
        );
        bytes32 commitmentId = keccak256(abi.encode("commitment", nonce));
        vm.prank(PROVIDER);
        e.commitments.registerCommitment(commitmentId, e.nodeId, e.schemeId, keccak256("agreement-content-root"), keccak256("replica-root"), 1_048_576, startTime, endTime, keccak256("commitment-meta"));
        vm.prank(PROVIDER);
        bytes32 reservationId = e.capacity.reserveCapacity(e.nodeId, agreementId, 1_048_576, endTime);
        vm.prank(PROVIDER);
        e.agreements.activateAgreement(agreementId, commitmentId, reservationId);
    }

    function registerManifest(Env memory e) internal returns (bytes32 manifestId) {
        vm.prank(CONSUMER);
        manifestId = e.manifests.registerManifest(
            e.objectId, keccak256("object-content-root"), e.manifestHash,
            keccak256("encryption-commitment"), keccak256("erasure-root"),
            1_048_576, 1, 1, 1
        );
    }

    function testControllerRegistersCanonicalManifest() public {
        Env memory e = setup();
        bytes32 manifestId = registerManifest(e);
        StorageObjectManifestRegistry420.Manifest memory manifest = e.manifests.getManifest(manifestId);
        require(manifest.controller == CONSUMER, "controller");
        require(manifest.objectId == e.objectId, "object");
        require(manifest.manifestHash == e.manifestHash, "manifest hash");
        require(manifest.dataShards == 1 && manifest.totalShards == 1, "policy");
        require(manifestId == e.manifests.canonicalManifestId(CONSUMER, e.objectId, e.manifestHash), "canonical id");
    }

    function testPlacementBindsActiveAgreementAndCommitment() public {
        Env memory e = setup();
        (bytes32 agreementId,,) = activateAgreement(e, 1);
        bytes32 manifestId = registerManifest(e);
        vm.prank(CONSUMER);
        bytes32 placementId = e.manifests.registerPlacement(manifestId, 0, agreementId, keccak256("shard-root"), 1_048_576);
        StorageObjectManifestRegistry420.Placement memory placement = e.manifests.getPlacement(placementId);
        StorageAgreementRegistry420.Agreement memory agreement = e.agreements.getAgreement(agreementId);
        require(placement.agreementId == agreementId, "agreement");
        require(placement.commitmentId == agreement.commitmentId, "commitment");
        require(placement.nodeId == e.nodeId, "node");
        require(placement.shardIndex == 0, "index");
    }

    function testDuplicateShardIndexFailsClosed() public {
        Env memory e = setup();
        (bytes32 agreementId,,) = activateAgreement(e, 2);
        bytes32 manifestId = registerManifest(e);
        vm.prank(CONSUMER); e.manifests.registerPlacement(manifestId, 0, agreementId, keccak256("shard-root"), 1000);
        vm.prank(CONSUMER);
        (bool ok,) = address(e.manifests).call(abi.encodeWithSelector(e.manifests.registerPlacement.selector, manifestId, uint32(0), agreementId, keccak256("other-shard"), uint128(1000)));
        require(!ok, "duplicate shard accepted");
    }

    function testForeignControllerCannotPlaceShard() public {
        Env memory e = setup();
        (bytes32 agreementId,,) = activateAgreement(e, 3);
        bytes32 manifestId = registerManifest(e);
        vm.prank(PROVIDER);
        (bool ok,) = address(e.manifests).call(abi.encodeWithSelector(e.manifests.registerPlacement.selector, manifestId, uint32(0), agreementId, keccak256("shard-root"), uint128(1000)));
        require(!ok, "foreign placement accepted");
    }

    function testSealRequiresAllPlacementsAndMakesManifestRetrievable() public {
        Env memory e = setup();
        (bytes32 agreementId, uint64 startTime,) = activateAgreement(e, 4);
        bytes32 manifestId = registerManifest(e);
        vm.prank(CONSUMER);
        (bool early,) = address(e.manifests).call(abi.encodeWithSelector(e.manifests.sealManifest.selector, manifestId));
        require(!early, "incomplete manifest sealed");

        vm.prank(CONSUMER); e.manifests.registerPlacement(manifestId, 0, agreementId, keccak256("shard-root"), 1_048_576);
        vm.prank(CONSUMER); e.manifests.sealManifest(manifestId);
        require(e.manifests.getManifest(manifestId).sealed, "not sealed");
        require(!e.manifests.isRetrievable(manifestId), "retrievable before start");
        vm.warp(startTime);
        require(e.manifests.isRetrievable(manifestId), "not retrievable at quorum");
    }
}
