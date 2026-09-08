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
import "../src/resource/StorageCommitmentRegistry420.sol";
import "../src/resource/StorageProofIds420.sol";
import "../src/resource/StorageProofSchemeRegistry420.sol";
import "../src/resource/IStorageProofVerifier420.sol";

interface VmStorageAgreement420 { function prank(address) external; function warp(uint256) external; }

contract MockStorageAgreementCaps420 is ICapabilityRegistry420 {
    mapping(bytes32 => bool) internal ok;
    function key(address p, bytes32 c, bytes32 a, bytes32 s) public pure returns (bytes32) { return keccak256(abi.encode(p,c,a,s)); }
    function set(address p, bytes32 c, bytes32 a, bytes32 s, bool v) external { ok[key(p,c,a,s)] = v; }
    function grant(bytes32) external pure returns (CapabilityGrant memory g) { return g; }
    function isAuthorized(address p, bytes32 c, bytes32 a, bytes32 s, uint256) external view returns (bool) { return ok[key(p,c,a,s)]; }
}

contract MockStorageAgreementVerifier420 is IStorageProofVerifier420 {
    function verifyStorageProof(bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,uint64,bytes calldata) external pure returns (bool) { return true; }
}

contract StorageAgreementRegistry420Test {
    VmStorageAgreement420 constant vm = VmStorageAgreement420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    address constant GOVERNOR = address(0x420420);

    struct Env {
        MockStorageAgreementCaps420 caps;
        ResourceAuthorization420 auth;
        ResourceProviderRegistry420 providers;
        ResourceNodeRegistry420 nodes;
        ResourcePolicyRegistry420 policy;
        ResourceOfferRegistry420 offers;
        MockStorageAgreementVerifier420 verifier;
        StorageProofSchemeRegistry420 schemes;
        StorageCommitmentRegistry420 commitments;
        StorageAgreementRegistry420 agreements;
        bytes32 providerId;
        bytes32 nodeId;
        bytes32 offerId;
        bytes32 schemeId;
    }

    function setup() internal returns (Env memory e) {
        e.caps = new MockStorageAgreementCaps420();
        e.auth = new ResourceAuthorization420(address(e.caps));
        e.providers = new ResourceProviderRegistry420(address(e.auth));
        e.nodes = new ResourceNodeRegistry420(address(e.auth), address(e.providers));
        e.policy = new ResourcePolicyRegistry420(address(this));
        e.offers = new ResourceOfferRegistry420(address(e.nodes), address(e.providers), address(e.policy), address(e.auth));
        e.verifier = new MockStorageAgreementVerifier420();
        e.schemes = new StorageProofSchemeRegistry420(address(e.auth));
        e.commitments = new StorageCommitmentRegistry420(address(e.auth), address(e.providers), address(e.nodes), address(e.schemes));
        e.agreements = new StorageAgreementRegistry420(address(e.auth), address(e.offers), address(e.nodes), address(e.providers), address(e.schemes), address(e.commitments));

        e.providerId = keccak256("provider");
        e.nodeId = keccak256("store-node");
        e.offerId = keccak256("store-offer");
        e.schemeId = keccak256("proof-scheme");

        vm.prank(ALICE); e.providers.registerProvider(e.providerId, ALICE, keccak256("provider-meta"), keccak256("stake"));
        vm.prank(ALICE); e.providers.setState(e.providerId, ResourceProviderRegistry420.State.ACTIVE);
        vm.prank(ALICE); e.nodes.registerNode(e.nodeId, e.providerId, ResourceIds420.SERVICE_STORE, ALICE, keccak256("endpoint"), keccak256("capacity"));
        vm.prank(ALICE); e.nodes.setState(e.nodeId, ResourceNodeRegistry420.State.ACTIVE);
        e.policy.setPolicy(ResourceIds420.SERVICE_STORE, keccak256("store-terms"), 30 days, type(uint128).max, true);
        vm.prank(ALICE); e.offers.publishOffer(e.offerId, e.nodeId, 42, type(uint128).max, keccak256("offer-terms"), uint64(block.timestamp + 30 days));

        e.caps.set(GOVERNOR, ResourceIds420.COMPONENT_RESOURCE, StorageProofIds420.ACTION_REGISTER_PROOF_SCHEME, e.auth.scopeProofScheme(e.schemeId), true);
        vm.prank(GOVERNOR); e.schemes.registerScheme(e.schemeId, address(e.verifier), StorageProofIds420.PROOF_AVAILABILITY_WINDOW, keccak256("proof-spec"), 300);
    }

    function propose(Env memory e, uint256 nonce) internal returns (bytes32 agreementId, uint64 startTime, uint64 endTime) {
        startTime = uint64(block.timestamp + 600);
        endTime = uint64(block.timestamp + 1 days);
        vm.prank(BOB);
        agreementId = e.agreements.proposeAgreement(
            e.offerId,
            keccak256("object"),
            keccak256("content-root"),
            keccak256("manifest"),
            keccak256("standard-storage"),
            keccak256("repair-standard"),
            e.schemeId,
            1_048_576,
            startTime,
            endTime,
            300,
            20,
            40,
            nonce
        );
    }

    function registerMatchingCommitment(Env memory e, bytes32 commitmentId, uint64 startTime, uint64 endTime) internal {
        vm.prank(ALICE);
        e.commitments.registerCommitment(
            commitmentId,
            e.nodeId,
            e.schemeId,
            keccak256("content-root"),
            keccak256("replica-root"),
            1_048_576,
            startTime,
            endTime,
            keccak256("commitment-meta")
        );
    }

    function testConsumerCanProposeCanonicalStoreAgreement() public {
        Env memory e = setup();
        (bytes32 agreementId, uint64 startTime, uint64 endTime) = propose(e, 7);
        StorageAgreementRegistry420.Agreement memory agreement = e.agreements.getAgreement(agreementId);
        require(agreement.consumer == BOB, "consumer");
        require(agreement.offerId == e.offerId, "offer");
        require(agreement.contentRoot == keccak256("content-root"), "content root");
        require(agreement.manifestHash == keccak256("manifest"), "manifest");
        require(agreement.startTime == startTime && agreement.endTime == endTime, "window");
        require(agreement.dataShards == 20 && agreement.totalShards == 40, "erasure policy");
        require(agreement.state == StorageAgreementRegistry420.State.PROPOSED, "state");
        require(agreementId == e.agreements.canonicalAgreementId(BOB, e.offerId, keccak256("object"), 7), "canonical id");
    }

    function testInvalidErasureOrTimingPolicyFailsClosed() public {
        Env memory e = setup();
        vm.prank(BOB);
        (bool badShards,) = address(e.agreements).call(abi.encodeWithSelector(
            e.agreements.proposeAgreement.selector,
            e.offerId, keccak256("object"), keccak256("content-root"), keccak256("manifest"), keccak256("storage-class"),
            keccak256("repair"), e.schemeId, uint128(1024), uint64(block.timestamp + 600), uint64(block.timestamp + 3600),
            uint64(60), uint32(20), uint32(19), uint256(1)
        ));
        require(!badShards, "invalid shard policy accepted");

        vm.prank(BOB);
        (bool badWindow,) = address(e.agreements).call(abi.encodeWithSelector(
            e.agreements.proposeAgreement.selector,
            e.offerId, keccak256("object-2"), keccak256("content-root"), keccak256("manifest"), keccak256("storage-class"),
            keccak256("repair"), e.schemeId, uint128(1024), uint64(block.timestamp), uint64(block.timestamp + 3600),
            uint64(60), uint32(10), uint32(20), uint256(2)
        ));
        require(!badWindow, "non-future start accepted");
    }

    function testActivationBindsExactImmutableCommitment() public {
        Env memory e = setup();
        (bytes32 agreementId, uint64 startTime, uint64 endTime) = propose(e, 1);
        bytes32 commitmentId = keccak256("commitment");
        registerMatchingCommitment(e, commitmentId, startTime, endTime);

        vm.prank(ALICE); e.agreements.activateAgreement(agreementId, commitmentId);
        StorageAgreementRegistry420.Agreement memory agreement = e.agreements.getAgreement(agreementId);
        require(agreement.commitmentId == commitmentId, "commitment not bound");
        require(agreement.state == StorageAgreementRegistry420.State.ACTIVE, "not active");

        vm.warp(startTime);
        require(e.agreements.isEffective(agreementId), "agreement not effective at start");
    }

    function testActivationRejectsUnauthorizedActorAndMismatchedCommitment() public {
        Env memory e = setup();
        (bytes32 agreementId, uint64 startTime, uint64 endTime) = propose(e, 2);
        bytes32 commitmentId = keccak256("commitment-ok");
        registerMatchingCommitment(e, commitmentId, startTime, endTime);

        vm.prank(BOB);
        (bool unauthorized,) = address(e.agreements).call(abi.encodeWithSelector(e.agreements.activateAgreement.selector, agreementId, commitmentId));
        require(!unauthorized, "consumer activated provider commitment");

        bytes32 mismatchId = keccak256("commitment-mismatch");
        vm.prank(ALICE);
        e.commitments.registerCommitment(mismatchId, e.nodeId, e.schemeId, keccak256("other-content"), keccak256("replica-root"), 1_048_576, startTime, endTime, keccak256("meta"));
        vm.prank(ALICE);
        (bool mismatch,) = address(e.agreements).call(abi.encodeWithSelector(e.agreements.activateAgreement.selector, agreementId, mismatchId));
        require(!mismatch, "mismatched commitment activated");
    }

    function testConsumerCanCancelOnlyBeforeActivation() public {
        Env memory e = setup();
        (bytes32 cancelledId,,) = propose(e, 3);
        vm.prank(BOB); e.agreements.cancelAgreement(cancelledId);
        require(e.agreements.getAgreement(cancelledId).state == StorageAgreementRegistry420.State.CANCELLED, "not cancelled");

        (bytes32 activeId, uint64 startTime, uint64 endTime) = propose(e, 4);
        bytes32 commitmentId = keccak256("commitment-active");
        registerMatchingCommitment(e, commitmentId, startTime, endTime);
        vm.prank(ALICE); e.agreements.activateAgreement(activeId, commitmentId);
        vm.prank(BOB);
        (bool cancelledActive,) = address(e.agreements).call(abi.encodeWithSelector(e.agreements.cancelAgreement.selector, activeId));
        require(!cancelledActive, "active agreement cancelled");
    }

    function testCompletionIsDeterministicAfterEnd() public {
        Env memory e = setup();
        (bytes32 agreementId, uint64 startTime, uint64 endTime) = propose(e, 5);
        bytes32 commitmentId = keccak256("commitment-complete");
        registerMatchingCommitment(e, commitmentId, startTime, endTime);
        vm.prank(ALICE); e.agreements.activateAgreement(agreementId, commitmentId);

        vm.warp(endTime);
        (bool early,) = address(e.agreements).call(abi.encodeWithSelector(e.agreements.completeAgreement.selector, agreementId));
        require(!early, "completed before end passed");
        vm.warp(uint256(endTime) + 1);
        e.agreements.completeAgreement(agreementId);
        require(e.agreements.getAgreement(agreementId).state == StorageAgreementRegistry420.State.COMPLETED, "not completed");
        require(!e.agreements.isEffective(agreementId), "completed agreement effective");
    }
}
