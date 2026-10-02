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
    function warp(uint256) external;
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

contract MockObjectiveSlashAdapterCollateral420 {}

contract MockSlashHoldCollateral420 {
    mapping(bytes32 => uint256) public outstandingSlash;
    address public distributionExecutor;

    constructor(address executor_) {
        distributionExecutor = executor_;
    }

    function set(bytes32 positionId, uint256 amount) external {
        outstandingSlash[positionId] = amount;
    }
}

contract MockVerifierDisputeStakeHold420 is IComputeVerifierDisputeStakeHold420 {
    mapping(address => bool) public held;

    function set(address verifier, bool value) external {
        held[verifier] = value;
    }

    function verifierStakeHold(address verifier) external view returns (bool) {
        return held[verifier];
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
    uint64 private constant EXIT_DELAY = 5 days;

    ComputeVerifierRegistry420 private verifiers;
    ComputeStakeVerifierCollateral420 private stakeSource;
    ComputeStakeExitPolicy420 private exitPolicy;
    ComputeStakeSlashPolicy420 private slashPolicy;

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

        exitPolicy = new ComputeStakeExitPolicy420(GOV);
        vm.prank(GOV);
        exitPolicy.publish(POLICY_A, EXIT_DELAY);
        vm.prank(GOV);
        exitPolicy.publish(POLICY_B, EXIT_DELAY);

        MockObjectiveSlashAdapterCollateral420 slashAdapter =
            new MockObjectiveSlashAdapterCollateral420();
        slashPolicy = new ComputeStakeSlashPolicy420(GOV);
        vm.prank(GOV);
        slashPolicy.publish(
            POLICY_A,
            2,
            address(slashAdapter),
            keccak256("verifier-slash"),
            bytes32(0),
            0,
            bytes32(0),
            1000,
            0
        );
        vm.prank(GOV);
        slashPolicy.publish(
            POLICY_B,
            2,
            address(slashAdapter),
            keccak256("verifier-slash"),
            bytes32(0),
            0,
            bytes32(0),
            1000,
            0
        );

        stakeSource =
            new ComputeStakeVerifierCollateral420(
                address(verifiers), address(vault), address(exitPolicy), address(slashPolicy)
            );
        caps.setAllowed(
            address(stakeSource),
            VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_CREATE_OBLIGATION,
            auth.scopeForVault(VAULT_ID),
            true
        );
        caps.setAllowed(
            address(stakeSource),
            VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_RELEASE_OBLIGATION,
            auth.scopeForVault(VAULT_ID),
            true
        );
        caps.setAllowed(
            address(stakeSource),
            VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_CLAIM,
            auth.scopeForVault(VAULT_ID),
            true
        );
        caps.setAllowed(
            address(stakeSource),
            VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_CANCEL_OBLIGATION,
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

    function testVerifierExitSnapshotsDelayAndKeepsCollateralSlashable() public {
        bytes32 id = _stake(VERIFIER_A, POLICY_A, 100 ether);
        uint256 requestedAt = block.timestamp;

        vm.prank(VERIFIER_A);
        uint64 maturity = stakeSource.requestExit(id);

        IComputeVerifierStakeSource420.PositionRead memory p =
            stakeSource.readVerifierPosition(verifierId, POLICY_A);
        require(p.exiting, "exit not queued");
        require(p.active && p.activeAmount == 100 ether && p.slashableAmount == 100 ether, "collateral unlocked");
        require(maturity == requestedAt + EXIT_DELAY && p.withdrawableAt == maturity, "delay");

        ComputeStakeVerifierCollateral420.Position memory full = stakeSource.position(id);
        require(full.exitPolicyRevision == 1 && full.exitPolicyCommitment != bytes32(0), "policy snapshot");
    }

    function testOldAuthorityCanExitHistoricalPositionAfterRotation() public {
        bytes32 oldId = _stake(VERIFIER_A, POLICY_A, 55 ether);

        vm.prank(GOV);
        verifiers.proposeRotation(verifierId, VERIFIER_B, keccak256("verifier-b"));
        vm.prank(VERIFIER_B);
        verifiers.acceptRotation(verifierId);

        vm.prank(VERIFIER_A);
        uint64 maturity = stakeSource.requestExit(oldId);
        vm.warp(maturity);

        uint256 before = VERIFIER_A.balance;
        vm.prank(VERIFIER_A);
        (uint256 amount,) = stakeSource.withdraw(oldId, 1);
        require(amount == 55 ether && VERIFIER_A.balance == before + 55 ether, "old authority payout");

        ComputeStakeVerifierCollateral420.Position memory oldPosition = stakeSource.position(oldId);
        require(!oldPosition.active && oldPosition.activeAmount == 0 && oldPosition.slashableAmount == 0, "old position active");

        IComputeVerifierStakeSource420.PositionRead memory current =
            stakeSource.readVerifierPosition(verifierId, POLICY_A);
        require(current.positionId == bytes32(0), "old exit became current");
    }

    function testVerifierWithdrawalBeforeMaturityFailsAndTopUpDuringExitFails() public {
        bytes32 id = _stake(VERIFIER_A, POLICY_A, 30 ether);

        vm.prank(VERIFIER_A);
        stakeSource.requestExit(id);

        vm.prank(VERIFIER_A);
        (bool ok,) = address(stakeSource).call(
            abi.encodeCall(stakeSource.withdraw, (id, uint64(1)))
        );
        require(!ok, "premature verifier withdrawal");

        vm.deal(VERIFIER_A, 1 ether);
        vm.prank(VERIFIER_A);
        (ok,) = address(stakeSource).call{value: 1 ether}(
            abi.encodeCall(stakeSource.stake, (verifierId, POLICY_A))
        );
        require(!ok, "verifier top-up during exit");
    }

    function testVerifierExitDelayRevisionCannotRewritePendingExit() public {
        bytes32 id = _stake(VERIFIER_A, POLICY_A, 25 ether);
        uint256 requestedAt = block.timestamp;
        vm.prank(VERIFIER_A);
        uint64 maturity = stakeSource.requestExit(id);

        vm.prank(GOV);
        exitPolicy.publish(POLICY_A, 1 days);

        vm.warp(requestedAt + 1 days);
        vm.prank(VERIFIER_A);
        (bool ok,) = address(stakeSource).call(
            abi.encodeCall(stakeSource.withdraw, (id, uint64(1)))
        );
        require(!ok, "new verifier delay accelerated old exit");

        vm.warp(maturity);
        vm.prank(VERIFIER_A);
        (uint256 amount,) = stakeSource.withdraw(id, 1);
        require(amount == 25 ether, "mature verifier withdrawal");
    }

    function testVerifierBatchedWithdrawalPreservesRemainingSlashableCollateral() public {
        bytes32 id = _stake(VERIFIER_A, POLICY_A, 35 ether);
        _stake(VERIFIER_A, POLICY_A, 65 ether);

        vm.prank(VERIFIER_A);
        uint64 maturity = stakeSource.requestExit(id);
        vm.warp(maturity);

        vm.prank(VERIFIER_A);
        (uint256 first,) = stakeSource.withdraw(id, 1);
        require(first == 35 ether, "first verifier batch");

        IComputeVerifierStakeSource420.PositionRead memory mid =
            stakeSource.readVerifierPosition(verifierId, POLICY_A);
        require(mid.exiting && mid.activeAmount == 65 ether && mid.slashableAmount == 65 ether, "mid verifier state");

        vm.prank(VERIFIER_A);
        (uint256 second,) = stakeSource.withdraw(id, 10);
        require(second == 65 ether, "second verifier batch");

        IComputeVerifierStakeSource420.PositionRead memory done =
            stakeSource.readVerifierPosition(verifierId, POLICY_A);
        require(!done.active && !done.exiting && done.activeAmount == 0 && done.slashableAmount == 0, "done verifier state");

        VaultAccounting420.AssetAccounting memory a =
            accounting.getAccounting(VAULT_ID, address(0));
        require(
            address(vault).balance == 0
                && a.recordedBalance == 0
                && a.reserved == 0
                && a.claimable == 0
                && a.released == 100 ether,
            "verifier final accounting"
        );
    }

    function testOnlyStoredVerifierAuthorityCanRequestAndWithdrawExit() public {
        bytes32 id = _stake(VERIFIER_A, POLICY_A, 20 ether);

        vm.prank(OUTSIDER);
        (bool ok,) = address(stakeSource).call(
            abi.encodeCall(stakeSource.requestExit, (id))
        );
        require(!ok, "outsider requested verifier exit");

        vm.prank(VERIFIER_A);
        uint64 maturity = stakeSource.requestExit(id);
        vm.warp(maturity);

        vm.prank(OUTSIDER);
        (ok,) = address(stakeSource).call(
            abi.encodeCall(stakeSource.withdraw, (id, uint64(1)))
        );
        require(!ok, "outsider withdrew verifier collateral");
    }

    function testOutstandingObjectiveSlashBlocksMatureVerifierWithdrawal() public {
        bytes32 id = _stake(VERIFIER_A, POLICY_A, 25 ether);
        MockSlashHoldCollateral420 hold = new MockSlashHoldCollateral420(address(this));
        stakeSource.bindSlashAuthorization(address(hold));

        vm.prank(VERIFIER_A);
        uint64 maturity = stakeSource.requestExit(id);
        vm.warp(maturity);
        hold.set(id, 1 ether);

        vm.prank(VERIFIER_A);
        (bool ok,) = address(stakeSource).call(
            abi.encodeCall(stakeSource.withdraw, (id, uint64(1)))
        );
        require(!ok, "verifier slash hold bypassed");
        require(stakeSource.position(id).activeAmount == 25 ether, "held verifier collateral moved");
    }

    function testActiveDisputeStakeHoldBlocksMatureVerifierWithdrawal() public {
        bytes32 id = _stake(VERIFIER_A, POLICY_A, 25 ether);
        MockVerifierDisputeStakeHold420 disputeHold =
            new MockVerifierDisputeStakeHold420();
        stakeSource.bindDisputeStakeHold(address(disputeHold));

        vm.prank(VERIFIER_A);
        uint64 maturity = stakeSource.requestExit(id);
        vm.warp(maturity);

        disputeHold.set(VERIFIER_A, true);
        vm.prank(VERIFIER_A);
        (bool ok,) = address(stakeSource).call(
            abi.encodeCall(stakeSource.withdraw, (id, uint64(1)))
        );
        require(!ok, "active dispute stake hold bypassed");
        require(
            stakeSource.position(id).activeAmount == 25 ether,
            "dispute-held verifier collateral moved"
        );

        disputeHold.set(VERIFIER_A, false);
        vm.prank(VERIFIER_A);
        (uint256 amount,) = stakeSource.withdraw(id, 1);
        require(amount == 25 ether, "released dispute hold did not permit withdrawal");
    }

    function testPartialVerifierSlashRebindsRemainderAndPaysExactRecipients() public {
        bytes32 id = _stake(VERIFIER_A, POLICY_A, 50 ether);
        MockSlashHoldCollateral420 hold = new MockSlashHoldCollateral420(address(this));
        stakeSource.bindSlashAuthorization(address(hold));

        address[] memory recipients = new address[](2);
        recipients[0] = address(0x3333);
        recipients[1] = address(0x4444);
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 5 ether;
        amounts[1] = 15 ether;

        (uint256 preview, uint64 visited) =
            stakeSource.previewSlashBatch(id, 20 ether, 1);
        require(preview == 20 ether && visited == 1, "slash preview");

        stakeSource.executeSlashBatch(
            id, keccak256("verifier-slash-auth"), 20 ether, 1, recipients, amounts
        );

        require(recipients[0].balance == 5 ether, "challenger payout");
        require(recipients[1].balance == 15 ether, "treasury payout");

        ComputeStakeVerifierCollateral420.Tranche memory t = stakeSource.tranche(id, 1);
        require(t.amount == 30 ether && t.obligationId != bytes32(0), "remainder tranche");
        VaultAccounting420.Obligation memory o = accounting.getObligation(t.obligationId);
        require(
            o.state == 1
                && o.beneficiary == VERIFIER_A
                && o.amount == 30 ether
                && o.obligationType == stakeSource.VERIFIER_COLLATERAL_TYPE()
                && o.sourceRef == id,
            "remainder obligation"
        );

        ComputeStakeVerifierCollateral420.Position memory p = stakeSource.position(id);
        require(p.activeAmount == 30 ether && p.slashableAmount == 30 ether && p.active, "position");

        VaultAccounting420.AssetAccounting memory a =
            accounting.getAccounting(VAULT_ID, address(0));
        require(
            address(vault).balance == 30 ether
                && a.recordedBalance == 30 ether
                && a.reserved == 30 ether
                && a.claimable == 0
                && a.released == 20 ether,
            "slash accounting"
        );
    }

    function testDirectEthIsRejected() public {
        vm.deal(VERIFIER_A, 1 ether);
        vm.prank(VERIFIER_A);
        (bool ok,) = address(stakeSource).call{value: 1 ether}("");
        require(!ok && address(stakeSource).balance == 0, "direct eth accepted");
    }
}
