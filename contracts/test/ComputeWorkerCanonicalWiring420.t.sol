// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeWorkerCanonicalWiring420.sol";
import "../src/compute/ComputeProviderRegistry420.sol";
import "../src/compute/ComputeNodeRegistry420.sol";
import "../src/compute/ComputeResourceRegistry420.sol";
import "../src/compute/ComputeWorkerRegistry420.sol";
import "../src/compute/ComputeWorkerAttestation420.sol";
import "../src/compute/ComputeWorkerTrust420.sol";
import "../src/compute/ComputeWorkerStake420.sol";
import "../src/compute/ComputeWorkerCapacityReservation420.sol";
import "../src/compute/ComputeAuthorization420.sol";
import "../src/compute/IComputeAcceptedMatchRuntime420.sol";
import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/interfaces/ITrust420.sol";

contract WiringCapabilityRegistryMock420 is ICapabilityRegistry420 {
    function grant(bytes32) external pure returns (CapabilityGrant memory out) { return out; }
    function isAuthorized(address, bytes32, bytes32, bytes32, uint256) external pure returns (bool) {
        return true;
    }
}

contract WiringTrustMock420 is ITrust420 {
    function readMetric(bytes32, bytes32, bytes32) external pure returns (MetricRead memory out) {
        return out;
    }
}

contract WiringCommonEvidence420 is
    IComputeJobRequestEvidence420,
    IComputeJobFundingEvidence420,
    IComputeJobVerificationEvidence420,
    IComputeJobSettlementEvidence420,
    IComputeJobRefundEvidence420
{
    function validRequest(bytes32,address,bytes32,bytes32,bytes32,bytes32,bytes32,uint64)
        external pure returns (bool) { return true; }
    function funded(bytes32,address,bytes32) external pure returns (bool) { return true; }
    function verified(bytes32,bytes32,address,bytes32,bool) external pure returns (bool) { return true; }
    function settled(bytes32,bytes32,bytes32) external pure returns (bool) { return true; }
    function refunded(bytes32,bytes32) external pure returns (bool) { return true; }
}

contract WiringMatchMock420 is IComputeJobMatchEvidence420, IComputeAcceptedMatchRuntime420 {
    address public override jobs;
    function setJobs(address jobs_) external { jobs = jobs_; }
    function matched(bytes32,bytes32,bytes32,bytes32) external pure returns (bool) { return true; }
    function accepted(bytes32,bytes32,bytes32) external pure returns (bool) { return true; }
    function authorizedResource(bytes32,bytes32,bytes32,bytes32,address) external pure returns (bool) { return true; }
    function matchParties(bytes32)
        external pure returns (bytes32,address,address,bool)
    { return (bytes32(0),address(0),address(0),true); }
}

contract ComputeWorkerCanonicalWiring420Test {
    address private constant GOV = address(0x420);

    ComputeProviderRegistry420 private providers;
    ComputeNodeRegistry420 private nodes;
    ComputeResourceRegistry420 private resources;
    ComputeWorkerRegistry420 private workers;
    ComputeWorkerAttestation420 private attestation;
    ComputeWorkerTrust420 private workerTrust;
    ComputeWorkerStake420 private workerStake;
    ComputeWorkerCapacityReservation420 private capacity;
    ComputeAuthorization420 private authorization;
    WiringMatchMock420 private matches;
    ComputeJobWorkerSnapshotEvidence420 private workerEvidence;
    ComputeJobRegistry420 private jobs;
    WiringCommonEvidence420 private common;

    function setUp() public {
        providers = new ComputeProviderRegistry420(GOV);
        nodes = new ComputeNodeRegistry420(address(providers), GOV);
        resources = new ComputeResourceRegistry420(address(nodes), GOV);
        authorization = new ComputeAuthorization420(address(new WiringCapabilityRegistryMock420()));
        workers = new ComputeWorkerRegistry420(address(resources), address(authorization), GOV);
        attestation = new ComputeWorkerAttestation420(address(workers), GOV);
        workerTrust = new ComputeWorkerTrust420(address(workers), address(new WiringTrustMock420()), GOV);
        workerStake = new ComputeWorkerStake420(address(workers), GOV);
        capacity = new ComputeWorkerCapacityReservation420(address(workers));
        matches = new WiringMatchMock420();
        common = new WiringCommonEvidence420();

        workerEvidence = new ComputeJobWorkerSnapshotEvidence420(
            address(matches),
            address(authorization),
            address(workers),
            address(attestation),
            address(workerTrust),
            address(workerStake),
            address(capacity)
        );

        jobs = new ComputeJobRegistry420(
            address(common),
            address(common),
            address(matches),
            address(workerEvidence),
            address(common),
            address(common)
        );

        matches.setJobs(address(jobs));
        workerEvidence.bindJobs(address(jobs));
        capacity.bindController(address(workerEvidence));
    }

    function _hashes() private view returns (ComputeWorkerCanonicalWiring420.CodeHashes memory h) {
        h = ComputeWorkerCanonicalWiring420.CodeHashes({
            jobs: address(jobs).codehash,
            workerEvidence: address(workerEvidence).codehash,
            workers: address(workers).codehash,
            attestation: address(attestation).codehash,
            trust: address(workerTrust).codehash,
            stake: address(workerStake).codehash,
            capacity: address(capacity).codehash
        });
    }

    function deployWiring(
        address jobs_,
        address workerEvidence_,
        address workers_,
        address attestation_,
        address trust_,
        address stake_,
        address capacity_,
        address governance_,
        ComputeWorkerCanonicalWiring420.CodeHashes calldata hashes_
    ) external returns (address deployed) {
        deployed = address(new ComputeWorkerCanonicalWiring420(
            jobs_, workerEvidence_, workers_, attestation_, trust_, stake_, capacity_, governance_, hashes_
        ));
    }

    function testExactQualifiedGraphAndCodeHashesPass() public {
        ComputeWorkerCanonicalWiring420 wiring = new ComputeWorkerCanonicalWiring420(
            address(jobs),
            address(workerEvidence),
            address(workers),
            address(attestation),
            address(workerTrust),
            address(workerStake),
            address(capacity),
            GOV,
            _hashes()
        );
        wiring.assertWiring();
        require(wiring.graphHash() != bytes32(0), "graph hash missing");
    }

    function testWrongRuntimeHashFailsClosed() public {
        ComputeWorkerCanonicalWiring420.CodeHashes memory h = _hashes();
        h.workers = keccak256("wrong");

        (bool ok,) = address(this).call(
            abi.encodeCall(
                this.deployWiring,
                (
                    address(jobs),
                    address(workerEvidence),
                    address(workers),
                    address(attestation),
                    address(workerTrust),
                    address(workerStake),
                    address(capacity),
                    GOV,
                    h
                )
            )
        );
        require(!ok, "wrong code hash accepted");
    }

    function testWrongGovernanceFailsClosed() public {
        ComputeWorkerCanonicalWiring420.CodeHashes memory h = _hashes();
        (bool ok,) = address(this).call(
            abi.encodeCall(
                this.deployWiring,
                (
                    address(jobs),
                    address(workerEvidence),
                    address(workers),
                    address(attestation),
                    address(workerTrust),
                    address(workerStake),
                    address(0xBAD),
                    h
                )
            )
        );
        require(!ok, "wrong governance accepted");
    }

    function testUnboundSnapshotEvidenceFailsClosed() public {
        ComputeJobWorkerSnapshotEvidence420 unbound = new ComputeJobWorkerSnapshotEvidence420(
            address(matches),
            address(authorization),
            address(workers),
            address(attestation),
            address(workerTrust),
            address(workerStake),
            address(capacity)
        );
        ComputeWorkerCanonicalWiring420.CodeHashes memory h = _hashes();
        h.workerEvidence = address(unbound).codehash;

        (bool ok,) = address(this).call(
            abi.encodeCall(
                this.deployWiring,
                (
                    address(jobs),
                    address(unbound),
                    address(workers),
                    address(attestation),
                    address(workerTrust),
                    address(workerStake),
                    address(capacity),
                    GOV,
                    h
                )
            )
        );
        require(!ok, "unbound worker evidence accepted");
    }
}
