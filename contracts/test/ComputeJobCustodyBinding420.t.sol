// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeJobPayerCustody420.sol";

interface VmCustodyBinding420 { function prank(address caller) external; }

contract ComputeJobCustodyBinding420Test {
    VmCustodyBinding420 private constant vm = VmCustodyBinding420(address(uint160(uint256(keccak256("hevm cheat code")))));

    function testOnlyDeployerCanBindAndOnlyOnce() public {
        ComputeJobSignedRequestAuthority420 requests = new ComputeJobSignedRequestAuthority420();
        ComputeJobPayerCustody420 custody = new ComputeJobPayerCustody420(address(requests));
        ComputeJobRegistry420 candidate = new ComputeJobRegistry420(address(requests), address(custody),
            address(requests), address(requests), address(requests), address(requests));
        vm.prank(address(0xBAD));
        (bool ok,) = address(custody).call(abi.encodeCall(custody.bindJobs, (address(candidate))));
        require(!ok && address(custody.jobs()) == address(0), "outsider hijacked custody binding");
        custody.bindJobs(address(candidate));
        require(address(custody.jobs()) == address(candidate), "deployer binding failed");
        (ok,) = address(custody).call(abi.encodeCall(custody.bindJobs, (address(candidate))));
        require(!ok, "custody binding was mutable");
    }
}
