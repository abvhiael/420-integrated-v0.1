// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeVerifierRegistry420.sol";
import "../src/compute/ComputeVerifierCapabilityRegistry420.sol";

interface VmComputeVerifierCapability420 {
    function prank(address caller) external;
}

contract ComputeVerifierCapabilityRegistry420Test {
    VmComputeVerifierCapability420 private constant vm =
        VmComputeVerifierCapability420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant GOV = address(0x420);
    address private constant VERIFIER = address(0xA11CE);
    address private constant OUTSIDER = address(0xBAD);

    bytes32 private constant REGISTRATION = keccak256("verifier-registration");
    bytes32 private constant GPU_INFERENCE = keccak256("GPU_INFERENCE");
    bytes32 private constant CPU_GENERAL = keccak256("CPU_GENERAL");
    bytes32 private constant EVIDENCE_A = keccak256("qualification/evidence/a");
    bytes32 private constant EVIDENCE_B = keccak256("qualification/evidence/b");

    ComputeVerifierRegistry420 private verifiers;
    ComputeVerifierCapabilityRegistry420 private capabilities;
    bytes32 private verifierId;

    function setUp() public {
        verifiers = new ComputeVerifierRegistry420(GOV);
        capabilities = new ComputeVerifierCapabilityRegistry420(address(verifiers), GOV);

        vm.prank(VERIFIER);
        verifierId = verifiers.register(REGISTRATION);
        vm.prank(GOV);
        verifiers.activate(verifierId);
    }

    function _revision() private view returns (uint64) {
        return verifiers.verifier(verifierId).revision;
    }

    function testInitialClassVocabularyIsIndependentlyTyped() public view {
        bytes32 protocolClass = capabilities.PROTOCOL_VERIFIER();
        bytes32 independentClass = capabilities.INDEPENDENT_VERIFIER();
        bytes32 jobOwnerClass = capabilities.JOB_OWNER_VERIFIER();
        bytes32 oracleClass = capabilities.ORACLE_VERIFIER();
        bytes32 teeClass = capabilities.TEE_VERIFIER();
        bytes32 committeeClass = capabilities.COMMITTEE_VERIFIER();

        require(protocolClass != independentClass, "protocol/independent collision");
        require(independentClass != jobOwnerClass, "independent/job-owner collision");
        require(jobOwnerClass != oracleClass, "job-owner/oracle collision");
        require(oracleClass != teeClass, "oracle/tee collision");
        require(teeClass != committeeClass, "tee/committee collision");

        require(capabilities.isKnownVerifierClass(protocolClass), "protocol class unknown");
        require(capabilities.isKnownVerifierClass(independentClass), "independent class unknown");
        require(capabilities.isKnownVerifierClass(jobOwnerClass), "job-owner class unknown");
        require(capabilities.isKnownVerifierClass(oracleClass), "oracle class unknown");
        require(capabilities.isKnownVerifierClass(teeClass), "tee class unknown");
        require(capabilities.isKnownVerifierClass(committeeClass), "committee class unknown");
        require(!capabilities.isKnownVerifierClass(keccak256("UNKNOWN_VERIFIER")), "unknown class accepted");
    }

    function testGovernanceCanQualifyExactClassAndWorkloadOnly() public {
        bytes32 independentClass = capabilities.INDEPENDENT_VERIFIER();

        vm.prank(GOV);
        capabilities.setCapability(verifierId, independentClass, GPU_INFERENCE, true, EVIDENCE_A);

        require(
            capabilities.isCapable(verifierId, VERIFIER, _revision(), independentClass, GPU_INFERENCE),
            "qualified tuple not capable"
        );
        require(
            !capabilities.isCapable(verifierId, VERIFIER, _revision(), independentClass, CPU_GENERAL),
            "workload capability broadened"
        );
        require(
            !capabilities.isCapable(
                verifierId,
                VERIFIER,
                _revision(),
                capabilities.ORACLE_VERIFIER(),
                GPU_INFERENCE
            ),
            "verifier class broadened"
        );
    }

    function testDifferentClassesAndWorkloadsAreIndependent() public {
        bytes32 independentClass = capabilities.INDEPENDENT_VERIFIER();
        bytes32 oracleClass = capabilities.ORACLE_VERIFIER();

        vm.prank(GOV);
        capabilities.setCapability(verifierId, independentClass, GPU_INFERENCE, true, EVIDENCE_A);
        vm.prank(GOV);
        capabilities.setCapability(verifierId, oracleClass, CPU_GENERAL, true, EVIDENCE_B);

        require(
            capabilities.isCapable(verifierId, VERIFIER, _revision(), independentClass, GPU_INFERENCE),
            "independent gpu missing"
        );
        require(
            capabilities.isCapable(verifierId, VERIFIER, _revision(), oracleClass, CPU_GENERAL),
            "oracle cpu missing"
        );
        require(
            !capabilities.isCapable(verifierId, VERIFIER, _revision(), oracleClass, GPU_INFERENCE),
            "cross-class workload inherited"
        );
    }

    function testUnauthorizedUnknownZeroAndRetiredMutationsFailClosed() public {
        bytes32 independentClass = capabilities.INDEPENDENT_VERIFIER();

        vm.prank(OUTSIDER);
        (bool ok,) = address(capabilities).call(
            abi.encodeCall(
                capabilities.setCapability,
                (verifierId, independentClass, GPU_INFERENCE, true, EVIDENCE_A)
            )
        );
        require(!ok, "outsider qualified verifier");

        vm.prank(GOV);
        (ok,) = address(capabilities).call(
            abi.encodeCall(
                capabilities.setCapability,
                (verifierId, keccak256("UNKNOWN"), GPU_INFERENCE, true, EVIDENCE_A)
            )
        );
        require(!ok, "unknown verifier class accepted");

        vm.prank(GOV);
        (ok,) = address(capabilities).call(
            abi.encodeCall(
                capabilities.setCapability,
                (verifierId, independentClass, bytes32(0), true, EVIDENCE_A)
            )
        );
        require(!ok, "zero workload accepted");

        vm.prank(GOV);
        (ok,) = address(capabilities).call(
            abi.encodeCall(
                capabilities.setCapability,
                (verifierId, independentClass, GPU_INFERENCE, true, bytes32(0))
            )
        );
        require(!ok, "zero evidence accepted");

        vm.prank(GOV);
        verifiers.retire(verifierId);

        vm.prank(GOV);
        (ok,) = address(capabilities).call(
            abi.encodeCall(
                capabilities.setCapability,
                (verifierId, independentClass, GPU_INFERENCE, true, EVIDENCE_A)
            )
        );
        require(!ok, "retired verifier capability mutated");
    }

    function testCapabilityRequiresCurrentActiveVerifierIdentityAndRevision() public {
        bytes32 independentClass = capabilities.INDEPENDENT_VERIFIER();

        vm.prank(GOV);
        capabilities.setCapability(verifierId, independentClass, GPU_INFERENCE, true, EVIDENCE_A);

        uint64 activeRevision = _revision();
        require(
            capabilities.isCapable(verifierId, VERIFIER, activeRevision, independentClass, GPU_INFERENCE),
            "baseline capability unavailable"
        );

        vm.prank(VERIFIER);
        verifiers.suspend(verifierId);

        require(
            !capabilities.isCapable(verifierId, VERIFIER, activeRevision, independentClass, GPU_INFERENCE),
            "suspension ignored"
        );

        vm.prank(GOV);
        verifiers.activate(verifierId);
        uint64 reactivatedRevision = _revision();

        require(
            !capabilities.isCapable(verifierId, VERIFIER, activeRevision, independentClass, GPU_INFERENCE),
            "stale verifier revision accepted"
        );
        require(
            capabilities.isCapable(verifierId, VERIFIER, reactivatedRevision, independentClass, GPU_INFERENCE),
            "reactivated qualified verifier unavailable"
        );
    }

    function testRevocationIsVersionedAndHistoricalQualificationPreserved() public {
        bytes32 independentClass = capabilities.INDEPENDENT_VERIFIER();

        vm.prank(GOV);
        capabilities.setCapability(verifierId, independentClass, GPU_INFERENCE, true, EVIDENCE_A);

        vm.prank(GOV);
        capabilities.setCapability(verifierId, independentClass, GPU_INFERENCE, false, EVIDENCE_B);

        ComputeVerifierCapabilityRegistry420.Capability memory current =
            capabilities.capability(verifierId, independentClass, GPU_INFERENCE);
        ComputeVerifierCapabilityRegistry420.Capability memory first =
            capabilities.capabilityRevision(verifierId, independentClass, GPU_INFERENCE, 1);
        ComputeVerifierCapabilityRegistry420.Capability memory second =
            capabilities.capabilityRevision(verifierId, independentClass, GPU_INFERENCE, 2);

        require(!current.enabled && current.revision == 2, "revocation missing");
        require(first.enabled && first.evidenceHash == EVIDENCE_A, "qualified history rewritten");
        require(!second.enabled && second.evidenceHash == EVIDENCE_B, "revocation evidence missing");
        require(
            !capabilities.isCapable(verifierId, VERIFIER, _revision(), independentClass, GPU_INFERENCE),
            "revoked tuple remained capable"
        );
    }
}
