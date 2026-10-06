// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/IComputeExternalContributionAdapter420.sol";
import "../src/compute/ComputeFoldingAtHomeAdapter420.sol";
import "../src/compute/ComputeBoincAdapter420.sol";
import "../src/compute/ComputeResearchClusterAdapter420.sol";
import "../src/compute/ComputeUniversityHpcGateway420.sol";

contract ComputeExternalContributionAdapters420Test {
    function testExternalAdapterFamiliesExposeCommonIdentitySurfaceAndRemainDomainSeparated() public {
        ComputeFoldingAtHomeAdapter420 folding = new ComputeFoldingAtHomeAdapter420();
        ComputeBoincAdapter420 boinc = new ComputeBoincAdapter420();
        ComputeResearchClusterAdapter420 cluster = new ComputeResearchClusterAdapter420();
        ComputeUniversityHpcGateway420 hpc = new ComputeUniversityHpcGateway420();

        IComputeExternalContributionAdapter420 foldingSurface =
            IComputeExternalContributionAdapter420(address(folding));
        IComputeExternalContributionAdapter420 boincSurface =
            IComputeExternalContributionAdapter420(address(boinc));
        IComputeExternalContributionAdapter420 clusterSurface =
            IComputeExternalContributionAdapter420(address(cluster));
        IComputeExternalContributionAdapter420 hpcSurface =
            IComputeExternalContributionAdapter420(address(hpc));

        require(foldingSurface.adapterKind() != bytes32(0), "folding kind missing");
        require(boincSurface.adapterKind() != bytes32(0), "boinc kind missing");
        require(clusterSurface.adapterKind() != bytes32(0), "cluster kind missing");
        require(hpcSurface.adapterKind() != bytes32(0), "hpc kind missing");
        require(foldingSurface.externalSystemId() != bytes32(0), "folding system missing");
        require(boincSurface.externalSystemId() != bytes32(0), "boinc system missing");
        require(clusterSurface.externalSystemId() != bytes32(0), "cluster system missing");
        require(hpcSurface.externalSystemId() != bytes32(0), "hpc system missing");
        require(foldingSurface.protocolCommitment() != bytes32(0), "folding protocol missing");
        require(boincSurface.protocolCommitment() != bytes32(0), "boinc protocol missing");
        require(clusterSurface.protocolCommitment() != bytes32(0), "cluster protocol missing");
        require(hpcSurface.protocolCommitment() != bytes32(0), "hpc protocol missing");

        require(foldingSurface.adapterKind() != boincSurface.adapterKind(), "adapter kinds collided");
        require(foldingSurface.adapterKind() != clusterSurface.adapterKind(), "folding/cluster kind collided");
        require(boincSurface.adapterKind() != clusterSurface.adapterKind(), "boinc/cluster kind collided");
        require(hpcSurface.adapterKind() != foldingSurface.adapterKind(), "hpc/folding kind collided");
        require(hpcSurface.adapterKind() != boincSurface.adapterKind(), "hpc/boinc kind collided");
        require(hpcSurface.adapterKind() != clusterSurface.adapterKind(), "hpc/cluster kind collided");
        require(
            foldingSurface.externalSystemId() != boincSurface.externalSystemId(),
            "external systems collided"
        );
        require(
            foldingSurface.externalSystemId() != clusterSurface.externalSystemId()
                && boincSurface.externalSystemId() != clusterSurface.externalSystemId(),
            "cluster external system collided"
        );
        require(
            hpcSurface.externalSystemId() != foldingSurface.externalSystemId()
                && hpcSurface.externalSystemId() != boincSurface.externalSystemId()
                && hpcSurface.externalSystemId() != clusterSurface.externalSystemId(),
            "hpc external system collided"
        );
        require(
            foldingSurface.protocolCommitment() != boincSurface.protocolCommitment(),
            "protocol commitments collided"
        );
        require(
            foldingSurface.protocolCommitment() != clusterSurface.protocolCommitment()
                && boincSurface.protocolCommitment() != clusterSurface.protocolCommitment(),
            "cluster protocol commitment collided"
        );
        require(
            hpcSurface.protocolCommitment() != foldingSurface.protocolCommitment()
                && hpcSurface.protocolCommitment() != boincSurface.protocolCommitment()
                && hpcSurface.protocolCommitment() != clusterSurface.protocolCommitment(),
            "hpc protocol commitment collided"
        );
    }

    function testSharedSurfaceDoesNotCreateCrossAdapterNormalizationAuthority() public {
        ComputeFoldingAtHomeAdapter420 folding = new ComputeFoldingAtHomeAdapter420();
        ComputeBoincAdapter420 boinc = new ComputeBoincAdapter420();
        ComputeResearchClusterAdapter420 cluster = new ComputeResearchClusterAdapter420();

        require(
            address(folding) != address(boinc)
                && folding.externalSystemId() != boinc.externalSystemId(),
            "adapter identity collapsed"
        );
        require(
            address(cluster) != address(folding)
                && address(cluster) != address(boinc)
                && cluster.externalSystemId() != folding.externalSystemId()
                && cluster.externalSystemId() != boinc.externalSystemId(),
            "cluster adapter identity collapsed"
        );
        require(
            address(hpc) != address(folding)
                && address(hpc) != address(boinc)
                && address(hpc) != address(cluster)
                && hpc.externalSystemId() != folding.externalSystemId()
                && hpc.externalSystemId() != boinc.externalSystemId()
                && hpc.externalSystemId() != cluster.externalSystemId(),
            "hpc adapter identity collapsed"
        );
    }
}
