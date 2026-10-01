// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeStakeWorkerCollateral420.sol";
import "../src/vault/VaultAuthorization420.sol";
import "../src/vault/VaultPolicyRegistry420.sol";
import "../src/vault/VaultRegistry420.sol";
import "../src/vault/VaultAccounting420.sol";
import "../src/vault/AssetVault420.sol";
import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "./helpers/ComputeWorkerCapabilityMock420.sol";

interface VmComputeStakeWorkerCollateral420 {
    function addr(uint256) external returns (address);
    function sign(uint256, bytes32) external returns (uint8, bytes32, bytes32);
    function prank(address) external;
    function deal(address, uint256) external;
}

contract MockVaultCapsWorkerCollateral420 is ICapabilityRegistry420 {
    mapping(bytes32 => CapabilityGrant) private _grants;
    mapping(bytes32 => bool) private _allowed;

    function setAllowed(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, bool value) external {
        _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))] = value;
    }

    function grant(bytes32 id) external view returns (CapabilityGrant memory) { return _grants[id]; }

    function isAuthorized(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256)
        external view returns (bool)
    {
        return _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))];
    }
}

contract ComputeStakeWorkerCollateral420Test {
    VmComputeStakeWorkerCollateral420 private constant vm =
        VmComputeStakeWorkerCollateral420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant GOV = address(0x420);
    address private constant OPERATOR = address(0xA11CE);
    address private constant OUTSIDER = address(0xBAD);
    uint256 private constant EXEC_KEY = 0xBEEF;

    bytes32 private constant AUTH_POLICY = keccak256("stake/auth");
    bytes32 private constant ASSET_POLICY = keccak256("stake/asset");
    bytes32 private constant RELEASE_POLICY = keccak256("stake/release");
    bytes32 private constant ACCOUNTING_POLICY = keccak256("stake/accounting");
    bytes32 private constant VAULT_ID = keccak256("compute/stake/collateral");
    bytes32 private constant POLICY_A = keccak256("compute/collateral/a");
    bytes32 private constant POLICY_B = keccak256("compute/collateral/b");

    ComputeProviderRegistry420 private providers;
    ComputeNodeRegistry420 private nodes;
    ComputeResourceRegistry420 private resources;
    ComputeWorkerRegistry420 private workers;
    ComputeStakeWorkerCollateral420 private stakeSource;

    MockVaultCapsWorkerCollateral420 private caps;
    VaultAuthorization420 private auth;
    VaultPolicyRegistry420 private policies;
    VaultRegistry420 private registry;
    VaultAccounting420 private accounting;
    AssetVault420 private vault;

    bytes32 private workerId;

    function setUp() public {
        ComputeWorkerCapabilityMock420 workerCaps = new ComputeWorkerCapabilityMock420();
        workerCaps.setAllowPrincipal(OPERATOR, true);
        workerCaps.setAllowPrincipal(GOV, true);
        ComputeAuthorization420 workerAuth = new ComputeAuthorization420(address(workerCaps));

        providers = new ComputeProviderRegistry420(GOV);
        nodes = new ComputeNodeRegistry420(address(providers), GOV);
        resources = new ComputeResourceRegistry420(address(nodes), GOV);
        workers = new ComputeWorkerRegistry420(address(resources), address(workerAuth), GOV);

        vm.prank(OPERATOR);
        bytes32 providerId = providers.register(keccak256("manifest"), keccak256("security"), OPERATOR);
        vm.prank(GOV);
        providers.activate(providerId);
        vm.prank(OPERATOR);
        bytes32 nodeId = nodes.register(providerId, keccak256("node"), keccak256("endpoint"), uint64(block.timestamp + 30 days));
        vm.prank(OPERATOR);
        nodes.activate(nodeId);
        vm.prank(OPERATOR);
        bytes32 resourceId = resources.register(
            nodeId, resources.CPU_GENERAL(), keccak256("hardware"), keccak256("runtime"), keccak256("cap"), 8
        );
        vm.prank(OPERATOR);
        resources.activate(resourceId);

        address signer = vm.addr(EXEC_KEY);
        ComputeResourceRegistry420.Resource memory rr = resources.resource(resourceId);
        bytes32 digest = workers.registrationDigest(
            workers.nextSerial() + 1, rr.providerId, rr.nodeId, resourceId, rr.revision,
            OPERATOR, signer, keccak256("worker-cap"), bytes32(0)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(EXEC_KEY, digest);
        vm.prank(OPERATOR);
        workerId = workers.register(resourceId, signer, keccak256("worker-cap"), bytes32(0), abi.encodePacked(r, s, v));
        vm.prank(OPERATOR);
        workers.activate(workerId);

        caps = new MockVaultCapsWorkerCollateral420();
        auth = new VaultAuthorization420(address(caps));
        policies = new VaultPolicyRegistry420(address(this));
        registry = new VaultRegistry420(address(auth), address(policies));
        accounting = new VaultAccounting420(address(registry));

        policies.setPolicy(AUTH_POLICY, VaultIds420.POLICY_AUTHORIZATION, keccak256("a"), bytes32(0), true);
        policies.setPolicy(ASSET_POLICY, VaultIds420.POLICY_ASSET, keccak256("b"), bytes32(0), true);
        policies.setPolicy(RELEASE_POLICY, VaultIds420.POLICY_RELEASE, keccak256("c"), bytes32(0), true);
        policies.setPolicy(ACCOUNTING_POLICY, VaultIds420.POLICY_ACCOUNTING, keccak256("d"), bytes32(0), true);

        vault = new AssetVault420(VAULT_ID, address(registry), address(auth), address(accounting), address(this));
        registry.registerVault(
            VAULT_ID, address(vault), VaultIds420.VAULT_COLLATERAL,
            AUTH_POLICY, ASSET_POLICY, RELEASE_POLICY, ACCOUNTING_POLICY,
            bytes32(0), keccak256("compute-collateral"), keccak256("manifest")
        );

        stakeSource = new ComputeStakeWorkerCollateral420(address(workers), address(vault));
        caps.setAllowed(
            address(stakeSource), VaultIds420.COMPONENT_VAULT, VaultIds420.ACTION_CREATE_OBLIGATION,
            auth.scopeForVault(VAULT_ID), true
        );
    }

    function _stake(bytes32 policy, uint256 amount) private returns (bytes32 id) {
        vm.deal(OPERATOR, amount);
        vm.prank(OPERATOR);
        (id,) = stakeSource.stake{value: amount}(workerId, policy);
    }

    function testWorkerStakeIsBackedByCanonicalVaultObligation() public {
        bytes32 id = _stake(POLICY_A, 100 ether);
        IComputeStakeSource420.PositionRead memory p = stakeSource.readWorkerPosition(workerId, POLICY_A);
        require(p.positionId == id && p.positionRevision == 1, "position identity");
        require(p.activeAmount == 100 ether && p.slashableAmount == 100 ether && p.active, "position amount");
        require(!p.exiting && p.withdrawableAt == 0, "later lifecycle leaked");

        ComputeStakeWorkerCollateral420.Tranche memory t = stakeSource.tranche(id, 1);
        VaultAccounting420.Obligation memory o = accounting.getObligation(t.obligationId);
        VaultAccounting420.AssetAccounting memory a = accounting.getAccounting(VAULT_ID, address(0));
        require(address(vault).balance == 100 ether, "vault custody");
        require(a.recordedBalance == 100 ether && a.reserved == 100 ether && a.claimable == 0, "vault accounting");
        require(o.state == 1 && o.amount == 100 ether && o.beneficiary == OPERATOR, "obligation");
        require(o.obligationType == stakeSource.WORKER_COLLATERAL_TYPE() && o.sourceRef == id, "obligation binding");
    }

    function testTopUpCreatesDistinctBackingTrancheAndRevision() public {
        bytes32 id = _stake(POLICY_A, 40 ether);
        _stake(POLICY_A, 60 ether);
        IComputeStakeSource420.PositionRead memory p = stakeSource.readWorkerPosition(workerId, POLICY_A);
        require(p.positionRevision == 2 && p.activeAmount == 100 ether && p.slashableAmount == 100 ether, "aggregate");
        ComputeStakeWorkerCollateral420.Tranche memory a = stakeSource.tranche(id, 1);
        ComputeStakeWorkerCollateral420.Tranche memory b = stakeSource.tranche(id, 2);
        require(a.obligationId != b.obligationId && a.amount == 40 ether && b.amount == 60 ether, "tranches");
        require(accounting.getAccounting(VAULT_ID, address(0)).reserved == 100 ether, "reserve");
    }

    function testPolicyPositionsRemainIsolated() public {
        bytes32 a = _stake(POLICY_A, 25 ether);
        bytes32 b = _stake(POLICY_B, 35 ether);
        require(a != b, "policy collision");
        require(stakeSource.readWorkerPosition(workerId, POLICY_A).activeAmount == 25 ether, "policy a");
        require(stakeSource.readWorkerPosition(workerId, POLICY_B).activeAmount == 35 ether, "policy b");
        require(accounting.getAccounting(VAULT_ID, address(0)).reserved == 60 ether, "combined backing");
    }

    function testNonOperatorCannotStakeForWorker() public {
        vm.deal(OUTSIDER, 10 ether);
        vm.prank(OUTSIDER);
        (bool ok,) = address(stakeSource).call{value: 10 ether}(
            abi.encodeCall(stakeSource.stake, (workerId, POLICY_A))
        );
        require(!ok, "outsider staked");
        require(address(vault).balance == 0, "failed stake moved funds");
    }

    function testRetiredWorkerCannotAddCollateral() public {
        vm.prank(OPERATOR);
        workers.retire(workerId);
        vm.deal(OPERATOR, 10 ether);
        vm.prank(OPERATOR);
        (bool ok,) = address(stakeSource).call{value: 10 ether}(
            abi.encodeCall(stakeSource.stake, (workerId, POLICY_A))
        );
        require(!ok, "retired worker staked");
        require(address(vault).balance == 0, "retired stake moved funds");
    }

    function testMissingVaultCreateGrantRevertsAtomically() public {
        caps.setAllowed(
            address(stakeSource), VaultIds420.COMPONENT_VAULT, VaultIds420.ACTION_CREATE_OBLIGATION,
            auth.scopeForVault(VAULT_ID), false
        );
        vm.deal(OPERATOR, 12 ether);
        vm.prank(OPERATOR);
        (bool ok,) = address(stakeSource).call{value: 12 ether}(
            abi.encodeCall(stakeSource.stake, (workerId, POLICY_A))
        );
        require(!ok, "stake without grant");
        VaultAccounting420.AssetAccounting memory a = accounting.getAccounting(VAULT_ID, address(0));
        require(address(vault).balance == 0 && a.recordedBalance == 0 && a.reserved == 0, "rollback failed");
        require(stakeSource.readWorkerPosition(workerId, POLICY_A).positionId == bytes32(0), "position leaked");
    }

    function testDirectEthIsRejected() public {
        vm.deal(OPERATOR, 1 ether);
        vm.prank(OPERATOR);
        (bool ok,) = address(stakeSource).call{value: 1 ether}("");
        require(!ok && address(stakeSource).balance == 0, "direct eth accepted");
    }
}
