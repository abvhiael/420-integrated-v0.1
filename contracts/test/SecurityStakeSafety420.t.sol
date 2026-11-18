// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./StakeValidatorGenesis420.t.sol";
import "../src/system/StakeSystemSafety420.sol";
import "../src/governance/GovernanceTimelock.sol";
import "../src/apps/ProtocolRegistry.sol";
interface VmStakeSafety420 { function warp(uint256 timestamp) external; }
contract StakeSafetySecurity420Test is StakeValidatorGenesis420Test {
    StakeSystemSafety420 internal safety;
    GovernanceTimelock internal timelock;
    ProtocolRegistry internal discovery;
    VmStakeSafety420 constant clock=VmStakeSafety420(address(uint160(uint256(keccak256("hevm cheat code")))));
    function _setupProductionSafety() internal {
        timelock=new GovernanceTimelock(address(this));
        safety=new StakeSystemSafety420(address(timelock));
        discovery=new ProtocolRegistry(address(timelock));
        _executeTarget(keccak256("publish-safety"),address(discovery),abi.encodeCall(discovery.registerComponent,(AppDependencyIds420.SYSTEM_SAFETY,address(safety),Types420.Version(1,0,0),Types420.Lifecycle.ACTIVE)));
        registry=new ValidatorRegistry(address(timelock),address(discovery),keccak256("stake-security-production-dependencies"));
        _executeTarget(keccak256("bind-gateway"),address(registry),abi.encodeCall(registry.bindConsensusSystemCaller,(SYSTEM_CALLER)));
    }
    function _execute(bytes32 id, bytes memory data) internal {
        _executeTarget(id,address(safety),data);
    }
    function _executeTarget(bytes32 id,address target,bytes memory data) internal {
        timelock.schedule(id,target,0,data,GovernanceTimelock.Class.G1);
        clock.warp(block.timestamp+timelock.G1_DELAY());timelock.execute(id);
    }
    function testSecurityTimelockAndSafetyClassBoundaries() public {
        _setupProductionSafety();
        vm.prank(address(0xBAD));
        (bool forgedBinding,)=address(discovery).call(abi.encodeCall(discovery.registerComponent,(AppDependencyIds420.SYSTEM_SAFETY,address(safety),Types420.Version(1,0,0),Types420.Lifecycle.ACTIVE)));
        require(!forgedBinding,"forged registry binding");
        bytes memory halt=abi.encodeCall(safety.setSafetyState,(ISystemSafety420.SafetyState.HALTED,keccak256("incident"),bytes32(0)));
        vm.prank(address(0xBAD));(bool unauthorized,)=address(safety).call(halt);require(!unauthorized,"outsider changed safety");
        (bool bootstrap,)=address(safety).call(halt);require(!bootstrap,"bootstrap bypassed timelock");
        bytes32 id=keccak256("halt");timelock.schedule(id,address(safety),0,halt,GovernanceTimelock.Class.G1);
        (bool early,)=address(timelock).call(abi.encodeCall(timelock.execute,(id)));require(!early,"delay bypassed");
        clock.warp(block.timestamp+timelock.G1_DELAY());timelock.execute(id);
        require(!safety.actionAllowed(StakeIds420.VALIDATOR_REGISTRY,StakeIds420.ACTION_ACTIVATE,ISystemSafety420.ActionClass.NORMAL_ONLY),"halt activation");
        require(safety.actionAllowed(StakeIds420.VALIDATOR_REGISTRY,StakeIds420.ACTION_WITHDRAW,ISystemSafety420.ActionClass.WITHDRAWAL_ONLY),"safe exit denied");
        require(!safety.actionAllowed(StakeIds420.VALIDATOR_REGISTRY,StakeIds420.ACTION_ACTIVATE,ISystemSafety420.ActionClass.WITHDRAWAL_ONLY),"class substitution");
        require(!safety.actionAllowed(bytes32(0),StakeIds420.ACTION_WITHDRAW,ISystemSafety420.ActionClass.WITHDRAWAL_ONLY),"unknown component");
        (bool replay,)=address(timelock).call(abi.encodeCall(timelock.execute,(id)));require(!replay,"operation replay");
    }
    function testSecurityActualProviderBlocksActivationAndAllowsExplicitRecovery() public {
        _setupProductionSafety();
        (bytes32 id,)=_registerSelfFunded("production-safety",51);
        _state(id,ValidatorRegistry.Status.PROBATION,1,0,0,0);
        vm.roll(uint256(registry.getValidator(id).registrationBlock)+registry.ACTIVATION_DELAY_BLOCKS());
        _state(id,ValidatorRegistry.Status.ELIGIBLE,2,1,0,0);
        _execute(keccak256("deny"),abi.encodeCall(safety.setSafetyState,(ISystemSafety420.SafetyState.HALTED,keccak256("incident"),bytes32(0))));
        vm.prank(SYSTEM_CALLER);
        (bool allowed,)=address(registry).call(abi.encodeCall(registry.applyConsensusState,(id,ValidatorRegistry.Status.ACTIVE,uint64(3),uint64(1),uint64(4),uint64(0))));
        require(!allowed && registry.getValidator(id).status==ValidatorRegistry.Status.ELIGIBLE,"halt bypassed in registry");
        _execute(keccak256("restore"),abi.encodeCall(safety.setSafetyState,(ISystemSafety420.SafetyState.NORMAL,keccak256("resolved"),bytes32(0))));
        _state(id,ValidatorRegistry.Status.ACTIVE,3,1,4,0);
        require(registry.getValidator(id).status==ValidatorRegistry.Status.ACTIVE,"safe resume failed");
    }
    function testSecurityRecoveryEvidenceAndActionDenialFailClosed() public {
        _setupProductionSafety();
        bytes memory missing=abi.encodeCall(safety.setSafetyState,(ISystemSafety420.SafetyState.RECOVERY,keccak256("incident"),bytes32(0)));
        vm.prank(address(timelock));(bool ok,)=address(safety).call(missing);require(!ok,"missing recovery evidence");
        _execute(keccak256("recovery"),abi.encodeCall(safety.setSafetyState,(ISystemSafety420.SafetyState.RECOVERY,keccak256("incident"),keccak256("canonical-recovery"))));
        require(safety.recoveryReference()==keccak256("canonical-recovery"),"recovery identity");
        _execute(keccak256("deny-withdraw"),abi.encodeCall(safety.setActionDenied,(StakeIds420.ACTION_WITHDRAW,true,keccak256("custody-uncertain"))));
        require(!safety.actionAllowed(StakeIds420.VALIDATOR_REGISTRY,StakeIds420.ACTION_WITHDRAW,ISystemSafety420.ActionClass.WITHDRAWAL_ONLY),"denied withdrawal");
    }
}
