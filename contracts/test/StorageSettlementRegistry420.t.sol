// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/resource/IStorageProofVerifier420.sol";
import "../src/resource/ResourceAuthorization420.sol";
import "../src/resource/ResourceIds420.sol";
import "../src/resource/ResourceNodeRegistry420.sol";
import "../src/resource/ResourceOfferRegistry420.sol";
import "../src/resource/ResourcePolicyRegistry420.sol";
import "../src/resource/ResourceProviderRegistry420.sol";
import "../src/resource/StorageAgreementRegistry420.sol";
import "../src/resource/StorageCapacityRegistry420.sol";
import "../src/resource/StorageCommitmentRegistry420.sol";
import "../src/resource/StorageProofIds420.sol";
import "../src/resource/StorageProofRegistry420.sol";
import "../src/resource/StorageProofSchemeRegistry420.sol";
import "../src/resource/StorageSettlementRegistry420.sol";

interface VmStorageSettlement420 { function prank(address) external; function warp(uint256) external; }

contract MockStorageSettlementCaps420 is ICapabilityRegistry420 {
    mapping(bytes32 => bool) internal ok;
    function key(address p, bytes32 c, bytes32 a, bytes32 s) public pure returns (bytes32) { return keccak256(abi.encode(p,c,a,s)); }
    function set(address p, bytes32 c, bytes32 a, bytes32 s, bool v) external { ok[key(p,c,a,s)] = v; }
    function grant(bytes32) external pure returns (CapabilityGrant memory g) { return g; }
    function isAuthorized(address p, bytes32 c, bytes32 a, bytes32 s, uint256) external view returns (bool) { return ok[key(p,c,a,s)]; }
}

contract MockStorageSettlementVerifier420 is IStorageProofVerifier420 {
    function verifyStorageProof(bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,uint64,bytes calldata) external pure returns (bool) { return true; }
}

contract MockStorageSettlementVault420 is IStorageSettlementVault420 {
    bytes32 public immutable vaultId = keccak256("storage-settlement-vault");
    struct Obligation { address asset; address beneficiary; uint256 amount; uint8 state; bool exists; }
    mapping(bytes32 => Obligation) public obligations;
    mapping(bytes32 => bool) public operations;
    uint256 public reserved;
    uint256 public released;
    uint256 public cancelled;

    function createObligation(bytes32 operationId, bytes32 obligationId, address asset, address beneficiary, uint256 amount, bytes32, bytes32) external {
        require(!operations[operationId] && !obligations[obligationId].exists && amount != 0, "create");
        operations[operationId] = true;
        obligations[obligationId] = Obligation(asset, beneficiary, amount, 1, true);
        reserved += amount;
    }
    function releaseObligation(bytes32 operationId, bytes32 obligationId) external {
        Obligation storage o = obligations[obligationId];
        require(!operations[operationId] && o.state == 1, "release");
        operations[operationId] = true; o.state = 2; reserved -= o.amount; released += o.amount;
    }
    function cancelObligation(bytes32 operationId, bytes32 obligationId) external {
        Obligation storage o = obligations[obligationId];
        require(!operations[operationId] && o.state == 1, "cancel");
        operations[operationId] = true; o.state = 3; reserved -= o.amount; cancelled += o.amount;
    }
}

contract StorageSettlementRegistry420Test {
    VmStorageSettlement420 constant vm = VmStorageSettlement420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant PROVIDER = address(0xA11CE);
    address constant CONSUMER = address(0xB0B);
    address constant GOVERNOR = address(0x420420);

    struct Env {
        MockStorageSettlementCaps420 caps;
        ResourceAuthorization420 auth;
        ResourceProviderRegistry420 providers;
        ResourceNodeRegistry420 nodes;
        ResourcePolicyRegistry420 policy;
        ResourceOfferRegistry420 offers;
        MockStorageSettlementVerifier420 verifier;
        StorageProofSchemeRegistry420 schemes;
        StorageCommitmentRegistry420 commitments;
        StorageProofRegistry420 proofs;
        StorageCapacityRegistry420 capacity;
        StorageAgreementRegistry420 agreements;
        StorageSettlementRegistry420 settlements;
        MockStorageSettlementVault420 vault;
        bytes32 providerId;
        bytes32 nodeId;
        bytes32 offerId;
        bytes32 schemeId;
    }

    function setup() internal returns (Env memory e) {
        e.caps = new MockStorageSettlementCaps420();
        e.auth = new ResourceAuthorization420(address(e.caps));
        e.providers = new ResourceProviderRegistry420(address(e.auth));
        e.nodes = new ResourceNodeRegistry420(address(e.auth), address(e.providers));
        e.policy = new ResourcePolicyRegistry420(address(this));
        e.offers = new ResourceOfferRegistry420(address(e.nodes), address(e.providers), address(e.policy), address(e.auth));
        e.verifier = new MockStorageSettlementVerifier420();
        e.schemes = new StorageProofSchemeRegistry420(address(e.auth));
        e.commitments = new StorageCommitmentRegistry420(address(e.auth), address(e.providers), address(e.nodes), address(e.schemes));
        e.proofs = new StorageProofRegistry420(address(e.commitments), address(e.schemes), address(e.nodes));
        e.capacity = new StorageCapacityRegistry420(address(e.auth), address(e.nodes), address(e.providers));
        e.agreements = new StorageAgreementRegistry420(address(e.auth), address(e.offers), address(e.nodes), address(e.providers), address(e.schemes), address(e.commitments), address(e.capacity));
        e.settlements = new StorageSettlementRegistry420(address(e.agreements), address(e.proofs));
        e.vault = new MockStorageSettlementVault420();

        e.providerId = keccak256("settlement-provider");
        e.nodeId = keccak256("settlement-node");
        e.offerId = keccak256("settlement-offer");
        e.schemeId = keccak256("settlement-scheme");

        vm.prank(PROVIDER); e.providers.registerProvider(e.providerId, PROVIDER, keccak256("provider-meta"), keccak256("stake"));
        vm.prank(PROVIDER); e.providers.setState(e.providerId, ResourceProviderRegistry420.State.ACTIVE);
        vm.prank(PROVIDER); e.nodes.registerNode(e.nodeId, e.providerId, ResourceIds420.SERVICE_STORE, PROVIDER, keccak256("endpoint"), keccak256("capacity"));
        vm.prank(PROVIDER); e.nodes.setState(e.nodeId, ResourceNodeRegistry420.State.ACTIVE);
        vm.prank(PROVIDER); e.capacity.configureCapacity(e.nodeId, 1_000_000, keccak256("capacity-meta"));
        e.policy.setPolicy(ResourceIds420.SERVICE_STORE, keccak256("terms"), 30 days, type(uint128).max, true);
        vm.prank(PROVIDER); e.offers.publishOffer(e.offerId, e.nodeId, 10, 1_000_000, keccak256("offer-terms"), uint64(block.timestamp + 30 days));
        e.caps.set(GOVERNOR, ResourceIds420.COMPONENT_RESOURCE, StorageProofIds420.ACTION_REGISTER_PROOF_SCHEME, e.auth.scopeProofScheme(e.schemeId), true);
        vm.prank(GOVERNOR); e.schemes.registerScheme(e.schemeId, address(e.verifier), StorageProofIds420.PROOF_AVAILABILITY_WINDOW, keccak256("proof-spec"), 300);
    }

    function activateAgreement(Env memory e) internal returns (bytes32 agreementId, bytes32 commitmentId, uint64 startTime, uint64 endTime) {
        startTime = uint64(block.timestamp + 1 hours);
        endTime = uint64(startTime + 24 hours);
        vm.prank(CONSUMER);
        agreementId = e.agreements.proposeAgreement(
            e.offerId, keccak256("object"), keccak256("content-root"), keccak256("manifest"),
            keccak256("standard"), keccak256("repair"), e.schemeId, 4_000,
            startTime, endTime, 6 hours, 1, 1, 1
        );
        commitmentId = keccak256("settlement-commitment");
        vm.prank(PROVIDER);
        e.commitments.registerCommitment(commitmentId, e.nodeId, e.schemeId, keccak256("content-root"), keccak256("replica-root"), 4_000, startTime, endTime, keccak256("meta"));
        vm.prank(PROVIDER);
        bytes32 reservationId = e.capacity.reserveCapacity(e.nodeId, agreementId, 4_000, endTime);
        vm.prank(PROVIDER); e.agreements.activateAgreement(agreementId, commitmentId, reservationId);
    }

    function openAndFund(Env memory e, bytes32 agreementId) internal returns (bytes32 settlementId) {
        vm.prank(CONSUMER); settlementId = e.settlements.openSettlement(agreementId, address(e.vault), address(0));
        e.settlements.reserveWindows(settlementId, 0, 2);
        e.settlements.reserveWindows(settlementId, 2, 2);
    }

    function testBatchedReservationFullyFundsExactQuotedAmount() public {
        Env memory e = setup();
        (bytes32 agreementId,,,) = activateAgreement(e);
        bytes32 settlementId = openAndFund(e, agreementId);
        StorageSettlementRegistry420.Settlement memory s = e.settlements.getSettlement(settlementId);
        require(s.windowCount == 4 && s.reservedWindows == 4, "windows");
        require(s.totalAmount420 == 40_000 && e.vault.reserved() == 40_000, "quote");
        require(s.state == StorageSettlementRegistry420.State.FUNDED, "not funded");
        require(e.settlements.windowAmount(settlementId, 0) == 10_000, "window amount");
    }

    function testVerifiedCanonicalProofReleasesOnlyItsWindow() public {
        Env memory e = setup();
        (bytes32 agreementId, bytes32 commitmentId,,) = activateAgreement(e);
        bytes32 settlementId = openAndFund(e, agreementId);
        (uint64 epoch,) = e.settlements.windowTiming(settlementId, 0);
        vm.warp(epoch);
        bytes32 challengeId = e.settlements.canonicalChallengeId(agreementId, 0, epoch);
        bytes memory proof = hex"4201";
        bytes32 proofId = e.proofs.submitProof(commitmentId, challengeId, epoch, proof);
        e.settlements.settleWindow(settlementId, 0, proofId);
        require(e.vault.released() == 10_000 && e.vault.reserved() == 30_000, "release accounting");
        require(e.settlements.windowState(settlementId, 0) == StorageSettlementRegistry420.WindowState.PAID, "window state");
    }

    function testWrongChallengeCannotReleaseEscrow() public {
        Env memory e = setup();
        (bytes32 agreementId, bytes32 commitmentId,,) = activateAgreement(e);
        bytes32 settlementId = openAndFund(e, agreementId);
        (uint64 epoch,) = e.settlements.windowTiming(settlementId, 0);
        vm.warp(epoch);
        bytes32 proofId = e.proofs.submitProof(commitmentId, keccak256("wrong-challenge"), epoch, hex"4202");
        (bool ok,) = address(e.settlements).call(abi.encodeWithSelector(e.settlements.settleWindow.selector, settlementId, uint32(0), proofId));
        require(!ok && e.vault.released() == 0 && e.vault.reserved() == 40_000, "wrong proof released");
        agreementId;
    }

    function testMissedProofWindowRefundsAfterDeadlineOnly() public {
        Env memory e = setup();
        (bytes32 agreementId,,,) = activateAgreement(e);
        bytes32 settlementId = openAndFund(e, agreementId);
        (, uint64 deadline) = e.settlements.windowTiming(settlementId, 0);
        vm.warp(deadline);
        (bool early,) = address(e.settlements).call(abi.encodeWithSelector(e.settlements.refundMissedWindow.selector, settlementId, uint32(0)));
        require(!early, "refund before deadline passed");
        vm.warp(uint256(deadline) + 1);
        e.settlements.refundMissedWindow(settlementId, 0);
        require(e.vault.cancelled() == 10_000 && e.vault.reserved() == 30_000, "refund accounting");
        require(e.settlements.windowState(settlementId, 0) == StorageSettlementRegistry420.WindowState.REFUNDED, "refund state");
        agreementId;
    }

    function testPartialFundingCannotEarnAndCanAbortAfterStart() public {
        Env memory e = setup();
        (bytes32 agreementId,, uint64 startTime,) = activateAgreement(e);
        vm.prank(CONSUMER);
        bytes32 settlementId = e.settlements.openSettlement(agreementId, address(e.vault), address(0));
        e.settlements.reserveWindows(settlementId, 0, 2);
        require(e.settlements.getSettlement(settlementId).state == StorageSettlementRegistry420.State.OPEN, "partially funded active");
        vm.warp(startTime);
        e.settlements.abortUnfundedSettlement(settlementId);
        e.settlements.refundAbortedWindows(settlementId, 0, 2);
        StorageSettlementRegistry420.Settlement memory s = e.settlements.getSettlement(settlementId);
        require(s.state == StorageSettlementRegistry420.State.CANCELLED, "not cancelled");
        require(e.vault.cancelled() == 20_000 && e.vault.reserved() == 0, "abort refund");
    }
}
