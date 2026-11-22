// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/system/CapabilityRegistry420.sol";
import "../src/treasury/FoundingCommunityRetirementSweep420.sol";
import "../src/vault/VaultPolicyRegistry420.sol";

interface VmSweep420 {
    function deal(address,uint256) external;
    function prank(address) external;
}

contract FoundingSweepState420 is IFoundingTreasurySweepState420 {
    bool public retired;
    VaultRegistry420 public immutable vaultRegistry;
    bytes32 public immutable operationsVaultId;
    bytes32 public immutable contingencyVaultId;
    uint256 public operationsReleased;
    uint256 public contingencyReleased;
    constructor(address reg, bytes32 ops, bytes32 cont) {
        vaultRegistry = VaultRegistry420(reg);
        operationsVaultId = ops;
        contingencyVaultId = cont;
    }
    function OPERATIONS_ALLOCATION() external pure returns (uint128) { return 4_200_000 ether; }
    function CONTINGENCY_ALLOCATION() external pure returns (uint128) { return 840_000 ether; }
    function setRetired() external { retired = true; }
}

contract FoundingCommunityRetirementSweep420Test {
    VmSweep420 internal constant vm = VmSweep420(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 internal constant OPS = keccak256("ops-reserve");
    bytes32 internal constant CONT = keccak256("cont-reserve");
    bytes32 internal constant COMMUNITY = keccak256("community-reserve");
    bytes32 internal constant AUTH = keccak256("retire-auth");
    bytes32 internal constant ASSET = keccak256("retire-asset");
    bytes32 internal constant RELEASE = keccak256("retire-release");
    bytes32 internal constant ACC = keccak256("retire-accounting");
    CapabilityRegistry420 internal grants;
    VaultAuthorization420 internal authorization;
    VaultRegistry420 internal registry;
    VaultAccounting420 internal accounting;
    VaultPolicyRegistry420 internal policies;
    AssetVault420 internal ops;
    AssetVault420 internal cont;
    AssetVault420 internal community;
    FoundingSweepState420 internal authority;
    FoundingCommunityRetirementSweep420 internal sweep;

    function _register(bytes32 id, bytes32 kind) internal returns (AssetVault420 v) {
        v = new AssetVault420(id,address(registry),address(authorization),address(accounting),address(this));
        registry.registerVault(id,address(v),kind,AUTH,ASSET,RELEASE,ACC,bytes32(0),bytes32(0),bytes32(0));
    }

    function setUp() public {
        grants = new CapabilityRegistry420();
        grants.registerProtocolComponent(VaultIds420.COMPONENT_VAULT,address(this));
        authorization = new VaultAuthorization420(address(grants));
        policies = new VaultPolicyRegistry420(address(this));
        registry = new VaultRegistry420(address(authorization),address(policies));
        accounting = new VaultAccounting420(address(registry));
        policies.setPolicy(AUTH,VaultIds420.POLICY_AUTHORIZATION,AUTH,bytes32(0),true);
        policies.setPolicy(ASSET,VaultIds420.POLICY_ASSET,ASSET,bytes32(0),true);
        policies.setPolicy(RELEASE,VaultIds420.POLICY_RELEASE,RELEASE,bytes32(0),true);
        policies.setPolicy(ACC,VaultIds420.POLICY_ACCOUNTING,ACC,bytes32(0),true);
        ops = _register(OPS,VaultIds420.VAULT_TREASURY);
        cont = _register(CONT,VaultIds420.VAULT_TREASURY);
        community = _register(COMMUNITY,VaultIds420.VAULT_COMMUNITY);
        authority = new FoundingSweepState420(address(registry),OPS,CONT);
        sweep = new FoundingCommunityRetirementSweep420(address(authority),COMMUNITY);
        vm.deal(address(this),300 ether);
        ops.depositNative{value: 100 ether}();
        cont.depositNative{value: 200 ether}();
    }

    function _grant(bytes32 id, uint128 cap) internal {
        grants.createGrant(
            keccak256(abi.encode("retirement-sweep",id)),address(sweep),
            VaultIds420.COMPONENT_VAULT,VaultIds420.ACTION_WITHDRAW,
            authorization.scopeForRoute(id,address(0),address(community),VaultIds420.ACTION_WITHDRAW),
            cap,0,0,0,0
        );
    }

    function testCannotSweepBeforeRetirementOrWithoutExactVaultRouteGrant() public {
        (bool early,) = address(sweep).call(abi.encodeCall(sweep.sweep,(false,10 ether)));
        require(!early,"early sweep");
        authority.setRetired();
        (bool noGrant,) = address(sweep).call(abi.encodeCall(sweep.sweep,(false,10 ether)));
        require(!noGrant,"treasury without route grant");
        _grant(OPS,100 ether);
        sweep.sweep(false,10 ether);
        require(address(ops).balance == 90 ether,"only approved 10 deducted");
        require(address(community).balance == 10 ether,"community actually funded");
        require(sweep.operationsSwept() == 10 ether,"sweep accounted");
        require(!sweep.custodyHandoffComplete(),"remaining principal still in ops");
    }

    function testExactCommunityCustodyMigrationAndNoFounderRecipient() public {
        _grant(OPS,100 ether);
        _grant(CONT,200 ether);
        authority.setRetired();
        bytes32 id = sweep.sweep(false,100 ether);
        require(ops.executedOperation(id),"real vault operation consumed");
        sweep.sweep(true,200 ether);
        require(address(community).balance == 300 ether,"full custody transfer");
        require(accounting.getAccounting(COMMUNITY,address(0)).recordedBalance == 300 ether,"community accounting");
        require(sweep.custodyHandoffComplete(),"both founding reserves empty");
        require(address(this).balance == 0,"no owner payout");
        (bool replay,) = address(sweep).call(abi.encodeCall(sweep.sweep,(false,1 ether)));
        require(!replay,"free balance exhausted");
    }

    function testMalformedDestinationCannotBeDeclaredCommunityVault() public {
        FoundingSweepState420 otherState = new FoundingSweepState420(address(registry),OPS,CONT);
        try new FoundingCommunityRetirementSweep420(address(otherState),OPS) {
            revert("self vault is not community");
        } catch {}
    }
}
