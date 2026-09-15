// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ECDSA420.sol";
import "./IPaymaster420.sol";
import "./PaymasterData420.sol";
import "./SponsorshipDigest420.sol";
import "./SponsorshipPolicy420.sol";

interface IEntryPointDeposit420 {
    function withdrawTo(address payable recipient, uint256 amountWei) external;
}

/// @notice Production 420Gas paymaster verifier.
/// @dev Sponsorship can only narrow whether an already-authorized SmartAccount420 operation is funded.
///      It cannot replace account validation, session authority, capability authority, or target-protocol authority.
contract Paymaster420 is IPaymaster420 {
    bytes4 private constant EXECUTE_SELECTOR = bytes4(keccak256("execute(address,uint256,bytes)"));
    bytes4 private constant EXECUTE_BATCH_SELECTOR = bytes4(keccak256("executeBatch((address,uint256,bytes)[])"));
    bytes4 private constant EXECUTE_SESSION_SELECTOR = bytes4(keccak256("executeSession(address,(address,uint256,bytes)[])"));

    struct Call420 {
        address target;
        uint256 value;
        bytes data;
    }

    address public immutable entryPoint;
    SponsorshipPolicy420 public immutable policyRegistry;
    address public owner;
    address public sponsorSigner;

    event SponsorSignerChanged(address indexed previousSigner, address indexed newSigner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event SponsorshipValidated(
        bytes32 indexed sponsorshipDigest,
        bytes32 indexed authorizationId,
        bytes32 indexed policyId,
        address account,
        uint256 maxCostWei
    );
    event SponsorshipPostOp(bytes32 indexed authorizationId, PostOpMode420 mode, uint256 actualGasCostWei);

    error NotOwner();
    error NotEntryPoint();
    error InvalidConfiguration();
    error InvalidRecipient();

    constructor(address entryPoint_, address policyRegistry_, address owner_, address sponsorSigner_) {
        if (
            entryPoint_ == address(0) || policyRegistry_ == address(0) || owner_ == address(0)
                || sponsorSigner_ == address(0)
        ) revert InvalidConfiguration();
        entryPoint = entryPoint_;
        policyRegistry = SponsorshipPolicy420(policyRegistry_);
        owner = owner_;
        sponsorSigner = sponsorSigner_;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyEntryPoint() {
        if (msg.sender != entryPoint) revert NotEntryPoint();
        _;
    }

    function setSponsorSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert InvalidConfiguration();
        address previous = sponsorSigner;
        sponsorSigner = newSigner;
        emit SponsorSignerChanged(previous, newSigner);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidConfiguration();
        address previous = owner;
        owner = newOwner;
        emit OwnershipTransferred(previous, newOwner);
    }

    /// @notice Withdraw only this paymaster's unreserved EntryPoint deposit.
    function withdrawDepositTo(address payable recipient, uint256 amountWei) external onlyOwner {
        if (recipient == address(0)) revert InvalidRecipient();
        IEntryPointDeposit420(entryPoint).withdrawTo(recipient, amountWei);
    }

    function validatePaymasterUserOp(
        PackedUserOperation420 calldata userOp,
        bytes32 userOpHash,
        uint256 maxCostWei
    ) external onlyEntryPoint returns (bytes memory context, uint256 validationData) {
        PaymasterData420.V1 memory sponsorship = PaymasterData420.decodeV1(userOp.paymasterAndData);
        if (
            sponsorship.paymaster != address(this) || sponsorship.entryPoint != entryPoint
                || sponsorship.chainId != block.chainid || maxCostWei > sponsorship.maxSponsoredCostWei
        ) return (bytes(""), 1);

        (bytes memory signature, bytes32 capabilityCommitment, bytes32 sessionCommitment) =
            _decodeSponsorData(sponsorship.sponsorData);
        if (signature.length != 65) return (bytes(""), 1);

        bytes32 sponsorshipDigest = SponsorshipDigest420.digestV1(userOp, sponsorship);
        address recovered = ECDSA420.tryRecover(ECDSA420.toEthSignedMessageHash(sponsorshipDigest), signature);
        if (recovered != sponsorSigner) return (bytes(""), 1);

        (SponsorshipPolicy420.Evaluation memory evaluation, bool supported) =
            _policyEvaluation(userOp, maxCostWei, capabilityCommitment, sessionCommitment);
        if (!supported || !policyRegistry.evaluate(sponsorship.policyId, evaluation)) {
            return (bytes(""), 1);
        }

        emit SponsorshipValidated(
            sponsorshipDigest,
            sponsorship.authorizationId,
            sponsorship.policyId,
            userOp.sender,
            maxCostWei
        );
        return (abi.encode(sponsorship.authorizationId, sponsorshipDigest, userOpHash), 0);
    }

    function postOp(PostOpMode420 mode, bytes calldata context, uint256 actualGasCostWei) external onlyEntryPoint {
        (bytes32 authorizationId,,) = abi.decode(context, (bytes32, bytes32, bytes32));
        emit SponsorshipPostOp(authorizationId, mode, actualGasCostWei);
    }

    function _decodeSponsorData(bytes memory raw)
        private
        pure
        returns (bytes memory signature, bytes32 capabilityCommitment, bytes32 sessionCommitment)
    {
        if (raw.length == 0) return (bytes(""), bytes32(0), bytes32(0));
        (signature, capabilityCommitment, sessionCommitment) = abi.decode(raw, (bytes, bytes32, bytes32));
        bytes memory canonical = abi.encode(signature, capabilityCommitment, sessionCommitment);
        if (canonical.length != raw.length || keccak256(canonical) != keccak256(raw)) {
            return (bytes(""), bytes32(0), bytes32(0));
        }
    }

    function _policyEvaluation(
        PackedUserOperation420 calldata userOp,
        uint256 maxCostWei,
        bytes32 capabilityCommitment,
        bytes32 sessionCommitment
    ) private view returns (SponsorshipPolicy420.Evaluation memory evaluation, bool supported) {
        bytes calldata callData = userOp.callData;
        if (callData.length < 4) return (evaluation, false);

        bytes4 envelopeSelector;
        assembly {
            envelopeSelector := calldataload(callData.offset)
        }

        Call420 memory call;
        if (envelopeSelector == EXECUTE_SELECTOR) {
            (call.target, call.value, call.data) = abi.decode(callData[4:], (address, uint256, bytes));
        } else if (envelopeSelector == EXECUTE_BATCH_SELECTOR) {
            Call420[] memory calls = abi.decode(callData[4:], (Call420[]));
            if (calls.length != 1) return (evaluation, false);
            call = calls[0];
        } else if (envelopeSelector == EXECUTE_SESSION_SELECTOR) {
            (, Call420[] memory calls) = abi.decode(callData[4:], (address, Call420[]));
            if (calls.length != 1) return (evaluation, false);
            call = calls[0];
        } else {
            return (evaluation, false);
        }

        if (call.target == address(0) || call.data.length < 4) return (evaluation, false);
        bytes4 targetSelector;
        bytes memory targetData = call.data;
        assembly {
            targetSelector := mload(add(targetData, 32))
        }

        evaluation = SponsorshipPolicy420.Evaluation({
            account: userOp.sender,
            target: call.target,
            selector: targetSelector,
            valueWei: call.value,
            maxCostWei: maxCostWei,
            timestamp: uint48(block.timestamp),
            capabilityCommitment: capabilityCommitment,
            sessionCommitment: sessionCommitment
        });
        return (evaluation, true);
    }
}
