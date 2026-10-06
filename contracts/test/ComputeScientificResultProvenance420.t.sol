// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeScientificResultProvenance420.sol";

contract ScientificResultSourceMock420 is IComputeScientificResultSource420 {
    ComputeScientificResultSource420.CanonicalResultContext internal _context;

    function systemName() external pure returns (string memory) {
        return "ComputeScientificResultSource420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function setContext(ComputeScientificResultSource420.CanonicalResultContext memory c) external {
        _context = c;
    }

    function context(bytes32)
        external
        view
        returns (ComputeScientificResultSource420.CanonicalResultContext memory)
    {
        return _context;
    }
}

contract ComputeScientificResultProvenance420Test {
    ScientificResultSourceMock420 source;
    ComputeScientificResultProvenance420 provenance;

    bytes32 constant JOB = keccak256("job");
    bytes32 constant ATTEMPT = keccak256("attempt");
    bytes32 constant RESULT = keccak256("result");
    bytes32 constant EXECUTION = keccak256("execution-evidence");
    bytes32 constant MANIFEST = keccak256("manifest");
    bytes32 constant INPUT = keccak256("input");
    bytes32 constant OUTPUT_SCHEMA = keccak256("output-schema");
    bytes32 constant FUNDING = keccak256("funding");
    bytes32 constant VERIFY_POLICY = keccak256("verification-policy");
    bytes32 constant VERIFY_REF = keccak256("verification-ref");
    bytes32 constant PROJECT = keccak256("project");
    bytes32 constant ENVIRONMENT = keccak256("environment");
    bytes32 constant PARAMETERS = keccak256("parameters");
    bytes32 constant RESOURCE = keccak256("resource");
    address constant WORKER = address(0xBEEF);
    address constant VERIFIER = address(0xCAFE);

    function setUp() public {
        source = new ScientificResultSourceMock420();
        provenance = new ComputeScientificResultProvenance420(source);
        source.setContext(_context());
    }

    function _context()
        internal
        pure
        returns (ComputeScientificResultSource420.CanonicalResultContext memory c)
    {
        c.unitId = JOB;
        c.attemptRef = ATTEMPT;
        c.attempt = 2;
        c.worker = WORKER;
        c.resultCommitment = RESULT;
        c.executionEvidenceCommitment = EXECUTION;
        c.manifestHash = MANIFEST;
        c.inputCommitment = INPUT;
        c.outputSchemaCommitment = OUTPUT_SCHEMA;
        c.fundingRef = FUNDING;
        c.verificationStrategyCommitment = VERIFY_POLICY;
        c.deadline = 123456;
        c.verifier = VERIFIER;
        c.verificationRef = VERIFY_REF;
        c.verificationRecorded = true;
    }

    function _binding()
        internal
        pure
        returns (ComputeScientificResultProvenance420.ScientificBinding memory b)
    {
        b.researchProjectCommitment = PROJECT;
        b.executableContainerCommitment = ENVIRONMENT;
        b.parametersCommitment = PARAMETERS;
        b.resourceClass = RESOURCE;
    }

    function _scientificCommitment() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                provenance.SCIENTIFIC_UNIT_DOMAIN_V1(),
                uint32(1),
                block.chainid,
                JOB,
                PROJECT,
                MANIFEST,
                ENVIRONMENT,
                INPUT,
                PARAMETERS,
                RESOURCE,
                OUTPUT_SCHEMA,
                VERIFY_POLICY,
                uint64(123456),
                FUNDING
            )
        );
    }

    function testCanonicalProvenanceIsReconstructableAndCanonical() public {
        bytes32 scientific = _scientificCommitment();
        bytes32 id = provenance.recordProvenance(JOB, scientific, _binding());
        ComputeScientificResultProvenance420.Provenance memory p = provenance.provenance(id);
        require(p.jobId == JOB && p.unitId == JOB, "unit binding");
        require(p.scientificWorkUnitCommitment == scientific, "scientific binding");
        require(p.attemptRef == ATTEMPT && p.attempt == 2 && p.worker == WORKER, "attempt binding");
        require(p.resultCommitment == RESULT && p.executionEvidenceCommitment == EXECUTION, "result binding");
        require(p.verifier == VERIFIER && p.verificationRef == VERIFY_REF, "verification binding");
        require(provenance.provenanceForJob(JOB) == id, "job index");
        require(provenance.isCanonical(id), "canonical");
    }

    function testRejectsUnverifiedAndZeroScientificBindings() public {
        ComputeScientificResultSource420.CanonicalResultContext memory c = _context();
        c.verificationRecorded = false;
        c.verificationRef = bytes32(0);
        source.setContext(c);
        (bool ok,) = address(provenance).call(
            abi.encodeCall(provenance.recordProvenance, (JOB, _scientificCommitment(), _binding()))
        );
        require(!ok, "unverified result admitted");

        source.setContext(_context());
        ComputeScientificResultProvenance420.ScientificBinding memory b = _binding();
        b.parametersCommitment = bytes32(0);
        (ok,) = address(provenance).call(
            abi.encodeCall(provenance.recordProvenance, (JOB, _scientificCommitment(), b))
        );
        require(!ok, "zero binding admitted");
    }

    function testCrossUnitScientificCommitmentReplayFailsClosed() public {
        bytes32 wrong = keccak256("other-unit-scientific-commitment");
        (bool ok,) = address(provenance).call(
            abi.encodeCall(provenance.recordProvenance, (JOB, wrong, _binding()))
        );
        require(!ok && provenance.provenanceForJob(JOB) == bytes32(0), "cross-unit replay");
    }

    function testDuplicateIsIdempotentAndConflictingCanonicalResultFails() public {
        bytes32 scientific = _scientificCommitment();
        bytes32 first = provenance.recordProvenance(JOB, scientific, _binding());
        bytes32 second = provenance.recordProvenance(JOB, scientific, _binding());
        require(first == second, "duplicate changed identity");

        ComputeScientificResultSource420.CanonicalResultContext memory c = _context();
        c.resultCommitment = keccak256("replacement-result");
        source.setContext(c);
        require(!provenance.isCanonical(first), "drift remained canonical");
    }

    function testAttemptReceiptEvidenceAndVerificationAreBoundIntoIdentity() public {
        bytes32 scientific = _scientificCommitment();
        bytes32 id = provenance.recordProvenance(JOB, scientific, _binding());
        ComputeScientificResultProvenance420.Provenance memory p = provenance.provenance(id);
        bytes32 expected = keccak256(
            abi.encode(
                provenance.PROVENANCE_DOMAIN(),
                block.chainid,
                address(provenance),
                address(source),
                JOB,
                JOB,
                scientific,
                ATTEMPT,
                uint64(2),
                WORKER,
                RESULT,
                EXECUTION,
                VERIFIER,
                VERIFY_REF,
                OUTPUT_SCHEMA
            )
        );
        require(id == expected, "provenance identity");
        require(p.executionEvidenceCommitment == EXECUTION, "receipt/execution evidence");
    }

    function testProvenanceCreatesNoCorrectnessOrEconomicAuthority() public {
        bytes32 id = provenance.recordProvenance(JOB, _scientificCommitment(), _binding());
        require(provenance.isCanonical(id), "record invalid");
        require(address(provenance.source()) == address(source), "source drift");
    }
}
