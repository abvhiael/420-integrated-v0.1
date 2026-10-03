// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeWorkerStake420.sol";
import "../src/compute/ComputeStakeWorkerCollateral420.sol";
import "../src/vault/VaultAuthorization420.sol";
import "../src/vault/VaultPolicyRegistry420.sol";
import "../src/vault/VaultRegistry420.sol";
import "../src/vault/VaultAccounting420.sol";
import "../src/vault/AssetVault420.sol";
import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "./helpers/ComputeWorkerCapabilityMock420.sol";

interface VmWorkerStakeSourceIntegration420 {
    function addr(uint256) external returns (address);
    function sign(uint256, bytes32) external returns (uint8, bytes32, bytes32);
    function prank(address) external;
    function deal(address, uint256) external;
}

contract WorkerStakeSourceCaps420 is ICapabilityRegistry420 {
    mapping(bytes32 => CapabilityGrant) private _grants;
    mapping(bytes32 => bool) private _allowed;

    function setAllowed(
        address principal,
        bytes32 componentId,
        bytes32 capabilityId,
        bytes32 scopeHash,
        bool value
    ) external {
        _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))] = value;
    }

    function grant(bytes32 id) external view returns (CapabilityGrant memory) {
        return _grants[id];
    }

    function isAuthorized(
        address principal,
        bytes32 componentId,
        bytes32 capabilityId,
        bytes32 scopeHash,
        uint256
    ) external view returns (bool) {
        return _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))];
    }
}

contract WorkerStakeSourceSlashAdapter420 {}

contract ComputeWorkerStakeSourceIntegration420Test {
    VmWorkerStakeSourceIntegration420 private constant vm =
        VmWorkerStakeSourceIntegration420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant GOV = address(0x420);
    address private constant OPERATOR = address(0xA11CE);
    uint256 private constant EXEC_KEY = 0xBEEF;

    bytes32 private constant AUTH_POLICY = keccak256("cmp159/auth");
    bytes32 private constant ASSET_POLICY = keccak256("cmp159/asset");
    bytes32 private constant RELEASE_POLICY = keccak256("cmp159/release");
    bytes32 private constant ACCOUNTING_POLICY = keccak256("cmp159/accounting");
    bytes32 private constant VAULT_ID = keccak256("cmp159/collateral-vault");
    bytes32 private constant STAKE_POLICY = keccak256("cmp159/worker-policy");

    ComputeProviderRegistry420 private providers;
    ComputeNodeRegistry420 private nodes;
    ComputeResourceRegistry420 private resources;
    ComputeWorkerRegistry420 private workers;
    ComputeWorkerStake420 private workerStake;
    ComputeStakeWorkerCollateral420 private stakeSource;

    WorkerStakeSourceCaps420 private caps;
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
        ComputeAuthorization420 workerAuth =
            new ComputeAuthorization420(address(workerCaps));

        providers = new ComputeProviderRegistry420(GOV);
        nodes = new ComputeNodeRegistry420(address(providers), GOV);
        resources = new ComputeResourceRegistry420(address(nodes), GOV);
        workers = new ComputeWorkerRegistry420(address(resources), address(workerAuth), GOV);

        vm.prank(OPERATOR);
        bytes32 providerId =
            providers.register(keccak256("manifest"), keccak256("security"), OPERATOR);
        vm.prank(GOV);
        providers.activate(providerId);

        vm.prank(OPERATOR);
        bytes32 nodeId = nodes.register(
            providerId,
            keccak256("node"),
            keccak256("endpoint"),
            uint64(block.timestamp + 30 days)
        );
        vm.prank(OPERATOR);
        nodes.activate(nodeId);

        // Read the class before vm.prank: an external getter would otherwise consume the one-shot prank.
        bytes32 computeClass = resources.CPU_GENERAL();
        vm.prank(OPERATOR);
        bytes32 resourceId = resources.register(
            nodeId,
            computeClass,
            keccak256("hardware"),
            keccak256("runtime"),
            keccak256("capability"),
            8
        );
        vm.prank(OPERATOR);
        resources.activate(resourceId);

        address signer = vm.addr(EXEC_KEY);
        ComputeResourceRegistry420.Resource memory rr = resources.resource(resourceId);
        bytes32 digest = workers.registrationDigest(
            workers.nextSerial() + 1,
            rr.providerId,
            rr.nodeId,
            resourceId,
            rr.revision,
            OPERATOR,
            signer,
            keccak256("worker-cap"),
            bytes32(0)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(EXEC_KEY, digest);
        vm.prank(OPERATOR);
        workerId = workers.register(
            resourceId,
            signer,
            keccak256("worker-cap"),
            bytes32(0),
            abi.encodePacked(r, s, v)
        );
        vm.prank(OPERATOR);
        workers.activate(workerId);

        caps = new WorkerStakeSourceCaps420();
        auth = new VaultAuthorization420(address(caps));
        policies = new VaultPolicyRegistry420(address(this));
        registry = new VaultRegistry420(address(auth), address(policies));
        accounting = new VaultAccounting420(address(registry));

        policies.setPolicy(
            AUTH_POLICY, VaultIds420.POLICY_AUTHORIZATION, keccak256("a"), bytes32(0), true
        );
        policies.setPolicy(
            ASSET_POLICY, VaultIds420.POLICY_ASSET, keccak256("b"), bytes32(0), true
        );
        policies.setPolicy(
            RELEASE_POLICY, VaultIds420.POLICY_RELEASE, keccak256("c"), bytes32(0), true
        );
        policies.setPolicy(
            ACCOUNTING_POLICY, VaultIds420.POLICY_ACCOUNTING, keccak256("d"), bytes32(0), true
        );

        vault = new AssetVault420(
            VAULT_ID, address(registry), address(auth), address(accounting), address(this)
        );
        registry.registerVault(
            VAULT_ID,
            address(vault),
            VaultIds420.VAULT_COLLATERAL,
            AUTH_POLICY,
            ASSET_POLICY,
            RELEASE_POLICY,
            ACCOUNTING_POLICY,
            bytes32(0),
            keccak256("cmp159/collateral"),
            keccak256("cmp159/manifest")
        );

        ComputeStakeExitPolicy420 exitPolicy = new ComputeStakeExitPolicy420(GOV);
        vm.prank(GOV);
        exitPolicy.publish(STAKE_POLICY, 7 days);

        WorkerStakeSourceSlashAdapter420 slashAdapter =
            new WorkerStakeSourceSlashAdapter420();
        ComputeStakeSlashPolicy420 slashPolicy = new ComputeStakeSlashPolicy420(GOV);
        vm.prank(GOV);
        slashPolicy.publish(
            STAKE_POLICY,
            1,
            address(slashAdapter),
            keccak256("cmp159/worker-slash"),
            bytes32(0),
            0,
            bytes32(0),
            1000,
            0
        );

        stakeSource = new ComputeStakeWorkerCollateral420(
            address(workers),
            address(vault),
            address(exitPolicy),
            address(slashPolicy)
        );
        bytes32 scope = auth.scopeForVault(VAULT_ID);
        caps.setAllowed(
            address(stakeSource),
            VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_CREATE_OBLIGATION,
            scope,
            true
        );
        caps.setAllowed(
            address(stakeSource),
            VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_RELEASE_OBLIGATION,
            scope,
            true
        );
        caps.setAllowed(
            address(stakeSource),
            VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_CLAIM,
            scope,
            true
        );
        caps.setAllowed(
            address(stakeSource),
            VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_CANCEL_OBLIGATION,
            scope,
            true
        );

        workerStake = new ComputeWorkerStake420(address(workers), GOV);
        vm.prank(GOV);
        workerStake.publishPolicy(STAKE_POLICY, 100 ether, 80 ether, true);
        vm.prank(GOV);
        workerStake.bindSource(address(stakeSource), true);
    }

    function testRealComputeStakeSourceBindsCanonicalWorkerRegistryAndCodeHash() public view {
        ComputeWorkerStake420.SourceBinding memory b = workerStake.currentSourceBinding();
        require(b.source == address(stakeSource), "source mismatch");
        require(b.workerRegistry == address(workers), "WorkerRegistry mismatch");
        require(b.sourceCodeHash == address(stakeSource).codehash, "source code hash mismatch");
        require(b.active && b.exists && b.revision == 1, "binding state");
        require(stakeSource.workerRegistry() == address(workers), "source registry surface");
    }

    function testRealVaultBackedCollateralControlsWorkerAdmissionAndReference() public {
        uint64 workerRevision = workers.worker(workerId).revision;
        require(
            !workerStake.isEligible(workerId, workerRevision, STAKE_POLICY, false, bytes32(0)),
            "worker eligible without collateral"
        );

        vm.deal(OPERATOR, 120 ether);
        vm.prank(OPERATOR);
        (bytes32 positionId,) =
            stakeSource.stake{value: 120 ether}(workerId, STAKE_POLICY);

        require(
            workerStake.isEligible(workerId, workerRevision, STAKE_POLICY, false, bytes32(0)),
            "real collateral did not qualify worker"
        );

        vm.prank(OPERATOR);
        bytes32 referenceId =
            workerStake.captureReference(workerId, workerRevision, STAKE_POLICY);

        ComputeWorkerStake420.StakeReference memory ref =
            workerStake.stakeReference(referenceId);
        require(ref.source == address(stakeSource), "reference source");
        require(ref.sourceCodeHash == address(stakeSource).codehash, "reference code hash");
        require(ref.positionId == positionId, "reference position");
        require(ref.activeAmount == 120 ether && ref.slashableAmount == 120 ether, "reference amounts");
        require(
            workerStake.isEligible(workerId, workerRevision, STAKE_POLICY, true, referenceId),
            "real collateral reference rejected"
        );

        vm.prank(OPERATOR);
        stakeSource.requestExit(positionId);

        require(
            !workerStake.isEligible(workerId, workerRevision, STAKE_POLICY, true, referenceId),
            "exiting real collateral remained eligible"
        );

        ComputeWorkerStake420.StakeReference memory historical =
            workerStake.stakeReference(referenceId);
        require(
            historical.positionId == positionId
                && historical.activeAmount == 120 ether
                && historical.slashableAmount == 120 ether
                && !historical.exiting,
            "historical stake reference rewritten"
        );
    }

    function testRealSourceReadMatchesCanonicalCollateralPosition() public {
        vm.deal(OPERATOR, 105 ether);
        vm.prank(OPERATOR);
        stakeSource.stake{value: 105 ether}(workerId, STAKE_POLICY);

        IComputeStakeSource420.PositionRead memory direct =
            stakeSource.readWorkerPosition(workerId, STAKE_POLICY);
        IComputeStakeSource420.PositionRead memory throughAdapter =
            workerStake.readLivePosition(workerId, STAKE_POLICY);

        require(direct.positionId == throughAdapter.positionId, "position id drift");
        require(direct.positionRevision == throughAdapter.positionRevision, "revision drift");
        require(direct.activeAmount == throughAdapter.activeAmount, "active amount drift");
        require(direct.slashableAmount == throughAdapter.slashableAmount, "slashable drift");
        require(direct.active == throughAdapter.active, "active flag drift");
        require(direct.exiting == throughAdapter.exiting, "exit flag drift");
    }
}
