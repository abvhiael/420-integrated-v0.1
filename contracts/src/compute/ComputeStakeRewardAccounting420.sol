// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/IComputeSlashableCollateral420.sol";
import "../interfaces/IComputeStakeRewardSource420.sol";
import "../vault/AssetVault420.sol";
import "./ComputeStakeRewardPolicy420.sol";

/// @notice Replay-safe CMP worker/verifier reward accounting backed by a separately funded Vault.
/// @dev Reward arithmetic/evidence comes only from a preauthorized source. This contract never
///      mints, debits payer escrow, compounds collateral, or chooses a different beneficiary.
contract ComputeStakeRewardAccounting420 is I420System {
    bytes32 public constant REWARD_DOMAIN =
        keccak256("420Integrated.ComputeMarket.StakeReward.v1");
    bytes32 public constant REWARD_OBLIGATION_DOMAIN =
        keccak256("420Integrated.ComputeMarket.StakeRewardObligation.v1");
    bytes32 public constant REWARD_OBLIGATION_TYPE =
        keccak256("420/CMP/STAKE/REWARD/V1");

    struct RewardRecord {
        bytes32 rewardId;
        bytes32 rewardRef;
        bytes32 positionId;
        uint8 subjectKind;
        bytes32 subjectRef;
        address beneficiary;
        bytes32 stakePolicyId;
        address rewardSource;
        uint32 rewardPolicyRevision;
        bytes32 rewardPolicyCommitment;
        bytes32 evidenceCommitment;
        uint256 amount;
        uint64 earnedAt;
        uint64 creditedAt;
        bytes32 obligationId;
        bool exists;
    }

    ComputeStakeRewardPolicy420 public immutable policies;
    AssetVault420 public immutable rewardVault;
    address public immutable workerCollateral;
    address public immutable verifierCollateral;

    mapping(bytes32 => RewardRecord) private _rewards;
    mapping(bytes32 => bool) public sourceRewardConsumed;
    mapping(address => uint256) public creditedByBeneficiary;
    mapping(bytes32 => uint256) public creditedByPosition;

    error InvalidConfiguration();
    error InvalidReward();
    error Replay();

    event RewardCredited(
        bytes32 indexed rewardId,
        bytes32 indexed rewardRef,
        bytes32 indexed positionId,
        uint8 subjectKind,
        bytes32 subjectRef,
        address beneficiary,
        bytes32 stakePolicyId,
        address rewardSource,
        uint256 amount,
        bytes32 obligationId
    );

    constructor(
        address policies_,
        address rewardVault_,
        address workerCollateral_,
        address verifierCollateral_
    ) {
        if (
            policies_.code.length == 0
                || rewardVault_.code.length == 0
                || workerCollateral_.code.length == 0
                || verifierCollateral_.code.length == 0
        ) revert InvalidConfiguration();

        policies = ComputeStakeRewardPolicy420(policies_);
        rewardVault = AssetVault420(payable(rewardVault_));
        workerCollateral = workerCollateral_;
        verifierCollateral = verifierCollateral_;
    }

    function systemName() external pure returns (string memory) {
        return "ComputeStakeRewardAccounting420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    /// @notice Credit one final, policy-authorized reward into a canonical Vault obligation.
    /// @dev Permissionless relay; caller supplies no beneficiary or amount.
    function reward(
        bytes32 stakePolicyId,
        uint8 subjectKind,
        uint32 rewardPolicyRevision,
        bytes32 rewardRef
    ) external returns (bytes32 rewardId, bytes32 obligationId) {
        if (
            stakePolicyId == bytes32(0)
                || rewardRef == bytes32(0)
                || rewardPolicyRevision == 0
        ) revert InvalidReward();

        ComputeStakeRewardPolicy420.Policy memory p =
            policies.policy(stakePolicyId, subjectKind, rewardPolicyRevision);
        if (
            p.stakePolicyId != stakePolicyId
                || p.subjectKind != subjectKind
                || p.rewardSource.code.length == 0
                || p.rewardSource.codehash != p.rewardSourceCodeHash
        ) revert InvalidReward();

        IComputeStakeRewardSource420.RewardEvidence memory e =
            IComputeStakeRewardSource420(p.rewardSource).rewardEvidence(rewardRef);

        if (
            !e.finalEarned
                || e.positionId == bytes32(0)
                || e.subjectKind != subjectKind
                || e.subjectRef == bytes32(0)
                || e.beneficiary == address(0)
                || e.stakePolicyId != stakePolicyId
                || e.amount == 0
                || e.amount > p.maxRewardAmount
                || e.earnedAt == 0
                || e.evidenceCommitment == bytes32(0)
        ) revert InvalidReward();

        address collateral =
            subjectKind == policies.SUBJECT_WORKER()
                ? workerCollateral
                : subjectKind == policies.SUBJECT_VERIFIER()
                    ? verifierCollateral
                    : address(0);
        if (collateral == address(0)) revert InvalidReward();

        (
            uint8 actualKind,
            bytes32 actualSubjectRef,
            address actualBeneficiary,
            bytes32 actualStakePolicyId,
            ,
            uint64 openedAt,
            ,
            ,
            ,
            ,
            ,
            bool exists
        ) = IComputeSlashableCollateral420(collateral).slashSnapshot(e.positionId);

        if (
            !exists
                || actualKind != subjectKind
                || actualSubjectRef != e.subjectRef
                || actualBeneficiary != e.beneficiary
                || actualStakePolicyId != stakePolicyId
                || e.earnedAt < openedAt
        ) revert InvalidReward();

        bytes32 consumedKey = keccak256(abi.encode(p.rewardSource, rewardRef));
        if (sourceRewardConsumed[consumedKey]) revert Replay();

        bytes32 policyCommitment =
            policies.commitment(stakePolicyId, subjectKind, rewardPolicyRevision);

        rewardId = keccak256(
            abi.encode(
                REWARD_DOMAIN,
                block.chainid,
                address(this),
                p.rewardSource,
                rewardRef,
                e.positionId,
                e.subjectKind,
                e.subjectRef,
                e.beneficiary,
                e.stakePolicyId,
                e.amount,
                e.earnedAt,
                e.evidenceCommitment,
                rewardPolicyRevision,
                policyCommitment
            )
        );
        if (_rewards[rewardId].exists) revert Replay();

        obligationId = keccak256(abi.encode(REWARD_OBLIGATION_DOMAIN, rewardId));
        bytes32 createOperation =
            keccak256(abi.encode(REWARD_OBLIGATION_DOMAIN, rewardId, bytes32("CREATE")));
        bytes32 releaseOperation =
            keccak256(abi.encode(REWARD_OBLIGATION_DOMAIN, rewardId, bytes32("RELEASE")));

        sourceRewardConsumed[consumedKey] = true;
        creditedByBeneficiary[e.beneficiary] += e.amount;
        creditedByPosition[e.positionId] += e.amount;
        _rewards[rewardId] = RewardRecord({
            rewardId: rewardId,
            rewardRef: rewardRef,
            positionId: e.positionId,
            subjectKind: e.subjectKind,
            subjectRef: e.subjectRef,
            beneficiary: e.beneficiary,
            stakePolicyId: e.stakePolicyId,
            rewardSource: p.rewardSource,
            rewardPolicyRevision: rewardPolicyRevision,
            rewardPolicyCommitment: policyCommitment,
            evidenceCommitment: e.evidenceCommitment,
            amount: e.amount,
            earnedAt: e.earnedAt,
            creditedAt: uint64(block.timestamp),
            obligationId: obligationId,
            exists: true
        });

        rewardVault.createObligation(
            createOperation,
            obligationId,
            address(0),
            e.beneficiary,
            e.amount,
            REWARD_OBLIGATION_TYPE,
            rewardId
        );
        rewardVault.releaseObligation(releaseOperation, obligationId);

        emit RewardCredited(
            rewardId,
            rewardRef,
            e.positionId,
            e.subjectKind,
            e.subjectRef,
            e.beneficiary,
            e.stakePolicyId,
            p.rewardSource,
            e.amount,
            obligationId
        );
    }

    function rewardRecord(bytes32 rewardId)
        external
        view
        returns (RewardRecord memory r)
    {
        r = _rewards[rewardId];
        if (!r.exists) revert InvalidReward();
    }
}
