// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeWorkerConflictingResultSlashEvidence420.sol";

interface VmComputeWorkerConflictSlash420 {
    function addr(uint256 key) external returns (address);
    function sign(uint256 key, bytes32 digest) external returns (uint8, bytes32, bytes32);
}

contract MockWorkerConflictSnapshot420 is IComputeWorkerConflictSnapshot420 {
    bytes32 public currentAssignment;
    Assignment private _assignment;

    function setAssignment(bytes32 assignmentRef, Assignment calldata a) external {
        currentAssignment = assignmentRef;
        _assignment = a;
    }

    function assignmentForJob(bytes32) external view returns (bytes32) {
        return currentAssignment;
    }

    function getAssignment(bytes32 assignmentRef) external view returns (Assignment memory) {
        require(assignmentRef == currentAssignment && _assignment.exists, "missing");
        return _assignment;
    }

    function resultExecutionDigest(bytes32 jobId, bytes32 receiptHash, bytes32 outputHash)
        external
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                keccak256("mock/result/digest"),
                block.chainid,
                address(this),
                jobId,
                currentAssignment,
                _assignment.workerId,
                _assignment.workerRevision,
                _assignment.attempt,
                receiptHash,
                outputHash
            )
        );
    }
}

contract ComputeWorkerConflictingResultSlashEvidence420Test {
    VmComputeWorkerConflictSlash420 private constant vm =
        VmComputeWorkerConflictSlash420(
            address(uint160(uint256(keccak256("hevm cheat code"))))
        );

    uint256 private constant EXEC_KEY = 0xBEEF;
    bytes32 private constant JOB = keccak256("job");
    bytes32 private constant ASSIGNMENT = keccak256("assignment");
    bytes32 private constant WORKER_ID = keccak256("worker");
    bytes32 private constant STAKE_POLICY = keccak256("stake-policy");
    bytes32 private constant STAKE_REFERENCE = keccak256("stake-reference");

    MockWorkerConflictSnapshot420 private snapshots;
    ComputeWorkerConflictingResultSlashEvidence420 private adapter;
    address private signer;

    function setUp() public {
        signer = vm.addr(EXEC_KEY);
        snapshots = new MockWorkerConflictSnapshot420();
        adapter = new ComputeWorkerConflictingResultSlashEvidence420(address(snapshots));

        IComputeWorkerConflictSnapshot420.AdmissionRefs memory admission =
            IComputeWorkerConflictSnapshot420.AdmissionRefs({
                capabilityPolicyId: bytes32(0),
                capabilityAttestationId: bytes32(0),
                trustPolicyId: bytes32(0),
                trustReference: bytes32(0),
                stakePolicyId: STAKE_POLICY,
                stakeReference: STAKE_REFERENCE
            });

        snapshots.setAssignment(
            ASSIGNMENT,
            IComputeWorkerConflictSnapshot420.Assignment({
                jobId: JOB,
                matchId: keccak256("match"),
                acceptanceRef: keccak256("accept"),
                workerId: WORKER_ID,
                workerRevision: 4,
                providerId: keccak256("provider"),
                nodeId: keccak256("node"),
                resourceId: keccak256("resource"),
                resourceRevision: 3,
                operator: address(0xA11CE),
                executionSigner: signer,
                executionKeyCommitment: keccak256("execution-key"),
                capabilityProfileHash: keccak256("capability"),
                jurisdictionHash: keccak256("jurisdiction"),
                admission: admission,
                snapshotCommitment: keccak256("snapshot"),
                reservationId: keccak256("reservation"),
                attempt: 2,
                resultCommitment: bytes32(0),
                receiptHash: bytes32(0),
                exists: true
            })
        );
    }

    function _sig(bytes32 digest) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(EXEC_KEY, digest);
        return abi.encodePacked(r, s, v);
    }

    function _submit(bytes32 receiptA, bytes32 outputA, bytes32 receiptB, bytes32 outputB)
        private
        returns (bytes32 evidenceRef)
    {
        bytes32 digestA = snapshots.resultExecutionDigest(JOB, receiptA, outputA);
        bytes32 digestB = snapshots.resultExecutionDigest(JOB, receiptB, outputB);
        evidenceRef = adapter.submit(
            JOB,
            receiptA,
            outputA,
            _sig(digestA),
            receiptB,
            outputB,
            _sig(digestB)
        );
    }

    function testTwoConflictingSignedResultsProduceOneObjectiveMisconductRecord() public {
        bytes32 evidenceRef = _submit(
            keccak256("receipt-a"),
            keccak256("output-a"),
            keccak256("receipt-b"),
            keccak256("output-b")
        );

        IComputeObjectiveSlashEvidence420.Evidence memory e = adapter.slashEvidence(evidenceRef);
        require(e.finalObjective && e.subjectKind == 1, "objective worker evidence");
        require(e.subjectRef == WORKER_ID, "worker id");
        require(e.subjectAccount == address(0xA11CE), "operator");
        require(e.stakePolicyId == STAKE_POLICY, "stake policy");
        require(e.violationCode == adapter.VIOLATION_CODE(), "violation");
        require(e.misconductKey != bytes32(0) && e.evidenceCommitment != bytes32(0), "commitments");

        ComputeWorkerConflictingResultSlashEvidence420.Record memory r =
            adapter.record(evidenceRef);
        require(
            r.assignmentRef == ASSIGNMENT
                && r.workerRevision == 4
                && r.attempt == 2
                && r.stakePolicyId == STAKE_POLICY,
            "record binding"
        );
    }

    function testIdenticalResultDoesNotCreateMisconduct() public {
        bytes32 receipt = keccak256("same-receipt");
        bytes32 output = keccak256("same-output");
        bytes32 digest = snapshots.resultExecutionDigest(JOB, receipt, output);

        (bool ok,) = address(adapter).call(
            abi.encodeCall(
                adapter.submit,
                (JOB, receipt, output, _sig(digest), receipt, output, _sig(digest))
            )
        );
        require(!ok, "identical result treated as conflict");
    }

    function testWrongExecutionSignatureFailsClosed() public {
        bytes32 receiptA = keccak256("receipt-a");
        bytes32 outputA = keccak256("output-a");
        bytes32 receiptB = keccak256("receipt-b");
        bytes32 outputB = keccak256("output-b");
        bytes32 digestA = snapshots.resultExecutionDigest(JOB, receiptA, outputA);
        bytes32 digestB = snapshots.resultExecutionDigest(JOB, receiptB, outputB);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xCAFE, digestB);
        bytes memory wrong = abi.encodePacked(r, s, v);

        (bool ok,) = address(adapter).call(
            abi.encodeCall(
                adapter.submit,
                (JOB, receiptA, outputA, _sig(digestA), receiptB, outputB, wrong)
            )
        );
        require(!ok, "wrong signer admitted");
    }

    function testSwappedPairCannotCreateSecondSlashEvent() public {
        bytes32 receiptA = keccak256("receipt-a");
        bytes32 outputA = keccak256("output-a");
        bytes32 receiptB = keccak256("receipt-b");
        bytes32 outputB = keccak256("output-b");

        _submit(receiptA, outputA, receiptB, outputB);

        bytes32 digestA = snapshots.resultExecutionDigest(JOB, receiptA, outputA);
        bytes32 digestB = snapshots.resultExecutionDigest(JOB, receiptB, outputB);
        (bool ok,) = address(adapter).call(
            abi.encodeCall(
                adapter.submit,
                (JOB, receiptB, outputB, _sig(digestB), receiptA, outputA, _sig(digestA))
            )
        );
        require(!ok, "swapped replay admitted");
    }

    function testMissingStakeBindingCannotBecomeSlashEvidence() public {
        IComputeWorkerConflictSnapshot420.Assignment memory a =
            snapshots.getAssignment(ASSIGNMENT);
        a.admission.stakePolicyId = bytes32(0);
        a.admission.stakeReference = bytes32(0);
        snapshots.setAssignment(ASSIGNMENT, a);

        bytes32 receiptA = keccak256("receipt-a");
        bytes32 outputA = keccak256("output-a");
        bytes32 receiptB = keccak256("receipt-b");
        bytes32 outputB = keccak256("output-b");
        bytes32 digestA = snapshots.resultExecutionDigest(JOB, receiptA, outputA);
        bytes32 digestB = snapshots.resultExecutionDigest(JOB, receiptB, outputB);

        (bool ok,) = address(adapter).call(
            abi.encodeCall(
                adapter.submit,
                (JOB, receiptA, outputA, _sig(digestA), receiptB, outputB, _sig(digestB))
            )
        );
        require(!ok, "unbound worker stake slashed");
    }
}
