// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeStakeVerifierCollateral420.sol";
import "../src/vault/VaultAuthorization420.sol";
import "../src/vault/VaultPolicyRegistry420.sol";
import "../src/vault/VaultRegistry420.sol";
import "../src/vault/VaultAccounting420.sol";
import "../src/vault/AssetVault420.sol";
import "../src/interfaces/genesis/ICapabilityRegistry420.sol";

interface VmComputeStakeVerifierCollateral420 {
    function prank(address) external;
    function deal(address, uint256) external;
}

contract MockVaultCapsVerifierCollateral420 is ICapabilityRegistry420 {
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

contract ComputeStakeVerifierCollateral420Test {
    VmComputeStakeVerifierCollateral420 private constant vm =
        VmComputeStakeVerifierCollateral420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant GOV = address(0x420);
    address private constant VERIFIER_A = address(0xA11CE);
    address private constant VERIFIER_B = address(0xB0B);
    address private constant OUTSIDER = address(0xBAD);

    bytes32 private constant AUTH_POLICY = keccak256("verifier-stake/auth");
    bytes32 private constant ASSET_POLICY = keccak256("verifier-stake/asset");
    bytes32 private constant RELEASE_POLICY = keccak256("verifier-stake/release");
    bytes32 private constant ACCOUNTING_POLICY = keccak256("verifier-stake/accounting");
    bytes32 private constant VAULT_ID = keccak256("compute/stake/verifier-collateral");
    bytes32 private constant POLICY_A = keccak256("compute/verifier-collateral/a");
    bytes32 private constant POLICY_B = keccak256("compute/verifier-collateral/b");

    ComputeVerifierRegistry420 private verifiers;
    ComputeStakeVerifierCollateral420 private stakeSource;

    MockVaultCapsVerifierCollateral420 private caps;
    VaultAuthorization420 private auth;
    VaultPolicyRegistry420 private policies;
    VaultRegistry420 private registry;
    VaultAccounting420 private accounting;
    AssetVault420 private vault;

    bytes32 private verifierId;

    function setUp() public {
        verifiers = new ComputeVerifierRegistry420(GOV);
        vm.prank(VERIFIER_A);
        verifierId = verifiers.register(keccak256("verifier-a"));
        vm.prank(GOV);
        verifiers.activate(verifierId);

        caps = new MockVaultCapsVerifierCollateral420();
        auth = new VaultAuthorization420(address(caps));
        policies = new VaultPolicyRegistry420(address(this));
        registry = new VaultRegistry420(address(auth), address(policies));
        accounting = new VaultAccounting420(address(registry));

        policies.setPolicy(
            AUTH_POLICY, VaultIds420.POLICY_AUTHORIZATION, keccak256("auth-v1"), bytes32(0), true
        );
        policies.setPolicy(
            ASSET_POLICY, VaultIds420.POLICY_ASSET, keccak256("asset-v1"), bytes32(0), true
        );
        policies.setPolicy(
            RELEASE_POLICY, VaultIds420.POLICY_RELEASE, keccak256("release-v1"), bytes32(0), true
        );
        policies.setPolicy(
            ACCOUNTING_POLICY, VaultIds420.POLICY_ACCOUNTING, keccak256("accounting-v1"), bytes32(0), true
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
            keccak256("verifier-collateral"),
            keccak256("verifier-collateral-manifest")
        );

        stakeSource = new ComputeStakeVerifierCollateral420(address(verifiers), address(vault));
        caps.setAllowed(
            address(stakeSource),
            VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_CREATE_OBLIGATION,
            auth.scopeForVault(VAULT_ID),
            true
        );
    }

    function _stake(address authority, bytes32 policy, uint256 amount)
        private
        returns (bytes32 id)
    {
        vm.deal(authority, amount);
        vm.prank(authority);
        (id,) = stakeSource.stake{value: amount}(verifierId, policy);
    }

    function testVerifierStakeIsBackedByCanonicalVaultObligation() public {
        bytes32 id = _stake(VERIFIER_A, POLICY_A, 100 ether);

        IComputeVerifierStakeSource420.PositionRead memory p =
            stakeSource.readVerifierPosition(verifierId, POLICY_A);
        require(p.positionId == id && p.positionRevision == 1, "position identity");
        require(p.authority == VERIFIER_A, "authority");
        require(p.activeAmount == 100 ether && p.slashableAmount == 100 ether && p.active, "amount");
        require(!p.exiting && p.withdrawableAt == 0, "later lifecycle leaked");

        ComputeStakeVerifierCollateral420.Tranche memory t = stakeSource.tranche(id, 1);
        VaultAccounting420.Obligation memory o = accounting.getObligation(t.obligationId);
        VaultAccounting420.AssetAccounting memory a =
            accounting.getAccounting(VAULT_ID, address(0));

        require(address(vault).balance == 100 ether, "vault custody");
        require(
            a.recordedBalance == 100 ether && a.reserved == 100 ether && a.claimable == 0,
            "vault accounting"
        );
        require(o.state == 1 && o.amount == 100 ether && o.beneficiary == VERIFIER_A, "obligation");
        require(
            o.obligationType == stakeSource.VERIFIER_COLLATERAL_TYPE() && o.sourceRef == id,
            "obligation binding"
        );
    }

    function testTopUpAcrossLifecycleRevisionKeepsSameAuthorityPosition() public {
        bytes32 id = _stake(VERIFIER_A, POLICY_A, 40 ether);

        vm.prank(VERIFIER_A);
        verifiers.suspend(verifierId);
        vm.prank(GOV);
        verifiers.activate(verifierId);

        bytes32 afterLifecycle = _stake(VERIFIER_A, POLICY_A, 60 ether);
        require(afterLifecycle == id, "lifecycle revision orphaned position");

        IComputeVerifierStakeSource420.PositionRead memory p =
            stakeSource.readVerifierPosition(verifierId, POLICY_A);
        require(p.positionRevision == 2, "position revision");
        require(p.activeAmount == 100 ether && p.slashableAmount == 100 ether, "aggregate");
        require(
            p.verifierRevision == verifiers.verifier(verifierId).revision,
            "latest verifier revision not retained"
        );
        require(accounting.getAccounting(VAULT_ID, address(0)).reserved == 100 ether, "reserve");
    }

    function testAuthorityRotationDoesNotTransferExistingCollateral() public {
        bytes32 oldId = _stake(VERIFIER_A, POLICY_A, 55 ether);

        vm.prank(GOV);
        verifiers.proposeRotation(verifierId, VERIFIER_B, keccak256("verifier-b"));
        vm.prank(VERIFIER_B);
        verifiers.acceptRotation(verifierId);

        IComputeVerifierStakeSource420.PositionRead memory current =
            stakeSource.readVerifierPosition(verifierId, POLICY_A);
        require(current.positionId == bytes32(0), "rotation inherited old collateral");

        ComputeStakeVerifierCollateral420.Position memory oldPosition = stakeSource.position(oldId);
        require(
            oldPosition.authority == VERIFIER_A && oldPosition.activeAmount == 55 ether,
            "old collateral rewritten"
        );

        bytes32 newId = _stake(VERIFIER_B, POLICY_A, 25 ether);
        require(newId != oldId, "rotation reused old position");
        IComputeVerifierStakeSource420.PositionRead memory newPosition =
            stakeSource.readVerifierPosition(verifierId, POLICY_A);
        require(
            newPosition.authority == VERIFIER_B && newPosition.activeAmount == 25 ether,
            "new authority collateral"
        );
        require(accounting.getAccounting(VAULT_ID, address(0)).reserved == 80 ether, "combined backing");
    }

    function testPolicyPositionsRemainIsolated() public {
        bytes32 a = _stake(VERIFIER_A, POLICY_A, 20 ether);
        bytes32 b = _stake(VERIFIER_A, POLICY_B, 30 ether);

        require(a != b, "policy collision");
        require(stakeSource.readVerifierPosition(verifierId, POLICY_A).activeAmount == 20 ether, "a");
        require(stakeSource.readVerifierPosition(verifierId, POLICY_B).activeAmount == 30 ether, "b");
        require(accounting.getAccounting(VAULT_ID, address(0)).reserved == 50 ether, "reserve");
    }

    function testNonAuthorityCannotStakeForVerifier() public {
        vm.deal(OUTSIDER, 10 ether);
        vm.prank(OUTSIDER);
        (bool ok,) = address(stakeSource).call{value: 10 ether}(
            abi.encodeCall(stakeSource.stake, (verifierId, POLICY_A))
        );
        require(!ok, "outsider staked");
        require(address(vault).balance == 0, "failed stake moved funds");
    }

    function testRetiredVerifierCannotAddCollateral() public {
        vm.prank(GOV);
        verifiers.retire(verifierId);

        vm.deal(VERIFIER_A, 10 ether);
        vm.prank(VERIFIER_A);
        (bool ok,) = address(stakeSource).call{value: 10 ether}(
            abi.encodeCall(stakeSource.stake, (verifierId, POLICY_A))
        );
        require(!ok, "retired verifier staked");
        require(address(vault).balance == 0, "retired stake moved funds");
    }

    function testMissingVaultCreateGrantRevertsAtomically() public {
        caps.setAllowed(
            address(stakeSource),
            VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_CREATE_OBLIGATION,
            auth.scopeForVault(VAULT_ID),
            false
        );

        vm.deal(VERIFIER_A, 12 ether);
        vm.prank(VERIFIER_A);
        (bool ok,) = address(stakeSource).call{value: 12 ether}(
            abi.encodeCall(stakeSource.stake, (verifierId, POLICY_A))
        );
        require(!ok, "stake without grant");

        VaultAccounting420.AssetAccounting memory a =
            accounting.getAccounting(VAULT_ID, address(0));
        require(
            address(vault).balance == 0 && a.recordedBalance == 0 && a.reserved == 0,
            "rollback failed"
        );
        require(
            stakeSource.readVerifierPosition(verifierId, POLICY_A).positionId == bytes32(0),
            "position leaked"
        );
    }

    function testDirectEthIsRejected() public {
        vm.deal(VERIFIER_A, 1 ether);
        vm.prank(VERIFIER_A);
        (bool ok,) = address(stakeSource).call{value: 1 ether}("");
        require(!ok && address(stakeSource).balance == 0, "direct eth accepted");
    }
}
