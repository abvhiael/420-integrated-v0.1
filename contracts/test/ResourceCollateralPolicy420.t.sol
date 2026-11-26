// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/resource/ResourceProviderRegistry420.sol";
import "../src/resource/ResourceAuthorization420.sol";
import "../src/interfaces/genesis/ICapabilityRegistry420.sol";

interface VmResourcePolicy420 { function prank(address) external; }
contract ResourcePolicyCaps420 is ICapabilityRegistry420 {
    function grant(bytes32) external pure returns (CapabilityGrant memory g) { return g; }
    function isAuthorized(address,bytes32,bytes32,bytes32,uint256) external pure returns (bool) { return false; }
}
contract ResourceCollateralPolicy420Test {
    VmResourcePolicy420 constant vm = VmResourcePolicy420(address(uint160(uint256(keccak256("hevm cheat code")))));
    ResourceProviderRegistry420 registry;
    bytes32 constant EVIDENCE = keccak256("test-only economic assumptions");
    function setUp() public {
        registry = new ResourceProviderRegistry420(address(new ResourceAuthorization420(address(new ResourcePolicyCaps420()))),address(this));
    }
    function testUnconfiguredPolicyFailsClosed() public {
        bytes32 id = keccak256("provider");
        registry.registerProvider(id,address(this),0,keccak256("forged"));
        (bool ok,) = address(registry).call(abi.encodeCall(registry.setState,(id,ResourceProviderRegistry420.State.ACTIVE)));
        require(!ok && !registry.isActive(id) && registry.minimumCollateral()==0,"unconfigured admission");
    }
    function testPolicyRevisionsAndCommitmentsRemainHistorical() public {
        uint32 first = registry.publishCollateralPolicy(100,50,1 days,2500,true,EVIDENCE);
        bytes32 commitment = registry.collateralPolicyCommitment(first);
        uint32 second = registry.publishCollateralPolicy(200,100,2 days,5000,false,EVIDENCE);
        require(first==1 && second==2 && registry.minimumCollateral()==200,"revision");
        require(registry.collateralPolicyCommitment(first)==commitment,"history mutated");
        ResourceProviderRegistry420.CollateralPolicy memory p = registry.collateralPolicy(first);
        require(p.minimumCollateral==100 && p.minimumSlashable==50 && p.withdrawalDelay==1 days && p.coverageBps==2500 && p.acceptingNew,"history");
    }
    function testCoverageRoundsUpAndEnforcesFloor() public {
        registry.publishCollateralPolicy(100,10,1 days,2500,true,EVIDENCE);
        require(registry.requiredSlashable(0)==10,"floor");
        require(registry.requiredSlashable(40)==10,"boundary");
        require(registry.requiredSlashable(41)==11,"round up");
        require(registry.requiredSlashable(10000)==2500,"exact");
    }
    function testUnauthorizedPolicyAndPauseRejected() public {
        vm.prank(address(0xBAD));
        (bool ok,) = address(registry).call(abi.encodeCall(registry.publishCollateralPolicy,(100,50,uint64(1 days),uint32(2500),true,EVIDENCE)));
        require(!ok && registry.collateralPolicyRevision()==0,"unauthorized policy");
        vm.prank(address(0xBAD));
        (ok,) = address(registry).call(abi.encodeCall(registry.setAdmissionSuspended,(true)));
        require(!ok && !registry.admissionSuspended(),"unauthorized pause");
        registry.setAdmissionSuspended(true);
        require(registry.admissionSuspended(),"pause");
        registry.setAdmissionSuspended(false);
        require(!registry.admissionSuspended(),"resume");
    }
    function testInvalidPolicyRejected() public {
        _reject(0,1,1,1,EVIDENCE);
        _reject(1,0,1,1,EVIDENCE);
        _reject(1,2,1,1,EVIDENCE);
        _reject(1,1,0,1,EVIDENCE);
        _reject(1,1,1,0,EVIDENCE);
        _reject(1,1,1,1,0);
        require(registry.collateralPolicyRevision()==0,"invalid revision");
    }
    function _reject(uint256 a,uint256 s,uint64 d,uint32 c,bytes32 e) private {
        (bool ok,) = address(registry).call(abi.encodeCall(registry.publishCollateralPolicy,(a,s,d,c,true,e)));
        require(!ok,"invalid policy accepted");
    }
    function testFuzzCoverage(uint128 exposure,uint16 ratio) public {
        if(ratio==0) return;
        registry.publishCollateralPolicy(1,1,1,ratio,true,EVIDENCE);
        uint256 expected = (uint256(exposure)*ratio+9999)/10000;
        if(expected==0) expected=1;
        require(registry.requiredSlashable(exposure)==expected,"coverage");
    }
}
