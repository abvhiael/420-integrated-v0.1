// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeWorkerReleaseCandidateWiring420.sol";
import "../src/compute/ComputeProviderRegistry420.sol";
import "../src/compute/ComputeNodeRegistry420.sol";
import "../src/compute/ComputeResourceRegistry420.sol";
import "../src/compute/IComputeAcceptedMatchRuntime420.sol";
import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/interfaces/ITrust420.sol";

contract RCWiringCapabilityRegistryMock420 is ICapabilityRegistry420 {
    function grant(bytes32) external pure returns (CapabilityGrant memory out) { return out; }
    function isAuthorized(address, bytes32, bytes32, bytes32, uint256) external pure returns (bool) { return true; }
}

contract RCWiringTrustMock420 is ITrust420 {
    function readMetric(bytes32, bytes32, bytes32) external pure returns (MetricRead memory out) { return out; }
}

contract RCWiringCommonEvidence420 is
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

contract RCWiringMatchMock420 is IComputeJobMatchEvidence420, IComputeAcceptedMatchRuntime420 {
    address public override jobs;
    function setJobs(address jobs_) external { jobs = jobs_; }
    function matched(bytes32,bytes32,bytes32,bytes32) external pure returns (bool) { return true; }
    function accepted(bytes32,bytes32,bytes32) external pure returns (bool) { return true; }
    function authorizedResource(bytes32,bytes32,bytes32,bytes32,address) external pure returns (bool) { return true; }
    function matchParties(bytes32) external pure returns (bytes32,address,address,bool) {
        return (bytes32(0),address(0),address(0),true);
    }
}

contract ComputeWorkerReleaseCandidateWiring420Test {
    address private constant GOV = address(0x420);

    ComputeProviderRegistry420 private providers;
    ComputeNodeRegistry420 private nodes;
    ComputeResourceRegistry420 private resources;
    ComputeAuthorization420 private authorization;
    ComputeWorkerRegistry420 private workers;
    ComputeWorkerCapabilityProfile420 private profiles;
    ComputeWorkerAttestation420 private attestation;
    ComputeWorkerAttestedEligibility420 private attestedEligibility;
    ComputeWorkerCapabilityEligibility420 private capabilityEligibility;
    ComputeWorkerTrust420 private workerTrust;
    ComputeWorkerStake420 private workerStake;
    ComputeWorkerCapacityReservation420 private capacity;
    RCWiringMatchMock420 private matches;
    RCWiringCommonEvidence420 private common;
    ComputeJobWorkerSnapshotEvidence420 private workerEvidence;
    ComputeJobRegistry420 private jobs;
    ComputeWorkerReadModel420 private readModel;

    function setUp() public {
        providers = new ComputeProviderRegistry420(GOV);
        nodes = new ComputeNodeRegistry420(address(providers), GOV);
        resources = new ComputeResourceRegistry420(address(nodes), GOV);
        authorization = new ComputeAuthorization420(address(new RCWiringCapabilityRegistryMock420()));
        workers = new ComputeWorkerRegistry420(address(resources), address(authorization), GOV);
        profiles = new ComputeWorkerCapabilityProfile420(address(workers));
        attestation = new ComputeWorkerAttestation420(address(workers), GOV);
        attestedEligibility = new ComputeWorkerAttestedEligibility420(address(workers), address(attestation));
        capabilityEligibility = new ComputeWorkerCapabilityEligibility420(address(profiles), address(attestedEligibility));
        workerTrust = new ComputeWorkerTrust420(address(workers), address(new RCWiringTrustMock420()), GOV);
        workerStake = new ComputeWorkerStake420(address(workers), GOV);
        capacity = new ComputeWorkerCapacityReservation420(address(workers));
        matches = new RCWiringMatchMock420();
        common = new RCWiringCommonEvidence420();

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

        readModel = new ComputeWorkerReadModel420(
            address(workers),
            address(profiles),
            address(capabilityEligibility),
            address(attestation),
            address(workerTrust),
            address(workerStake),
            address(capacity),
            address(workerEvidence)
        );
    }

    function _hashes() private view returns (ComputeWorkerReleaseCandidateWiring420.CodeHashes memory h) {
        h = ComputeWorkerReleaseCandidateWiring420.CodeHashes({
            jobs: address(jobs).codehash,
            workerEvidence: address(workerEvidence).codehash,
            authorization: address(authorization).codehash,
            workers: address(workers).codehash,
            profiles: address(profiles).codehash,
            attestedEligibility: address(attestedEligibility).codehash,
            capabilityEligibility: address(capabilityEligibility).codehash,
            attestation: address(attestation).codehash,
            trust: address(workerTrust).codehash,
            stake: address(workerStake).codehash,
            capacity: address(capacity).codehash,
            readModel: address(readModel).codehash
        });
    }

    function _deploy(
        address profiles_,
        address capabilityEligibility_,
        address readModel_,
        address governance_,
        ComputeWorkerReleaseCandidateWiring420.CodeHashes memory h
    ) private returns (ComputeWorkerReleaseCandidateWiring420) {
        return new ComputeWorkerReleaseCandidateWiring420(
            address(jobs),
            address(workerEvidence),
            address(authorization),
            address(workers),
            profiles_,
            address(attestedEligibility),
            capabilityEligibility_,
            address(attestation),
            address(workerTrust),
            address(workerStake),
            address(capacity),
            readModel_,
            governance_,
            h
        );
    }

    function testExactHardenedReleaseGraphPasses() public {
        ComputeWorkerReleaseCandidateWiring420 wiring =
            _deploy(address(profiles), address(capabilityEligibility), address(readModel), GOV, _hashes());
        wiring.assertWiring();
        require(wiring.graphHash() != bytes32(0), "graph hash missing");
    }

    function testWrongReadModelRuntimeHashFailsClosed() public {
        ComputeWorkerReleaseCandidateWiring420.CodeHashes memory h = _hashes();
        h.readModel = keccak256("wrong-read-model");
        try this.deployExternal(address(profiles), address(capabilityEligibility), address(readModel), GOV, h) {
            revert("wrong read model hash accepted");
        } catch {}
    }

    function testMismatchedReadModelGraphFailsClosed() public {
        ComputeWorkerCapabilityProfile420 alternateProfiles = new ComputeWorkerCapabilityProfile420(address(workers));
        ComputeWorkerCapabilityEligibility420 alternateEligibility =
            new ComputeWorkerCapabilityEligibility420(address(alternateProfiles), address(attestedEligibility));
        ComputeWorkerReadModel420 alternateReadModel = new ComputeWorkerReadModel420(
            address(workers),
            address(alternateProfiles),
            address(alternateEligibility),
            address(attestation),
            address(workerTrust),
            address(workerStake),
            address(capacity),
            address(workerEvidence)
        );
        ComputeWorkerReleaseCandidateWiring420.CodeHashes memory h = _hashes();
        h.readModel = address(alternateReadModel).codehash;
        try this.deployExternal(
            address(profiles), address(capabilityEligibility), address(alternateReadModel), GOV, h
        ) {
            revert("mismatched read graph accepted");
        } catch {}
    }

    function testWrongGovernanceFailsClosed() public {
        ComputeWorkerReleaseCandidateWiring420.CodeHashes memory h = _hashes();
        try this.deployExternal(
            address(profiles), address(capabilityEligibility), address(readModel), address(0xBAD), h
        ) {
            revert("wrong governance accepted");
        } catch {}
    }

    function deployExternal(
        address profiles_,
        address capabilityEligibility_,
        address readModel_,
        address governance_,
        ComputeWorkerReleaseCandidateWiring420.CodeHashes calldata h
    ) external returns (ComputeWorkerReleaseCandidateWiring420) {
        return _deploy(profiles_, capabilityEligibility_, readModel_, governance_, h);
    }
}
