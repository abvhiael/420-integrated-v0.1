// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/SystemAccess.sol";
import "./ComputeExternalProofCreditAdapter420.sol";

/// @notice CMP-5.6 one-time consumption guard for externally derived rewardable work.
/// @dev This contract enforces uniqueness only. It does not attest external truth, determine
/// reward eligibility/amount, move Vault value, mutate stake, or settle any payment.
contract ComputeExternalDoubleRewardGuard420 is SystemAccess, I420System {
    bytes32 public constant CLAIM_DOMAIN =
        keccak256("420/CMP/EXTERNAL_DOUBLE_REWARD/CLAIM/V1");

    struct ClaimRecord {
        bytes32 claimKey;
        bytes32 canonicalWorkCommitment;
        bytes32 sourceBinding;
        bytes32 rewardRef;
        bytes32 evidenceCommitment;
        address consumer;
        uint64 consumedAt;
        bool exists;
    }

    ComputeExternalProofCreditAdapter420 public immutable proofCreditAdapter;

    mapping(address => bytes32) public consumerCodeHash;
    mapping(bytes32 => ClaimRecord) private _claims;

    error InvalidConfiguration();
    error InvalidConsumer();
    error InvalidClaim();
    error UnauthorizedConsumer();
    error Replay();

    event ConsumerAuthorizationSet(address indexed consumer, bytes32 codeHash);
    event ConsumerAuthorizationRevoked(address indexed consumer);
    event ExternalRewardClaimConsumed(
        bytes32 indexed claimKey,
        bytes32 indexed canonicalWorkCommitment,
        bytes32 indexed sourceBinding,
        bytes32 rewardRef,
        bytes32 evidenceCommitment,
        address consumer
    );

    constructor(address timelock_, address proofCreditAdapter_)
        SystemAccess(timelock_)
    {
        if (proofCreditAdapter_.code.length == 0) revert InvalidConfiguration();
        proofCreditAdapter = ComputeExternalProofCreditAdapter420(proofCreditAdapter_);
    }

    function systemName() external pure returns (string memory) {
        return "ComputeExternalDoubleRewardGuard420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    /// @notice Governance may authorize only deployed code as a claim consumer.
    /// @dev The exact runtime code hash is pinned to fail closed if code is replaced.
    function setConsumer(address consumer, bool active) external onlyGovernance {
        if (!active) {
            delete consumerCodeHash[consumer];
            emit ConsumerAuthorizationRevoked(consumer);
            return;
        }
        if (consumer.code.length == 0) revert InvalidConsumer();
        bytes32 codeHash = consumer.codehash;
        consumerCodeHash[consumer] = codeHash;
        emit ConsumerAuthorizationSet(consumer, codeHash);
    }

    /// @notice Stable one-time claim key for one canonical external work identity.
    /// @dev Source/proof/credit evidence is deliberately excluded so alternate wrappers cannot
    /// create additional reward opportunities for the same canonical external work.
    function claimKeyFor(bytes32 canonicalWorkCommitment)
        public view returns (bytes32)
    {
        if (canonicalWorkCommitment == bytes32(0)) revert InvalidClaim();
        return keccak256(
            abi.encode(
                CLAIM_DOMAIN,
                block.chainid,
                address(this),
                canonicalWorkCommitment
            )
        );
    }

    /// @notice Consume one canonical external work identity exactly once.
    /// @dev Permissionless callers cannot burn claims: only governance-authorized, code-hash-pinned
    /// consumers may consume. CMP-5.7 owns the external-truth mapping into canonicalWorkCommitment.
    function consume(
        ComputeExternalProofCreditAdapter420.ExternalSource calldata source,
        bytes32 canonicalWorkCommitment,
        bytes32 rewardRef,
        bytes32 evidenceCommitment
    ) external returns (bytes32 claimKey) {
        bytes32 expectedCodeHash = consumerCodeHash[msg.sender];
        if (
            expectedCodeHash == bytes32(0)
                || msg.sender.code.length == 0
                || msg.sender.codehash != expectedCodeHash
        ) revert UnauthorizedConsumer();
        if (
            rewardRef == bytes32(0)
                || evidenceCommitment == bytes32(0)
        ) revert InvalidClaim();

        bytes32 sourceBinding = proofCreditAdapter.sourceBinding(source);
        claimKey = claimKeyFor(canonicalWorkCommitment);
        if (_claims[claimKey].exists) revert Replay();

        _claims[claimKey] = ClaimRecord({
            claimKey: claimKey,
            canonicalWorkCommitment: canonicalWorkCommitment,
            sourceBinding: sourceBinding,
            rewardRef: rewardRef,
            evidenceCommitment: evidenceCommitment,
            consumer: msg.sender,
            consumedAt: uint64(block.timestamp),
            exists: true
        });

        emit ExternalRewardClaimConsumed(
            claimKey,
            canonicalWorkCommitment,
            sourceBinding,
            rewardRef,
            evidenceCommitment,
            msg.sender
        );
    }

    function claimRecord(bytes32 claimKey)
        external view returns (ClaimRecord memory record)
    {
        record = _claims[claimKey];
        if (!record.exists) revert InvalidClaim();
    }

    function consumed(bytes32 canonicalWorkCommitment)
        external view returns (bool)
    {
        return _claims[claimKeyFor(canonicalWorkCommitment)].exists;
    }
}
