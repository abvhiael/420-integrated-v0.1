// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/resource/ResourceIds420.sol";
import "../src/resource/ResourceAuthorization420.sol";
import "../src/resource/ResourceProviderRegistry420.sol";
import "../src/resource/ResourceNodeRegistry420.sol";
import "../src/resource/StorageProofIds420.sol";
import "../src/resource/IStorageProofVerifier420.sol";
import "../src/resource/StorageProofSchemeRegistry420.sol";
import "../src/resource/StorageCommitmentRegistry420.sol";
import "../src/resource/StorageProofRegistry420.sol";

interface VmStorageProof420 { function prank(address) external; function warp(uint256) external; }

contract MockStorageProofCaps420 is ICapabilityRegistry420 {
    mapping(bytes32 => bool) internal ok;
    function key(address p, bytes32 c, bytes32 a, bytes32 s) public pure returns (bytes32) { return keccak256(abi.encode(p,c,a,s)); }
    function set(address p, bytes32 c, bytes32 a, bytes32 s, bool v) external { ok[key(p,c,a,s)] = v; }
    function grant(bytes32) external pure returns (CapabilityGrant memory g) { return g; }
    function isAuthorized(address p, bytes32 c, bytes32 a, bytes32 s, uint256) external view returns (bool) { return ok[key(p,c,a,s)]; }
}

contract MockStorageProofVerifier420 is IStorageProofVerifier420 {
    bool public enabled = true;
    function setEnabled(bool value) external { enabled = value; }
    function verifyStorageProof(bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,uint64,bytes calldata proof) external view returns (bool) {
        return enabled && keccak256(proof) == keccak256(bytes("valid-proof"));
    }
}

contract StorageProofProtocol420Test {
    VmStorageProof420 constant vm = VmStorageProof420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    address constant GOVERNOR = address(0x420420);

    struct Env {
        MockStorageProofCaps420 caps;
        ResourceAuthorization420 auth;
        ResourceProviderRegistry420 providers;
        ResourceNodeRegistry420 nodes;
        MockStorageProofVerifier420 verifier;
        StorageProofSchemeRegistry420 schemes;
        StorageCommitmentRegistry420 commitments;
        StorageProofRegistry420 proofs;
        bytes32 providerId;
        bytes32 nodeId;
        bytes32 schemeId;
    }

    function setup() internal returns (Env memory e) {
        e.caps = new MockStorageProofCaps420();
        e.auth = new ResourceAuthorization420(address(e.caps));
        e.providers = new ResourceProviderRegistry420(address(e.auth));
        e.nodes = new ResourceNodeRegistry420(address(e.auth), address(e.providers));
        e.verifier = new MockStorageProofVerifier420();
        e.schemes = new StorageProofSchemeRegistry420(address(e.auth));
        e.commitments = new StorageCommitmentRegistry420(address(e.auth), address(e.providers), address(e.nodes), address(e.schemes));
        e.proofs = new StorageProofRegistry420(address(e.commitments), address(e.schemes), address(e.nodes));
        e.providerId = keccak256("storage-provider");
        e.nodeId = keccak256("storage-node");
        e.schemeId = keccak256("proof-scheme-v1");

        vm.prank(ALICE); e.providers.registerProvider(e.providerId, ALICE, keccak256("provider-meta"), keccak256("stake"));
        vm.prank(ALICE); e.providers.setState(e.providerId, ResourceProviderRegistry420.State.ACTIVE);
        vm.prank(ALICE); e.nodes.registerNode(e.nodeId, e.providerId, ResourceIds420.SERVICE_STORE, ALICE, keccak256("endpoint"), keccak256("capacity"));
        vm.prank(ALICE); e.nodes.setState(e.nodeId, ResourceNodeRegistry420.State.ACTIVE);

        e.caps.set(GOVERNOR, ResourceIds420.COMPONENT_RESOURCE, StorageProofIds420.ACTION_REGISTER_PROOF_SCHEME, e.auth.scopeProofScheme(e.schemeId), true);
        vm.prank(GOVERNOR); e.schemes.registerScheme(e.schemeId, address(e.verifier), StorageProofIds420.PROOF_AVAILABILITY_WINDOW, keccak256("spec-v1"), 300);
    }

    function registerCommitment(Env memory e, bytes32 commitmentId) internal {
        vm.prank(ALICE);
        e.commitments.registerCommitment(commitmentId, e.nodeId, e.schemeId, keccak256("content-root"), keccak256("replica-root"), 1_048_576, uint64(block.timestamp), uint64(block.timestamp + 3600), keccak256("commitment-meta"));
    }

    function testProofSchemeRegistrationIsDefaultDeny() public {
        MockStorageProofCaps420 caps = new MockStorageProofCaps420();
        ResourceAuthorization420 auth = new ResourceAuthorization420(address(caps));
        StorageProofSchemeRegistry420 schemes = new StorageProofSchemeRegistry420(address(auth));
        MockStorageProofVerifier420 verifier = new MockStorageProofVerifier420();
        bytes32 schemeId = keccak256("denied-scheme");
        vm.prank(BOB);
        (bool ok,) = address(schemes).call(abi.encodeWithSelector(schemes.registerScheme.selector, schemeId, address(verifier), StorageProofIds420.PROOF_AUDIT_RESPONSE, keccak256("spec"), uint64(60)));
        require(!ok, "unauthorized scheme registered");
    }

    function testCommitmentRequiresActiveStoreNodeAndProviderAuthority() public {
        Env memory e = setup();
        bytes32 commitmentId = keccak256("commitment-denied");
        vm.prank(BOB);
        (bool denied,) = address(e.commitments).call(abi.encodeWithSelector(e.commitments.registerCommitment.selector, commitmentId, e.nodeId, e.schemeId, keccak256("content"), keccak256("replica"), uint128(1024), uint64(block.timestamp), uint64(block.timestamp + 1000), keccak256("meta")));
        require(!denied, "unrelated actor created commitment");

        bytes32 relayNode = keccak256("relay-node");
        vm.prank(ALICE); e.nodes.registerNode(relayNode, e.providerId, ResourceIds420.SERVICE_RELAY, ALICE, keccak256("relay-endpoint"), keccak256("relay-capacity"));
        vm.prank(ALICE); e.nodes.setState(relayNode, ResourceNodeRegistry420.State.ACTIVE);
        vm.prank(ALICE);
        (bool wrongService,) = address(e.commitments).call(abi.encodeWithSelector(e.commitments.registerCommitment.selector, keccak256("wrong-service"), relayNode, e.schemeId, keccak256("content"), keccak256("replica"), uint128(1024), uint64(block.timestamp), uint64(block.timestamp + 1000), keccak256("meta")));
        require(!wrongService, "non-store node accepted");
    }

    function testVerifiedProofCreatesReplaySafeReceipt() public {
        Env memory e = setup();
        bytes32 commitmentId = keccak256("commitment-1");
        registerCommitment(e, commitmentId);
        bytes32 challengeId = keccak256("challenge-1");
        uint64 challengeEpoch = uint64(block.timestamp);
        bytes memory proof = bytes("valid-proof");
        bytes32 proofId = e.proofs.submitProof(commitmentId, challengeId, challengeEpoch, proof);
        StorageProofRegistry420.ProofReceipt memory receipt = e.proofs.getProof(proofId);
        require(receipt.commitmentId == commitmentId && receipt.challengeId == challengeId, "bad receipt");
        require(receipt.proofDigest == keccak256(proof), "bad proof digest");
        (bool replay,) = address(e.proofs).call(abi.encodeWithSelector(e.proofs.submitProof.selector, commitmentId, challengeId, challengeEpoch, proof));
        require(!replay, "challenge replay accepted");
    }

    function testInvalidOrLateProofFailsClosed() public {
        Env memory e = setup();
        bytes32 commitmentId = keccak256("commitment-2");
        registerCommitment(e, commitmentId);
        uint64 challengeEpoch = uint64(block.timestamp);
        (bool invalid,) = address(e.proofs).call(abi.encodeWithSelector(e.proofs.submitProof.selector, commitmentId, keccak256("bad-challenge"), challengeEpoch, bytes("invalid")));
        require(!invalid, "invalid proof accepted");
        require(!e.proofs.challengeConsumed(commitmentId, keccak256("bad-challenge")), "failed proof consumed challenge");
        vm.warp(block.timestamp + 301);
        (bool late,) = address(e.proofs).call(abi.encodeWithSelector(e.proofs.submitProof.selector, commitmentId, keccak256("late-challenge"), challengeEpoch, bytes("valid-proof")));
        require(!late, "late proof accepted");
    }

    function testSchemeOrNodeSuspensionStopsProofAcceptance() public {
        Env memory e = setup();
        bytes32 commitmentId = keccak256("commitment-3");
        registerCommitment(e, commitmentId);
        e.caps.set(GOVERNOR, ResourceIds420.COMPONENT_RESOURCE, StorageProofIds420.ACTION_SET_PROOF_SCHEME_STATE, e.auth.scopeProofScheme(e.schemeId), true);
        vm.prank(GOVERNOR); e.schemes.setSchemeActive(e.schemeId, false);
        (bool inactiveScheme,) = address(e.proofs).call(abi.encodeWithSelector(e.proofs.submitProof.selector, commitmentId, keccak256("challenge-scheme"), uint64(block.timestamp), bytes("valid-proof")));
        require(!inactiveScheme, "inactive scheme accepted proof");
        vm.prank(GOVERNOR); e.schemes.setSchemeActive(e.schemeId, true);
        vm.prank(ALICE); e.nodes.setState(e.nodeId, ResourceNodeRegistry420.State.SUSPENDED);
        (bool inactiveNode,) = address(e.proofs).call(abi.encodeWithSelector(e.proofs.submitProof.selector, commitmentId, keccak256("challenge-node"), uint64(block.timestamp), bytes("valid-proof")));
        require(!inactiveNode, "suspended node accepted proof");
    }
}
