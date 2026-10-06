// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/IComputeExternalContributionAdapter420.sol";
import "../src/compute/ComputeFoldingAtHomeAdapter420.sol";
import "../src/compute/ComputeBoincAdapter420.sol";

contract ComputeExternalContributionAdapters420Test {
    function testExternalAdapterFamiliesExposeCommonIdentitySurfaceAndRemainDomainSeparated() public {
        ComputeFoldingAtHomeAdapter420 folding = new ComputeFoldingAtHomeAdapter420();
        ComputeBoincAdapter420 boinc = new ComputeBoincAdapter420();

        IComputeExternalContributionAdapter420 foldingSurface =
            IComputeExternalContributionAdapter420(address(folding));
        IComputeExternalContributionAdapter420 boincSurface =
            IComputeExternalContributionAdapter420(address(boinc));

        require(foldingSurface.adapterKind() != bytes32(0), "folding kind missing");
        require(boincSurface.adapterKind() != bytes32(0), "boinc kind missing");
        require(foldingSurface.externalSystemId() != bytes32(0), "folding system missing");
        require(boincSurface.externalSystemId() != bytes32(0), "boinc system missing");
        require(foldingSurface.protocolCommitment() != bytes32(0), "folding protocol missing");
        require(boincSurface.protocolCommitment() != bytes32(0), "boinc protocol missing");

        require(foldingSurface.adapterKind() != boincSurface.adapterKind(), "adapter kinds collided");
        require(
            foldingSurface.externalSystemId() != boincSurface.externalSystemId(),
            "external systems collided"
        );
        require(
            foldingSurface.protocolCommitment() != boincSurface.protocolCommitment(),
            "protocol commitments collided"
        );
    }

    function testSharedSurfaceDoesNotCreateCrossAdapterNormalizationAuthority() public {
        ComputeFoldingAtHomeAdapter420 folding = new ComputeFoldingAtHomeAdapter420();
        ComputeBoincAdapter420 boinc = new ComputeBoincAdapter420();

        require(
            address(folding) != address(boinc)
                && folding.externalSystemId() != boinc.externalSystemId(),
            "adapter identity collapsed"
        );
    }
}
