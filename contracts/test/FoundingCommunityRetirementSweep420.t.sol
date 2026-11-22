// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/system/CapabilityRegistry420.sol";
import "../src/treasury/FoundingCommunityRetirementSweep420.sol";
import "../src/vault/VaultPolicyRegistry420.sol";

interface VmSweep420 {
    function deal(
        address,
        uint256
    ) external;
    function prank(
        address
    ) external;
}

contract FoundingSweepState420 is IFoundingTreasurySweepState420 {
    bool public retired;
    VaultRegistry420 public immutable vaultRegistry;
    bytes32 public immutable operationsVaultId;
    bytes32 public immutable contingencyVaultId;
    uint256 public operationsReleased;
    uint256 public contingencyReleased;
    uint256 public operationsCommitted;
    uint256 public contingencyCommitted;

    function setOutstanding(
        bool contingency,
        uint256 committed,
        uint256 released
    ) external {
        if (contingency) {
            contingencyCommitted = committed;
            contingencyReleased = released;
        } else {
            operationsCommitted = committed;
            operationsReleased = released;
        }
    }

    constructor(
        address reg,
        bytes32 ops,
        bytes32 cont
    ) {
        vaultRegistry = VaultRegistry420(reg);
        operationsVaultId = ops;
        contingencyVaultId = cont;
    }

    function OPERATIONS_ALLOCATION() external pure returns (uint128) {
        return 4_200_000 ether;
    }

    function CONTINGENCY_ALLOCATION() external pure returns (uint128) {
        return 840_000 ether;
    }

    function setRetired() external {
        retired = true;
    }

    function outstandingFoundingCommitments() external view returns (bool) {
        return operationsCommitted != operationsReleased || contingencyCommitted != contingencyReleased;
    }
}

contract ExactRetirementToken420 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(
        address to,
        uint256 amount
    ) external {
        balanceOf[to] += amount;
    }

    function approve(
        address spender,
        uint256 amount
    ) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(
        address to,
        uint256 amount
    ) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool) {
        require(balanceOf[from] >= amount && allowance[from][msg.sender] >= amount, "not authorized");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
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

    function _register(
        bytes32 id,
        bytes32 kind
    ) internal returns (AssetVault420 v) {
        v = new AssetVault420(id, address(registry), address(authorization), address(accounting), address(this));
        registry.registerVault(id, address(v), kind, AUTH, ASSET, RELEASE, ACC, bytes32(0), bytes32(0), bytes32(0));
    }

    function setUp() public {
        grants = new CapabilityRegistry420();
        grants.registerProtocolComponent(VaultIds420.COMPONENT_VAULT, address(this));
        authorization = new VaultAuthorization420(address(grants));
        policies = new VaultPolicyRegistry420(address(this));
        registry = new VaultRegistry420(address(authorization), address(policies));
        accounting = new VaultAccounting420(address(registry));
        policies.setPolicy(AUTH, VaultIds420.POLICY_AUTHORIZATION, AUTH, bytes32(0), true);
        policies.setPolicy(ASSET, VaultIds420.POLICY_ASSET, ASSET, bytes32(0), true);
        policies.setPolicy(RELEASE, VaultIds420.POLICY_RELEASE, RELEASE, bytes32(0), true);
        policies.setPolicy(ACC, VaultIds420.POLICY_ACCOUNTING, ACC, bytes32(0), true);
        ops = _register(OPS, VaultIds420.VAULT_TREASURY);
        cont = _register(CONT, VaultIds420.VAULT_TREASURY);
        community = _register(COMMUNITY, VaultIds420.VAULT_COMMUNITY);
        authority = new FoundingSweepState420(address(registry), OPS, CONT);
        sweep = new FoundingCommunityRetirementSweep420(address(authority), COMMUNITY);
        vm.deal(address(this), 300 ether);
        ops.depositNative{ value: 100 ether }();
        cont.depositNative{ value: 200 ether }();
    }

    function _grant(
        bytes32 id,
        uint128 cap
    ) internal {
        grants.createGrant(
            keccak256(abi.encode("retirement-sweep", id)),
            address(sweep),
            VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_WITHDRAW,
            authorization.scopeForRoute(id, address(0), address(community), VaultIds420.ACTION_WITHDRAW),
            cap,
            0,
            0,
            0,
            0
        );
    }

    function testCannotSweepBeforeRetirementOrWithoutExactVaultRouteGrant() public {
        (bool early,) = address(sweep).call(abi.encodeCall(sweep.sweep, (false, 10 ether)));
        require(!early, "early sweep");
        authority.setRetired();
        (bool noGrant,) = address(sweep).call(abi.encodeCall(sweep.sweep, (false, 10 ether)));
        require(!noGrant, "treasury without route grant");
        _grant(OPS, 100 ether);
        sweep.sweep(false, 10 ether);
        require(address(ops).balance == 90 ether, "only approved 10 deducted");
        require(address(community).balance == 10 ether, "community actually funded");
        require(sweep.operationsSwept() == 10 ether, "sweep accounted");
        require(!sweep.custodyHandoffComplete(), "remaining principal still in ops");
    }

    function testExactCommunityCustodyMigrationAndNoFounderRecipient() public {
        _grant(OPS, 100 ether);
        _grant(CONT, 200 ether);
        authority.setRetired();
        bytes32 id = sweep.sweep(false, 100 ether);
        require(ops.executedOperation(id), "real vault operation consumed");
        sweep.sweep(true, 200 ether);
        require(address(community).balance == 300 ether, "full custody transfer");
        require(accounting.getAccounting(COMMUNITY, address(0)).recordedBalance == 300 ether, "community accounting");
        require(sweep.custodyHandoffComplete(), "both founding reserves empty");
        require(address(this).balance == 0, "no owner payout");
        (bool replay,) = address(sweep).call(abi.encodeCall(sweep.sweep, (false, 1 ether)));
        require(!replay, "free balance exhausted");
    }

    function testUnsettledTreasuryCommitmentCannotBeDiverted() public {
        _grant(OPS, 100 ether);
        authority.setRetired();
        authority.setOutstanding(false, 40 ether, 0);
        (bool diverted,) = address(sweep).call(abi.encodeCall(sweep.sweep, (false, 100 ether)));
        require(!diverted && address(ops).balance == 100 ether, "unpaid founding commitment diverted");
        require(!sweep.custodyHandoffComplete(), "declared complete with unsettled commitment");
        authority.setOutstanding(false, 40 ether, 40 ether);
        sweep.sweep(false, 100 ether);
        require(address(ops).balance == 0, "settled founding vault transfer");
    }

    function testProtectedNativeObligationCannotBeSweptOrDeclaredSettled() public {
        grants.createGrant(
            keccak256("reserve-protected-ops"),
            address(this),
            VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_CREATE_OBLIGATION,
            authorization.scopeForVault(OPS),
            60 ether,
            0,
            0,
            0,
            0
        );
        ops.createObligation(
            keccak256("reserve-op"),
            keccak256("protected-payment"),
            address(0),
            address(0xBEEF),
            60 ether,
            keccak256("payer-safety"),
            keccak256("claim-record")
        );
        _grant(OPS, 100 ether);
        authority.setRetired();
        sweep.sweep(false, 40 ether);
        require(address(ops).balance == 60 ether, "protected obligation paid to community");
        require(accounting.getAccounting(OPS, address(0)).reserved == 60 ether, "reserve altered");
        (bool diverted,) = address(sweep).call(abi.encodeCall(sweep.sweep, (false, 1 ether)));
        require(!diverted && !sweep.custodyHandoffComplete(), "protected obligation bypassed");
    }

    function testRecordedErc20AssetsAreTransferredAndCommunityAccountingReconciles() public {
        ExactRetirementToken420 token = new ExactRetirementToken420();
        token.mint(address(this), 300 ether);
        token.approve(address(ops), 100 ether);
        token.approve(address(cont), 200 ether);
        ops.depositToken(address(token), 100 ether);
        cont.depositToken(address(token), 200 ether);
        grants.createGrant(
            keccak256("ops-token-sweep"),
            address(sweep),
            VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_WITHDRAW,
            authorization.scopeForRoute(OPS, address(token), address(sweep), VaultIds420.ACTION_WITHDRAW),
            100 ether,
            0,
            0,
            0,
            0
        );
        grants.createGrant(
            keccak256("cont-token-sweep"),
            address(sweep),
            VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_WITHDRAW,
            authorization.scopeForRoute(CONT, address(token), address(sweep), VaultIds420.ACTION_WITHDRAW),
            200 ether,
            0,
            0,
            0,
            0
        );
        authority.setRetired();
        (bool noNativeTokenRoute,) = address(sweep).call(abi.encodeCall(sweep.sweep, (false, 1 ether)));
        require(!noNativeTokenRoute, "token grant authorized native withdrawal");
        sweep.sweepToken(false, address(token), 100 ether);
        sweep.sweepToken(true, address(token), 200 ether);
        require(token.balanceOf(address(community)) == 300 ether, "community did not actually receive token");
        require(token.balanceOf(address(sweep)) == 0, "token escrow held assets");
        require(
            accounting.getAccounting(COMMUNITY, address(token)).recordedBalance == 300 ether,
            "community token accounting not credited"
        );
        require(
            accounting.nonzeroAssetCount(OPS) == 1 && accounting.nonzeroAssetCount(CONT) == 1,
            "remaining native still blocks closure"
        );
        _grant(OPS, 100 ether);
        _grant(CONT, 200 ether);
        sweep.sweep(false, 100 ether);
        sweep.sweep(true, 200 ether);
        require(sweep.custodyHandoffComplete(), "both multiasset vaults were not closed");
    }

    function testUnaccountedForcedNativeDustPreventsFalseCustodyHandoff() public {
        _grant(OPS, 100 ether);
        _grant(CONT, 200 ether);
        authority.setRetired();
        sweep.sweep(false, 100 ether);
        sweep.sweep(true, 200 ether);
        require(sweep.custodyHandoffComplete(), "baseline closure");
        vm.deal(address(ops), 1 wei);
        require(!sweep.custodyHandoffComplete(), "unreconciled native dust ignored");
    }

    function testMalformedDestinationCannotBeDeclaredCommunityVault() public {
        FoundingSweepState420 otherState = new FoundingSweepState420(address(registry), OPS, CONT);
        try new FoundingCommunityRetirementSweep420(address(otherState), OPS) {
            revert("self vault is not community");
        } catch { }
    }
}
