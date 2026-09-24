// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeJobPayerCustody420.sol";

interface VmPayerCustody420 {
    function addr(uint256 key) external returns (address);
    function sign(uint256 key, bytes32 digest) external returns (uint8, bytes32, bytes32);
    function deal(address account, uint256 balance) external;
    function prank(address caller) external;
    function warp(uint256 timestamp) external;
}

contract PayerCustodyDeny420 is IComputeJobMatchEvidence420, IComputeJobWorkerEvidence420,
    IComputeJobVerificationEvidence420, IComputeJobSettlementEvidence420 {
    function matched(bytes32, bytes32, bytes32, bytes32) external pure returns (bool) { return false; }
    function accepted(bytes32, bytes32, bytes32) external pure returns (bool) { return false; }
    function authorizedAssignment(bytes32, bytes32, address, bytes32) external pure returns (bool) { return false; }
    function committedResult(bytes32, bytes32, bytes32) external pure returns (bool) { return false; }
    function verified(bytes32, bytes32, address, bytes32, bool) external pure returns (bool) { return false; }
    function settled(bytes32, bytes32, bytes32) external pure returns (bool) { return false; }
}

contract ComputeJobPayerCustody420Test {
    VmPayerCustody420 private constant vm = VmPayerCustody420(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 private constant OWNER_KEY = 0xA11CE;
    uint256 private constant PAYER_KEY = 0xBEEF;
    uint256 private constant OTHER_KEY = 0xCAFE;
    ComputeJobSignedRequestAuthority420 private requests;
    ComputeJobPayerCustody420 private custody;
    ComputeJobRegistry420 private jobs;
    address private owner;
    address private payer;
    address private outsider;

    function setUp() public {
        owner = vm.addr(OWNER_KEY);
        payer = vm.addr(PAYER_KEY);
        outsider = vm.addr(OTHER_KEY);
        vm.deal(payer, 100 ether);
        vm.deal(outsider, 100 ether);
        requests = new ComputeJobSignedRequestAuthority420();
        custody = new ComputeJobPayerCustody420(address(requests));
        PayerCustodyDeny420 denied = new PayerCustodyDeny420();
        jobs = new ComputeJobRegistry420(address(requests), address(custody), address(denied),
            address(denied), address(denied), address(denied));
        custody.bindJobs(address(jobs));
    }

    function _signature(uint256 key, bytes32 digest) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _job(uint256 nonce, uint256 maximum) private returns (bytes32 jobId) {
        ComputeJobSignedRequestAuthority420.Authorization memory a =
            ComputeJobSignedRequestAuthority420.Authorization({
                owner: owner, payer: payer, manifestHash: keccak256("manifest"),
                workloadType: keccak256("gpu"), inputCommitment: keccak256("inputs"),
                outputSchemaCommitment: keccak256("output"),
                deadline: uint64(block.timestamp + 1 days),
                authorizationExpiry: uint64(block.timestamp + 2 days),
                maxSpend: maximum, nonce: nonce
            });
        bytes32 digest = requests.authorizationDigest(a);
        bytes memory ownerSignature = _signature(OWNER_KEY, digest);
        bytes memory payerSignature = _signature(PAYER_KEY, digest);
        vm.prank(owner);
        bytes32 requestId = requests.registerSignedRequest(a, ownerSignature, payerSignature);
        vm.prank(owner);
        jobId = jobs.createJob(requestId, requestId, a.manifestHash, a.workloadType,
            a.inputCommitment, a.outputSchemaCommitment, a.deadline);
    }

    function _reserve(bytes32 jobId, uint256 amount) private {
        vm.prank(payer);
        custody.reserve{value: amount}(jobId);
    }

    function testPayerFundedNativeReservationAndRegistryAdmission() public {
        bytes32 id = _job(1, 10 ether);
        uint256 beforePayer = payer.balance;
        _reserve(id, 7 ether);
        ComputeJobPayerCustody420.Reservation memory r = custody.reservation(id);
        require(r.live && r.payer == payer && r.refundRecipient == payer && r.owner == owner,
            "payer provenance lost");
        require(r.requestId == jobs.job(id).requestId && r.amount == 7 ether
            && r.maximumSpend == 10 ether && address(custody).balance == 7 ether
            && custody.totalReserved() == 7 ether && payer.balance == beforePayer - 7 ether,
            "actual custody or ceiling mismatch");
        require(custody.funded(id, owner, id), "legitimate reservation not recognized");
        vm.prank(owner);
        jobs.recordFunding(id, 1, id);
        require(jobs.job(id).status == ComputeJobRegistry420.Status.FUNDED,
            "job did not admit live native transfer");
    }

    function testUnauthorizedOrUnfundedPayerRejected() public {
        bytes32 id = _job(2, 10 ether);
        vm.prank(outsider);
        (bool ok,) = address(custody).call{value: 1 ether}(abi.encodeCall(custody.reserve, (id)));
        require(!ok && address(custody).balance == 0, "third-party transfer accepted");
        vm.prank(owner);
        (ok,) = address(jobs).call(abi.encodeCall(jobs.recordFunding, (id, uint64(1), id)));
        require(!ok && !custody.funded(id, owner, id), "unfunded claim admitted");
        vm.prank(payer);
        (ok,) = address(custody).call(abi.encodeCall(custody.reserve, (id)));
        require(!ok, "zero-value reservation accepted");
    }

    function testMaximumSpendAndExactRequestEnforced() public {
        bytes32 id = _job(3, 4 ether);
        vm.prank(payer);
        (bool ok,) = address(custody).call{value: 4 ether + 1}(abi.encodeCall(custody.reserve, (id)));
        require(!ok && address(custody).balance == 0, "over-cap transfer accepted");
        _reserve(id, 4 ether);
        require(custody.reservation(id).amount == 4 ether, "exact ceiling rejected");
    }

    function testCrossJobAndDuplicateReservationRejected() public {
        bytes32 first = _job(4, 10 ether);
        bytes32 second = _job(5, 10 ether);
        _reserve(first, 3 ether);
        require(!custody.funded(second, owner, first) && !custody.funded(first, outsider, first)
            && !custody.funded(first, owner, second), "cross-job or cross-owner proof accepted");
        vm.prank(payer);
        (bool ok,) = address(custody).call{value: 1 ether}(abi.encodeCall(custody.reserve, (first)));
        require(!ok && custody.totalReserved() == 3 ether, "duplicate reservation accepted");
        _reserve(second, 2 ether);
        require(custody.totalReserved() == 5 ether && address(custody).balance == 5 ether,
            "isolated job accounting incorrect");
    }

    function testExpiredUnmatchedRefundOnlyToOriginalPayer() public {
        bytes32 id = _job(6, 10 ether);
        _reserve(id, 3 ether);
        vm.prank(owner);
        jobs.recordFunding(id, 1, id);
        uint256 payerAfterDeposit = payer.balance;
        vm.prank(payer);
        (bool ok,) = address(custody).call(abi.encodeCall(custody.refundExpiredUnmatched, (id)));
        require(!ok, "premature refund accepted");
        vm.warp(uint256(jobs.job(id).deadline) + 1);
        vm.prank(outsider);
        (ok,) = address(custody).call(abi.encodeCall(custody.refundExpiredUnmatched, (id)));
        require(!ok, "outsider stole refund");
        vm.prank(payer);
        custody.refundExpiredUnmatched(id);
        require(payer.balance == payerAfterDeposit + 3 ether && address(custody).balance == 0
            && custody.totalReserved() == 0 && !custody.funded(id, owner, id),
            "refund provenance or custody failed");
        vm.prank(payer);
        (ok,) = address(custody).call(abi.encodeCall(custody.refundExpiredUnmatched, (id)));
        require(!ok, "refund replay accepted");
    }

    function testUnboundAndExpiredJobsRejectFunding() public {
        ComputeJobPayerCustody420 unbound = new ComputeJobPayerCustody420(address(requests));
        bytes32 id = _job(7, 10 ether);
        vm.prank(payer);
        (bool ok,) = address(unbound).call{value: 1 ether}(abi.encodeCall(unbound.reserve, (id)));
        require(!ok, "unbound custody accepted payment");
        vm.warp(uint256(jobs.job(id).deadline) + 1);
        vm.prank(payer);
        (ok,) = address(custody).call{value: 1 ether}(abi.encodeCall(custody.reserve, (id)));
        require(!ok, "expired job accepted deposit");
    }
}
