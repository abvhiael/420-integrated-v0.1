// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeStakeRewardAccounting420.sol";
import "../src/compute/ComputeStakeRewardPolicy420.sol";
import "../src/interfaces/IComputeStakeRewardSource420.sol";
import "../src/interfaces/IComputeSlashableCollateral420.sol";
import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/vault/VaultAuthorization420.sol";
import "../src/vault/VaultPolicyRegistry420.sol";
import "../src/vault/VaultRegistry420.sol";
import "../src/vault/VaultAccounting420.sol";
import "../src/vault/AssetVault420.sol";
import "../src/vault/VaultIds420.sol";

interface VmComputeStakeReward420 {
    function prank(address caller) external;
    function deal(address account, uint256 newBalance) external;
    function warp(uint256) external;
}

contract MockRewardCaps420 is ICapabilityRegistry420 {
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

contract MockComputeStakeRewardSource420 is IComputeStakeRewardSource420 {
    mapping(bytes32 => RewardEvidence) private _rewards;

    function set(bytes32 rewardRef, RewardEvidence calldata evidence) external {
        _rewards[rewardRef] = evidence;
    }

    function rewardEvidence(bytes32 rewardRef)
        external
        view
        returns (RewardEvidence memory evidence)
    {
        evidence = _rewards[rewardRef];
    }
}

contract MockRewardCollateral420 is IComputeSlashableCollateral420 {
    struct Snapshot {
        uint8 subjectKind;
        bytes32 subjectRef;
        address beneficiary;
        bytes32 stakePolicyId;
        uint64 positionRevision;
        uint64 openedAt;
        uint32 slashPolicyRevision;
        bytes32 slashPolicyCommitment;
        uint256 slashableAmount;
        bool active;
        bool exiting;
        bool exists;
    }

    address public override slashAuthorization;
    mapping(bytes32 => Snapshot) private _snapshots;

    function set(bytes32 positionId, Snapshot calldata snapshot) external {
        _snapshots[positionId] = snapshot;
    }

    function slashSnapshot(bytes32 positionId)
        external
        view
        returns (
            uint8 subjectKind,
            bytes32 subjectRef,
            address beneficiary,
            bytes32 stakePolicyId,
            uint64 positionRevision,
            uint64 openedAt,
            uint32 slashPolicyRevision,
            bytes32 slashPolicyCommitment,
            uint256 slashableAmount,
            bool active,
            bool exiting,
            bool exists
        )
    {
        Snapshot memory s = _snapshots[positionId];
        return (
            s.subjectKind,
            s.subjectRef,
            s.beneficiary,
            s.stakePolicyId,
            s.positionRevision,
            s.openedAt,
            s.slashPolicyRevision,
            s.slashPolicyCommitment,
            s.slashableAmount,
            s.active,
            s.exiting,
            s.exists
        );
    }
}

contract ComputeStakeRewardAccounting420Test {
    VmComputeStakeReward420 private constant vm =
        VmComputeStakeReward420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant GOV = address(0x420);
    address private constant WORKER = address(0xA11CE);
    address private constant VERIFIER = address(0xB0B);
    address private constant FUNDER = address(0xF00D);
    address private constant OUTSIDER = address(0xBAD);

    bytes32 private constant STAKE_POLICY = keccak256("cmp/stake/reward");
    bytes32 private constant WORKER_POSITION = keccak256("worker/reward/position");
    bytes32 private constant VERIFIER_POSITION = keccak256("verifier/reward/position");
    bytes32 private constant WORKER_ID = keccak256("worker/reward/id");
    bytes32 private constant VERIFIER_ID = keccak256("verifier/reward/id");

    bytes32 private constant AUTH_POLICY = keccak256("reward/auth");
    bytes32 private constant ASSET_POLICY = keccak256("reward/asset");
    bytes32 private constant RELEASE_POLICY = keccak256("reward/release");
    bytes32 private constant ACCOUNTING_POLICY = keccak256("reward/accounting");
    bytes32 private constant VAULT_ID = keccak256("compute/stake/reward/vault");

    MockComputeStakeRewardSource420 private source;
    MockRewardCollateral420 private workerCollateral;
    MockRewardCollateral420 private verifierCollateral;
    ComputeStakeRewardPolicy420 private rewardPolicy;
    ComputeStakeRewardAccounting420 private rewards;

    MockRewardCaps420 private caps;
    VaultAuthorization420 private auth;
    VaultPolicyRegistry420 private vaultPolicies;
    VaultRegistry420 private registry;
    VaultAccounting420 private accounting;
    AssetVault420 private vault;

    uint32 private workerRewardPolicyRevision;
    uint32 private verifierRewardPolicyRevision;

    function setUp() public {
        source = new MockComputeStakeRewardSource420();
        workerCollateral = new MockRewardCollateral420();
        verifierCollateral = new MockRewardCollateral420();

        rewardPolicy = new ComputeStakeRewardPolicy420(GOV);
        vm.prank(GOV);
        workerRewardPolicyRevision =
            rewardPolicy.publish(STAKE_POLICY, rewardPolicy.SUBJECT_WORKER(), address(source), 50 ether);
        vm.prank(GOV);
        verifierRewardPolicyRevision =
            rewardPolicy.publish(STAKE_POLICY, rewardPolicy.SUBJECT_VERIFIER(), address(source), 25 ether);

        caps = new MockRewardCaps420();
        auth = new VaultAuthorization420(address(caps));
        vaultPolicies = new VaultPolicyRegistry420(address(this));
        registry = new VaultRegistry420(address(auth), address(vaultPolicies));
        accounting = new VaultAccounting420(address(registry));

        vaultPolicies.setPolicy(
            AUTH_POLICY, VaultIds420.POLICY_AUTHORIZATION, keccak256("auth"), bytes32(0), true
        );
        vaultPolicies.setPolicy(
            ASSET_POLICY, VaultIds420.POLICY_ASSET, keccak256("asset"), bytes32(0), true
        );
        vaultPolicies.setPolicy(
            RELEASE_POLICY, VaultIds420.POLICY_RELEASE, keccak256("release"), bytes32(0), true
        );
        vaultPolicies.setPolicy(
            ACCOUNTING_POLICY, VaultIds420.POLICY_ACCOUNTING, keccak256("accounting"), bytes32(0), true
        );

        vault = new AssetVault420(
            VAULT_ID,
            address(registry),
            address(auth),
            address(accounting),
            address(this)
        );
        registry.registerVault(
            VAULT_ID,
            address(vault),
            VaultIds420.VAULT_RESERVE,
            AUTH_POLICY,
            ASSET_POLICY,
            RELEASE_POLICY,
            ACCOUNTING_POLICY,
            bytes32(0),
            keccak256("compute-stake-reward"),
            keccak256("compute-stake-reward-manifest")
        );

        rewards = new ComputeStakeRewardAccounting420(
            address(rewardPolicy),
            address(vault),
            address(workerCollateral),
            address(verifierCollateral)
        );

        bytes32 vaultScope = auth.scopeForVault(VAULT_ID);
        caps.setAllowed(
            address(rewards),
            VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_CREATE_OBLIGATION,
            vaultScope,
            true
        );
        caps.setAllowed(
            address(rewards),
            VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_RELEASE_OBLIGATION,
            vaultScope,
            true
        );

        vm.deal(FUNDER, 200 ether);
        vm.prank(FUNDER);
        vault.depositNative{value: 200 ether}();

        workerCollateral.set(
            WORKER_POSITION,
            MockRewardCollateral420.Snapshot({
                subjectKind: 1,
                subjectRef: WORKER_ID,
                beneficiary: WORKER,
                stakePolicyId: STAKE_POLICY,
                positionRevision: 3,
                openedAt: uint64(block.timestamp),
                slashPolicyRevision: 1,
                slashPolicyCommitment: keccak256("worker/slash/policy"),
                slashableAmount: 100 ether,
                active: true,
                exiting: false,
                exists: true
            })
        );

        verifierCollateral.set(
            VERIFIER_POSITION,
            MockRewardCollateral420.Snapshot({
                subjectKind: 2,
                subjectRef: VERIFIER_ID,
                beneficiary: VERIFIER,
                stakePolicyId: STAKE_POLICY,
                positionRevision: 4,
                openedAt: uint64(block.timestamp),
                slashPolicyRevision: 1,
                slashPolicyCommitment: keccak256("verifier/slash/policy"),
                slashableAmount: 100 ether,
                active: true,
                exiting: false,
                exists: true
            })
        );
    }

    function _workerReward(
        bytes32 rewardRef,
        uint256 amount,
        bool finalEarned
    ) private {
        source.set(
            rewardRef,
            IComputeStakeRewardSource420.RewardEvidence({
                positionId: WORKER_POSITION,
                subjectKind: 1,
                subjectRef: WORKER_ID,
                beneficiary: WORKER,
                stakePolicyId: STAKE_POLICY,
                amount: amount,
                earnedAt: uint64(block.timestamp),
                evidenceCommitment: keccak256(abi.encode("worker/reward", rewardRef, amount)),
                finalEarned: finalEarned
            })
        );
    }

    function testWorkerRewardCreatesExactClaimableVaultObligationAndClaim() public {
        bytes32 rewardRef = keccak256("worker/reward/1");
        _workerReward(rewardRef, 12 ether, true);

        (bytes32 rewardId, bytes32 obligationId) =
            rewards.reward(STAKE_POLICY, 1, workerRewardPolicyRevision, rewardRef);

        ComputeStakeRewardAccounting420.RewardRecord memory record =
            rewards.rewardRecord(rewardId);
        require(record.beneficiary == WORKER, "beneficiary drift");
        require(record.amount == 12 ether, "reward amount drift");
        require(record.obligationId == obligationId, "obligation drift");
        require(rewards.creditedByBeneficiary(WORKER) == 12 ether, "beneficiary accounting");
        require(rewards.creditedByPosition(WORKER_POSITION) == 12 ether, "position accounting");

        VaultAccounting420.Obligation memory obligation =
            accounting.getObligation(obligationId);
        require(obligation.beneficiary == WORKER, "vault beneficiary");
        require(obligation.amount == 12 ether, "vault amount");
        require(obligation.state == 2, "reward not claimable");

        uint256 beforeBalance = WORKER.balance;
        vm.prank(WORKER);
        vault.claim(keccak256("worker/reward/claim/1"), obligationId);
        require(WORKER.balance == beforeBalance + 12 ether, "reward not paid");

        VaultAccounting420.AssetAccounting memory a =
            accounting.getAccounting(VAULT_ID, address(0));
        require(a.recordedBalance == 188 ether, "vault backing mismatch");
        require(a.reserved == 0 && a.claimable == 0, "vault encumbrance mismatch");
        require(a.released == 12 ether, "vault released mismatch");
    }

    function testRewardReplayFailsClosed() public {
        bytes32 rewardRef = keccak256("worker/reward/replay");
        _workerReward(rewardRef, 5 ether, true);
        rewards.reward(STAKE_POLICY, 1, workerRewardPolicyRevision, rewardRef);

        (bool ok,) = address(rewards).call(
            abi.encodeCall(
                rewards.reward,
                (STAKE_POLICY, uint8(1), workerRewardPolicyRevision, rewardRef)
            )
        );
        require(!ok, "duplicate reward credited");
        require(rewards.creditedByBeneficiary(WORKER) == 5 ether, "replay changed accounting");
    }

    function testNonFinalAndOverCapRewardsFailClosed() public {
        bytes32 nonFinal = keccak256("worker/reward/non-final");
        _workerReward(nonFinal, 5 ether, false);
        (bool ok,) = address(rewards).call(
            abi.encodeCall(
                rewards.reward,
                (STAKE_POLICY, uint8(1), workerRewardPolicyRevision, nonFinal)
            )
        );
        require(!ok, "non-final reward credited");

        bytes32 overCap = keccak256("worker/reward/over-cap");
        _workerReward(overCap, 51 ether, true);
        (ok,) = address(rewards).call(
            abi.encodeCall(
                rewards.reward,
                (STAKE_POLICY, uint8(1), workerRewardPolicyRevision, overCap)
            )
        );
        require(!ok, "over-cap reward credited");
        require(rewards.creditedByBeneficiary(WORKER) == 0, "failed reward accounted");
    }

    function testWrongBeneficiarySubjectAndStakePolicyFailClosed() public {
        bytes32 rewardRef = keccak256("worker/reward/mismatch");
        _workerReward(rewardRef, 4 ether, true);

        IComputeStakeRewardSource420.RewardEvidence memory evidence =
            source.rewardEvidence(rewardRef);
        evidence.beneficiary = OUTSIDER;
        source.set(rewardRef, evidence);

        (bool ok,) = address(rewards).call(
            abi.encodeCall(
                rewards.reward,
                (STAKE_POLICY, uint8(1), workerRewardPolicyRevision, rewardRef)
            )
        );
        require(!ok, "wrong beneficiary rewarded");

        evidence.beneficiary = WORKER;
        evidence.subjectRef = keccak256("other-worker");
        source.set(rewardRef, evidence);
        (ok,) = address(rewards).call(
            abi.encodeCall(
                rewards.reward,
                (STAKE_POLICY, uint8(1), workerRewardPolicyRevision, rewardRef)
            )
        );
        require(!ok, "wrong subject rewarded");

        evidence.subjectRef = WORKER_ID;
        evidence.stakePolicyId = keccak256("other-policy");
        source.set(rewardRef, evidence);
        (ok,) = address(rewards).call(
            abi.encodeCall(
                rewards.reward,
                (STAKE_POLICY, uint8(1), workerRewardPolicyRevision, rewardRef)
            )
        );
        require(!ok, "wrong stake policy rewarded");
    }

    function testVerifierRewardUsesVerifierCollateralIdentity() public {
        bytes32 rewardRef = keccak256("verifier/reward/1");
        source.set(
            rewardRef,
            IComputeStakeRewardSource420.RewardEvidence({
                positionId: VERIFIER_POSITION,
                subjectKind: 2,
                subjectRef: VERIFIER_ID,
                beneficiary: VERIFIER,
                stakePolicyId: STAKE_POLICY,
                amount: 7 ether,
                earnedAt: uint64(block.timestamp),
                evidenceCommitment: keccak256("verifier/reward/evidence"),
                finalEarned: true
            })
        );

        rewards.reward(STAKE_POLICY, 2, verifierRewardPolicyRevision, rewardRef);
        require(rewards.creditedByBeneficiary(VERIFIER) == 7 ether, "verifier not credited");
        require(rewards.creditedByPosition(VERIFIER_POSITION) == 7 ether, "verifier position");
    }

    function testHistoricalEarnedRewardSurvivesLaterInactivePosition() public {
        bytes32 rewardRef = keccak256("worker/reward/historical");
        _workerReward(rewardRef, 3 ether, true);

        MockRewardCollateral420.Snapshot memory snapshot =
            MockRewardCollateral420.Snapshot({
                subjectKind: 1,
                subjectRef: WORKER_ID,
                beneficiary: WORKER,
                stakePolicyId: STAKE_POLICY,
                positionRevision: 4,
                openedAt: uint64(block.timestamp),
                slashPolicyRevision: 1,
                slashPolicyCommitment: keccak256("worker/slash/policy"),
                slashableAmount: 0,
                active: false,
                exiting: false,
                exists: true
            });
        workerCollateral.set(WORKER_POSITION, snapshot);

        rewards.reward(STAKE_POLICY, 1, workerRewardPolicyRevision, rewardRef);
        require(rewards.creditedByBeneficiary(WORKER) == 3 ether, "historical reward confiscated");
    }

    function testRewardBeforeCollateralOpenedFailsClosed() public {
        vm.warp(block.timestamp + 100);
        bytes32 position = keccak256("late/position");
        workerCollateral.set(
            position,
            MockRewardCollateral420.Snapshot({
                subjectKind: 1,
                subjectRef: WORKER_ID,
                beneficiary: WORKER,
                stakePolicyId: STAKE_POLICY,
                positionRevision: 1,
                openedAt: uint64(block.timestamp),
                slashPolicyRevision: 1,
                slashPolicyCommitment: keccak256("worker/slash/policy"),
                slashableAmount: 10 ether,
                active: true,
                exiting: false,
                exists: true
            })
        );

        bytes32 rewardRef = keccak256("worker/reward/predates");
        source.set(
            rewardRef,
            IComputeStakeRewardSource420.RewardEvidence({
                positionId: position,
                subjectKind: 1,
                subjectRef: WORKER_ID,
                beneficiary: WORKER,
                stakePolicyId: STAKE_POLICY,
                amount: 2 ether,
                earnedAt: uint64(block.timestamp - 1),
                evidenceCommitment: keccak256("worker/reward/predates/evidence"),
                finalEarned: true
            })
        );

        (bool ok,) = address(rewards).call(
            abi.encodeCall(
                rewards.reward,
                (STAKE_POLICY, uint8(1), workerRewardPolicyRevision, rewardRef)
            )
        );
        require(!ok, "pre-stake reward credited");
    }

    function testInsufficientBackingRevertsWithoutConsumingReward() public {
        bytes32 rewardRef = keccak256("worker/reward/unbacked");
        _workerReward(rewardRef, 20 ether, true);

        // Encumber all but 10 ether of the reward Vault through an independent test-only obligation.
        caps.setAllowed(
            address(this),
            VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_CREATE_OBLIGATION,
            auth.scopeForVault(VAULT_ID),
            true
        );
        vault.createObligation(
            keccak256("encumber/op"),
            keccak256("encumber/obligation"),
            address(0),
            OUTSIDER,
            190 ether,
            keccak256("test/encumber"),
            keccak256("test/encumber/source")
        );

        (bool ok,) = address(rewards).call(
            abi.encodeCall(
                rewards.reward,
                (STAKE_POLICY, uint8(1), workerRewardPolicyRevision, rewardRef)
            )
        );
        require(!ok, "unbacked reward credited");
        require(rewards.creditedByBeneficiary(WORKER) == 0, "failed credit persisted");

        bytes32 consumedKey = keccak256(abi.encode(address(source), rewardRef));
        require(!rewards.sourceRewardConsumed(consumedKey), "failed reward consumed");
    }
}
