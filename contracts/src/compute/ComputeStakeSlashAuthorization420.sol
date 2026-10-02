// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/IComputeObjectiveSlashEvidence420.sol";
import "../interfaces/IComputeSlashableCollateral420.sol";
import "../interfaces/IComputeSlashHold420.sol";
import "./ComputeStakeSlashPolicy420.sol";

/// @notice Objective, replay-safe slash authorization for CMP collateral.
/// @dev This contract reserves slashable collateral logically but never releases, claims,
///      redirects or distributes Vault funds. CMP-1.5.6 owns authorization consumption/distribution.
contract ComputeStakeSlashAuthorization420 is I420System, IComputeSlashHold420 {
    bytes32 public constant AUTHORIZATION_DOMAIN =
        keccak256("420Integrated.ComputeMarket.StakeSlashAuthorization.v1");

    struct Authorization {
        bytes32 authorizationRef;
        bytes32 positionId;
        uint8 subjectKind;
        bytes32 subjectRef;
        address subjectAccount;
        bytes32 stakePolicyId;
        uint32 slashPolicyRevision;
        bytes32 slashPolicyCommitment;
        address evidenceAdapter;
        bytes32 evidenceRef;
        bytes32 misconductKey;
        bytes32 evidenceCommitment;
        bytes32 violationCode;
        uint256 amount;
        uint64 authorizedAt;
        bool exists;
    }

    ComputeStakeSlashPolicy420 public immutable policies;
    address public immutable bindingAdmin;
    address public workerCollateral;
    address public verifierCollateral;

    mapping(bytes32 => Authorization) private _authorizations;
    mapping(bytes32 => bool) public misconductConsumed;
    mapping(bytes32 => uint256) public override outstandingSlash;

    error InvalidConfiguration();
    error Unauthorized();
    error InvalidAuthorization();
    error Replay();

    event CollateralSourcesBound(address indexed workerCollateral, address indexed verifierCollateral);
    event SlashAuthorized(
        bytes32 indexed authorizationRef,
        bytes32 indexed positionId,
        bytes32 indexed misconductKey,
        uint8 subjectKind,
        bytes32 subjectRef,
        address subjectAccount,
        bytes32 stakePolicyId,
        uint32 slashPolicyRevision,
        address evidenceAdapter,
        bytes32 evidenceRef,
        uint256 amount
    );

    constructor(address policy_) {
        if (policy_.code.length == 0) revert InvalidConfiguration();
        policies = ComputeStakeSlashPolicy420(policy_);
        bindingAdmin = msg.sender;
    }

    function systemName() external pure returns (string memory) {
        return "ComputeStakeSlashAuthorization420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function bindSources(address workerCollateral_, address verifierCollateral_) external {
        if (
            msg.sender != bindingAdmin
                || workerCollateral != address(0)
                || verifierCollateral != address(0)
                || workerCollateral_.code.length == 0
                || verifierCollateral_.code.length == 0
        ) revert Unauthorized();

        workerCollateral = workerCollateral_;
        verifierCollateral = verifierCollateral_;
        emit CollateralSourcesBound(workerCollateral_, verifierCollateral_);
    }

    function authorize(
        bytes32 positionId,
        uint8 subjectKind,
        uint32 slashPolicyRevision,
        bytes32 evidenceRef
    ) external returns (bytes32 authorizationRef, uint256 amount) {
        if (
            positionId == bytes32(0)
                || evidenceRef == bytes32(0)
                || workerCollateral == address(0)
                || verifierCollateral == address(0)
        ) revert InvalidAuthorization();

        address source = subjectKind == policies.SUBJECT_WORKER()
            ? workerCollateral
            : subjectKind == policies.SUBJECT_VERIFIER()
                ? verifierCollateral
                : address(0);
        if (
            source == address(0)
                || IComputeSlashableCollateral420(source).slashAuthorization() != address(this)
        ) revert InvalidAuthorization();

        (
            uint8 actualKind,
            bytes32 subjectRef,
            address beneficiary,
            bytes32 stakePolicyId,
            ,
            uint64 openedAt,
            uint32 frozenSlashPolicyRevision,
            bytes32 frozenSlashPolicyCommitment,
            uint256 slashableAmount,
            bool active,
            ,
            bool exists
        ) = IComputeSlashableCollateral420(source).slashSnapshot(positionId);

        if (
            !exists
                || !active
                || actualKind != subjectKind
                || subjectRef == bytes32(0)
                || beneficiary == address(0)
                || stakePolicyId == bytes32(0)
                || slashableAmount == 0
        ) revert InvalidAuthorization();

        ComputeStakeSlashPolicy420.Policy memory p =
            policies.policy(stakePolicyId, subjectKind, slashPolicyRevision);
        bytes32 exactPolicyCommitment =
            policies.commitment(stakePolicyId, subjectKind, slashPolicyRevision);
        if (
            p.evidenceAdapter.code.length == 0
                || p.evidenceAdapter.codehash != p.evidenceAdapterCodeHash
                || slashPolicyRevision != frozenSlashPolicyRevision
                || exactPolicyCommitment != frozenSlashPolicyCommitment
        ) revert InvalidAuthorization();

        IComputeObjectiveSlashEvidence420.Evidence memory e =
            IComputeObjectiveSlashEvidence420(p.evidenceAdapter).slashEvidence(evidenceRef);
        if (
            !e.finalObjective
                || e.subjectKind != subjectKind
                || e.subjectRef != subjectRef
                || e.subjectAccount != beneficiary
                || e.violationCode != p.violationCode
                || e.misconductKey == bytes32(0)
                || e.evidenceCommitment == bytes32(0)
                || misconductConsumed[e.misconductKey]
                || (e.stakePolicyId != bytes32(0) && e.stakePolicyId != stakePolicyId)
                || (e.evidenceAt != 0 && e.evidenceAt < openedAt)
        ) revert InvalidAuthorization();

        if (
            p.requiredVerificationPolicyId != bytes32(0)
                && (
                    e.verificationPolicyId != p.requiredVerificationPolicyId
                        || e.verificationPolicyRevision != p.requiredVerificationPolicyRevision
                        || e.verificationPolicyCommitment != p.requiredVerificationPolicyCommitment
                )
        ) revert InvalidAuthorization();

        uint256 already = outstandingSlash[positionId];
        if (already >= slashableAmount) revert InvalidAuthorization();
        uint256 available = slashableAmount - already;
        uint256 proposed = _bps(slashableAmount, p.slashBps);
        if (p.maxSlashAmount != 0 && proposed > p.maxSlashAmount) {
            proposed = p.maxSlashAmount;
        }
        amount = proposed > available ? available : proposed;
        if (amount == 0) revert InvalidAuthorization();

        bytes32 policyCommitment = exactPolicyCommitment;
        authorizationRef = keccak256(
            abi.encode(
                AUTHORIZATION_DOMAIN,
                block.chainid,
                address(this),
                positionId,
                subjectKind,
                subjectRef,
                beneficiary,
                stakePolicyId,
                slashPolicyRevision,
                policyCommitment,
                p.evidenceAdapter,
                evidenceRef,
                e.misconductKey,
                e.evidenceCommitment,
                amount
            )
        );
        if (_authorizations[authorizationRef].exists) revert Replay();

        misconductConsumed[e.misconductKey] = true;
        outstandingSlash[positionId] = already + amount;
        _authorizations[authorizationRef] = Authorization({
            authorizationRef: authorizationRef,
            positionId: positionId,
            subjectKind: subjectKind,
            subjectRef: subjectRef,
            subjectAccount: beneficiary,
            stakePolicyId: stakePolicyId,
            slashPolicyRevision: slashPolicyRevision,
            slashPolicyCommitment: policyCommitment,
            evidenceAdapter: p.evidenceAdapter,
            evidenceRef: evidenceRef,
            misconductKey: e.misconductKey,
            evidenceCommitment: e.evidenceCommitment,
            violationCode: e.violationCode,
            amount: amount,
            authorizedAt: uint64(block.timestamp),
            exists: true
        });

        emit SlashAuthorized(
            authorizationRef,
            positionId,
            e.misconductKey,
            subjectKind,
            subjectRef,
            beneficiary,
            stakePolicyId,
            slashPolicyRevision,
            p.evidenceAdapter,
            evidenceRef,
            amount
        );
    }

    function authorization(bytes32 authorizationRef)
        external
        view
        returns (Authorization memory a)
    {
        a = _authorizations[authorizationRef];
        if (!a.exists) revert InvalidAuthorization();
    }

    function _bps(uint256 amount, uint16 bps) private pure returns (uint256) {
        uint256 whole = amount / 10_000;
        uint256 remainder = amount % 10_000;
        return whole * uint256(bps) + (remainder * uint256(bps)) / 10_000;
    }
}
