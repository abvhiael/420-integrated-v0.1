// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../vault/AssetVault420.sol";

/// @notice CMP-6.1 application-layer funding provenance for useful-computation jobs and pools.
/// @dev This contract only accepts and accounts for separately funded native-$420 deposits into
///      one canonical AssetVault420. It does not decide reward eligibility, verify work, create
///      payout obligations, withdraw value, mint, touch payer escrow, or affect consensus rewards.
contract ComputeUsefulRewardFunding420 is I420System {
    bytes32 public constant CONTRIBUTION_DOMAIN =
        keccak256("420Integrated.ComputeMarket.UsefulRewardFunding.v1");

    uint8 public constant SOURCE_RESEARCHER = 1;
    uint8 public constant SOURCE_UNIVERSITY = 2;
    uint8 public constant SOURCE_GRANT = 3;
    uint8 public constant SOURCE_PHILANTHROPIC = 4;
    uint8 public constant SOURCE_COMMUNITY = 5;
    uint8 public constant SOURCE_ECOSYSTEM = 6;

    uint8 public constant TARGET_JOB = 1;
    uint8 public constant TARGET_POOL = 2;

    struct Contribution {
        bytes32 contributionId;
        address contributor;
        uint8 sourceKind;
        uint8 targetKind;
        bytes32 targetRef;
        bytes32 fundingRef;
        uint256 amount;
        uint64 fundedAt;
        bool exists;
    }

    AssetVault420 public immutable rewardVault;
    bytes32 public immutable rewardVaultId;

    mapping(bytes32 => Contribution) private _contributions;
    mapping(bytes32 => bool) public fundingReferenceConsumed;
    mapping(uint8 => uint256) public fundedBySourceKind;
    mapping(bytes32 => uint256) public fundedByTarget;
    mapping(address => uint256) public fundedByContributor;
    uint256 public totalFunded;

    uint256 private _entered;

    error InvalidConfiguration();
    error InvalidFunding();
    error Replay();
    error Reentrancy();

    event UsefulComputeFunded(
        bytes32 indexed contributionId,
        address indexed contributor,
        bytes32 indexed targetRef,
        uint8 sourceKind,
        uint8 targetKind,
        bytes32 fundingRef,
        uint256 amount
    );

    constructor(address rewardVault_) {
        if (rewardVault_.code.length == 0) revert InvalidConfiguration();
        rewardVault = AssetVault420(payable(rewardVault_));
        bytes32 id = rewardVault.vaultId();
        if (id == bytes32(0)) revert InvalidConfiguration();
        rewardVaultId = id;
    }

    modifier nonReentrant() {
        if (_entered != 0) revert Reentrancy();
        _entered = 1;
        _;
        _entered = 0;
    }

    function systemName() external pure returns (string memory) {
        return "ComputeUsefulRewardFunding420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    /// @notice Deposit separately supplied native $420 and bind it to one useful-compute target.
    /// @dev sourceKind is declared funding provenance, not proof of institutional identity.
    ///      TARGET_JOB and TARGET_POOL are accounting scopes only; CMP-6.2+ owns reward release.
    function fund(
        uint8 sourceKind,
        uint8 targetKind,
        bytes32 targetRef,
        bytes32 fundingRef
    ) external payable nonReentrant returns (bytes32 contributionId) {
        if (
            msg.value == 0
                || sourceKind < SOURCE_RESEARCHER
                || sourceKind > SOURCE_ECOSYSTEM
                || (targetKind != TARGET_JOB && targetKind != TARGET_POOL)
                || targetRef == bytes32(0)
                || fundingRef == bytes32(0)
        ) revert InvalidFunding();

        bytes32 referenceKey = keccak256(
            abi.encode(
                block.chainid,
                address(this),
                msg.sender,
                sourceKind,
                targetKind,
                targetRef,
                fundingRef
            )
        );
        if (fundingReferenceConsumed[referenceKey]) revert Replay();

        contributionId = keccak256(
            abi.encode(
                CONTRIBUTION_DOMAIN,
                block.chainid,
                address(this),
                rewardVaultId,
                msg.sender,
                sourceKind,
                targetKind,
                targetRef,
                fundingRef
            )
        );
        if (_contributions[contributionId].exists) revert Replay();

        fundingReferenceConsumed[referenceKey] = true;
        fundedBySourceKind[sourceKind] += msg.value;
        bytes32 targetKey = keccak256(abi.encode(targetKind, targetRef));
        fundedByTarget[targetKey] += msg.value;
        fundedByContributor[msg.sender] += msg.value;
        totalFunded += msg.value;

        _contributions[contributionId] = Contribution({
            contributionId: contributionId,
            contributor: msg.sender,
            sourceKind: sourceKind,
            targetKind: targetKind,
            targetRef: targetRef,
            fundingRef: fundingRef,
            amount: msg.value,
            fundedAt: uint64(block.timestamp),
            exists: true
        });

        // If the canonical Vault rejects the deposit, the whole transaction (including every
        // accounting write above) reverts atomically.
        rewardVault.depositNative{value: msg.value}();

        emit UsefulComputeFunded(
            contributionId,
            msg.sender,
            targetRef,
            sourceKind,
            targetKind,
            fundingRef,
            msg.value
        );
    }

    function contribution(bytes32 contributionId)
        external
        view
        returns (Contribution memory c)
    {
        c = _contributions[contributionId];
        if (!c.exists) revert InvalidFunding();
    }

    function targetKey(uint8 targetKind, bytes32 targetRef)
        external
        pure
        returns (bytes32)
    {
        if (
            (targetKind != TARGET_JOB && targetKind != TARGET_POOL)
                || targetRef == bytes32(0)
        ) revert InvalidFunding();
        return keccak256(abi.encode(targetKind, targetRef));
    }
}
