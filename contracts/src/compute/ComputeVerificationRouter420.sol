// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/SystemAccess.sol";
import "./ComputeJobRegistry420.sol";
import "./ComputeRequestRegistry420.sol";

interface IComputeVerifier420 {
    function verify(bytes32 jobId, bytes32 evidenceRef) external view returns (bool);
}

contract ComputeVerificationRouter420 is SystemAccess, I420System {
    ComputeJobRegistry420 public immutable jobs;
    ComputeRequestRegistry420 public immutable requests;
    mapping(bytes32 => address) public verifierByProfile;

    error InvalidVerifier();
    error VerificationFailed();

    event VerifierConfigured(bytes32 indexed profileId, address indexed verifier);
    event JobVerified(bytes32 indexed jobId, bytes32 indexed profileId, bytes32 evidenceRef);

    constructor(address timelock_, address jobs_, address requests_) SystemAccess(timelock_) {
        if (jobs_ == address(0) || requests_ == address(0)) revert ZeroAddress();
        jobs = ComputeJobRegistry420(jobs_);
        requests = ComputeRequestRegistry420(requests_);
    }

    function systemName() external pure returns (string memory) { return "ComputeVerificationRouter420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function setVerifier(bytes32 profileId, address verifier) external onlyGovernance {
        if (profileId == bytes32(0) || verifier == address(0)) revert InvalidVerifier();
        verifierByProfile[profileId] = verifier;
        emit VerifierConfigured(profileId, verifier);
    }

    function verify(bytes32 jobId, bytes32 evidenceRef) external returns (bool) {
        ComputeJobRegistry420.Job memory j = jobs.getJob(jobId);
        ComputeRequestRegistry420.Request memory r = requests.getRequest(j.requestId);
        address verifier = verifierByProfile[r.verificationProfileId];
        if (verifier == address(0) || !IComputeVerifier420(verifier).verify(jobId, evidenceRef)) {
            revert VerificationFailed();
        }
        jobs.markVerified(jobId);
        emit JobVerified(jobId, r.verificationProfileId, evidenceRef);
        return true;
    }
}
