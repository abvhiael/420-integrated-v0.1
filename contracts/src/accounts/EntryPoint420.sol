// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./IEntryPoint420.sol";
import "./IPaymaster420.sol";
import "./PaymasterData420.sol";

interface IAccountValidation420 {
    function validateUserOp(PackedUserOperation420 calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds)
        external
        returns (uint256 validationData);
}

/// @notice Canonical 420 Integrated Smart Account EntryPoint.
/// @dev GAS-4 settles sponsored operations against the GAS-3 reservation after account execution.
///      Settlement is bounded by the reserved maximum. The paymaster callback is advisory to its own
///      accounting only: callback failure cannot undo EntryPoint settlement or mutate account authority.
contract EntryPoint420 is IEntryPoint420 {
    bytes32 public constant USER_OPERATION_DOMAIN = keccak256("420/ENTRY_POINT/USER_OPERATION/V1");

    struct SponsorshipReservation {
        uint256 amountWei;
        bool active;
    }

    struct SponsorshipExecution {
        address paymaster;
        bytes32 authorizationId;
        uint256 reservedCostWei;
        bytes context;
    }

    mapping(address => mapping(uint192 => uint64)) private _sequence;
    mapping(address => uint256) private _deposits;
    mapping(address => uint256) private _reserved;
    mapping(address => mapping(bytes32 => bool)) private _authorizationConsumed;
    mapping(address => mapping(bytes32 => SponsorshipReservation)) private _reservations;
    bool private _entered;

    event UserOperationHandled(
        bytes32 indexed userOpHash,
        address indexed sender,
        uint192 indexed nonceKey,
        uint64 nonceSequence,
        bool success
    );
    event PaymasterValidated(
        bytes32 indexed userOpHash,
        address indexed paymaster,
        bytes32 indexed policyId,
        bytes32 authorizationId,
        uint256 maxCostWei
    );
    event PaymasterDepositAdded(address indexed paymaster, address indexed funder, uint256 amountWei, uint256 balanceWei);
    event PaymasterDepositWithdrawn(address indexed paymaster, address indexed recipient, uint256 amountWei, uint256 balanceWei);
    event SponsorshipReserved(address indexed paymaster, bytes32 indexed authorizationId, uint256 amountWei);
    event SponsorshipReservationReleased(address indexed paymaster, bytes32 indexed authorizationId, uint256 amountWei);
    event SponsorshipSettled(
        address indexed paymaster,
        bytes32 indexed authorizationId,
        bytes32 indexed userOpHash,
        uint256 reservedWei,
        uint256 chargedWei,
        uint256 refundedWei,
        bool executionSucceeded
    );
    event PaymasterPostOpResult(
        address indexed paymaster,
        bytes32 indexed authorizationId,
        bytes32 indexed userOpHash,
        bool callbackSucceeded
    );

    error ReentrantEntryPoint();
    error InvalidSender();
    error UnsupportedInitCode();
    error InvalidNonce();
    error ValidationFailed();
    error ValidationNotYetValid(uint48 validAfter);
    error ValidationExpired(uint48 validUntil);
    error InvalidPaymasterBinding();
    error InvalidPaymasterContract();
    error SponsorshipCostExceeded(uint256 maxCostWei, uint256 authorizedCostWei);
    error PaymasterValidationFailed();
    error InvalidDepositAmount();
    error InvalidWithdrawalRecipient();
    error InsufficientPaymasterDeposit(uint256 availableWei, uint256 requiredWei);
    error SponsorshipAuthorizationAlreadyConsumed(address paymaster, bytes32 authorizationId);
    error WithdrawalFailed();

    modifier nonReentrant() {
        if (_entered) revert ReentrantEntryPoint();
        _entered = true;
        _;
        _entered = false;
    }

    receive() external payable {}

    function getNonce(address sender, uint192 key) public view returns (uint256) {
        return (uint256(key) << 64) | uint256(_sequence[sender][key]);
    }

    function balanceOf(address paymaster) external view returns (uint256) {
        return _deposits[paymaster];
    }

    function reservedOf(address paymaster) external view returns (uint256) {
        return _reserved[paymaster];
    }

    function availableOf(address paymaster) public view returns (uint256) {
        return _deposits[paymaster] - _reserved[paymaster];
    }

    function authorizationConsumed(address paymaster, bytes32 authorizationId) external view returns (bool) {
        return _authorizationConsumed[paymaster][authorizationId];
    }

    function reservationOf(address paymaster, bytes32 authorizationId)
        external
        view
        returns (uint256 amountWei, bool active)
    {
        SponsorshipReservation storage reservation = _reservations[paymaster][authorizationId];
        return (reservation.amountWei, reservation.active);
    }

    function depositTo(address paymaster) external payable nonReentrant {
        if (paymaster == address(0) || paymaster.code.length == 0) revert InvalidPaymasterContract();
        if (msg.value == 0) revert InvalidDepositAmount();
        _deposits[paymaster] += msg.value;
        emit PaymasterDepositAdded(paymaster, msg.sender, msg.value, _deposits[paymaster]);
    }

    /// @notice Withdraw only unreserved sponsor funds. The paymaster itself is the withdrawal authority.
    function withdrawTo(address payable recipient, uint256 amountWei) external nonReentrant {
        if (recipient == address(0)) revert InvalidWithdrawalRecipient();
        uint256 availableWei = availableOf(msg.sender);
        if (amountWei == 0 || amountWei > availableWei) {
            revert InsufficientPaymasterDeposit(availableWei, amountWei);
        }

        _deposits[msg.sender] -= amountWei;
        (bool sent,) = recipient.call{value: amountWei}("");
        if (!sent) revert WithdrawalFailed();
        emit PaymasterDepositWithdrawn(msg.sender, recipient, amountWei, _deposits[msg.sender]);
    }

    function getUserOpHash(PackedUserOperation420 calldata userOp) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                USER_OPERATION_DOMAIN,
                block.chainid,
                address(this),
                userOp.sender,
                userOp.nonce,
                keccak256(userOp.initCode),
                keccak256(userOp.callData),
                userOp.accountGasLimits,
                userOp.preVerificationGas,
                userOp.gasFees,
                keccak256(userOp.paymasterAndData)
            )
        );
    }

    function handleOp(PackedUserOperation420 calldata userOp)
        external
        nonReentrant
        returns (bool success, bytes memory returnData)
    {
        uint256 gasAtStart = gasleft();

        if (userOp.sender == address(0) || userOp.sender.code.length == 0) revert InvalidSender();
        if (userOp.initCode.length != 0) revert UnsupportedInitCode();

        uint192 key = uint192(userOp.nonce >> 64);
        uint64 sequence = uint64(userOp.nonce);
        if (userOp.nonce != getNonce(userOp.sender, key)) revert InvalidNonce();

        bytes32 userOpHash = getUserOpHash(userOp);

        uint256 accountValidationData = IAccountValidation420(userOp.sender).validateUserOp(userOp, userOpHash, 0);
        _enforceValidationData(accountValidationData);

        SponsorshipExecution memory sponsorship;
        if (userOp.paymasterAndData.length != 0) {
            sponsorship = _validatePaymaster(userOp, userOpHash);
            _reserveSponsorship(sponsorship.paymaster, sponsorship.authorizationId, sponsorship.reservedCostWei);
        }

        unchecked { _sequence[userOp.sender][key] = sequence + 1; }

        (success, returnData) = userOp.sender.call(userOp.callData);

        if (sponsorship.paymaster != address(0)) {
            uint256 actualGasCostWei = _actualUserOpCostWei(userOp, gasAtStart);
            _settleSponsorship(sponsorship, userOpHash, actualGasCostWei, success);
        }

        emit UserOperationHandled(userOpHash, userOp.sender, key, sequence, success);
    }

    function _validatePaymaster(PackedUserOperation420 calldata userOp, bytes32 userOpHash)
        private
        returns (SponsorshipExecution memory execution)
    {
        PaymasterData420.V1 memory sponsorship = PaymasterData420.decodeV1(userOp.paymasterAndData);

        if (sponsorship.entryPoint != address(this) || sponsorship.chainId != block.chainid) {
            revert InvalidPaymasterBinding();
        }
        if (sponsorship.paymaster.code.length == 0) revert InvalidPaymasterContract();

        uint48 nowTs = uint48(block.timestamp);
        if (nowTs < sponsorship.validAfter) revert ValidationNotYetValid(sponsorship.validAfter);
        if (nowTs > sponsorship.validUntil) revert ValidationExpired(sponsorship.validUntil);

        uint256 maxCostWei = _maximumUserOpCostWei(userOp);
        if (maxCostWei > sponsorship.maxSponsoredCostWei) {
            revert SponsorshipCostExceeded(maxCostWei, sponsorship.maxSponsoredCostWei);
        }

        (bytes memory context, uint256 paymasterValidationData) =
            IPaymaster420(sponsorship.paymaster).validatePaymasterUserOp(userOp, userOpHash, maxCostWei);
        _enforcePaymasterValidationData(paymasterValidationData);

        emit PaymasterValidated(
            userOpHash,
            sponsorship.paymaster,
            sponsorship.policyId,
            sponsorship.authorizationId,
            maxCostWei
        );

        execution = SponsorshipExecution({
            paymaster: sponsorship.paymaster,
            authorizationId: sponsorship.authorizationId,
            reservedCostWei: maxCostWei,
            context: context
        });
    }

    function _reserveSponsorship(address paymaster, bytes32 authorizationId, uint256 amountWei) private {
        if (_authorizationConsumed[paymaster][authorizationId]) {
            revert SponsorshipAuthorizationAlreadyConsumed(paymaster, authorizationId);
        }

        uint256 availableWei = availableOf(paymaster);
        if (amountWei > availableWei) revert InsufficientPaymasterDeposit(availableWei, amountWei);

        _authorizationConsumed[paymaster][authorizationId] = true;
        _reserved[paymaster] += amountWei;
        _reservations[paymaster][authorizationId] = SponsorshipReservation({amountWei: amountWei, active: true});
        emit SponsorshipReserved(paymaster, authorizationId, amountWei);
    }

    function _settleSponsorship(
        SponsorshipExecution memory sponsorship,
        bytes32 userOpHash,
        uint256 actualGasCostWei,
        bool executionSucceeded
    ) private {
        SponsorshipReservation storage reservation =
            _reservations[sponsorship.paymaster][sponsorship.authorizationId];
        uint256 reservedWei = reservation.amountWei;
        if (!reservation.active) return;

        uint256 chargedWei = actualGasCostWei > reservedWei ? reservedWei : actualGasCostWei;
        uint256 refundedWei = reservedWei - chargedWei;

        reservation.active = false;
        reservation.amountWei = 0;
        _reserved[sponsorship.paymaster] -= reservedWei;
        _deposits[sponsorship.paymaster] -= chargedWei;

        emit SponsorshipSettled(
            sponsorship.paymaster,
            sponsorship.authorizationId,
            userOpHash,
            reservedWei,
            chargedWei,
            refundedWei,
            executionSucceeded
        );
        emit SponsorshipReservationReleased(sponsorship.paymaster, sponsorship.authorizationId, reservedWei);

        PostOpMode420 mode = executionSucceeded ? PostOpMode420.OpSucceeded : PostOpMode420.OpReverted;
        bool callbackSucceeded;
        try IPaymaster420(sponsorship.paymaster).postOp(mode, sponsorship.context, chargedWei) {
            callbackSucceeded = true;
        } catch {
            callbackSucceeded = false;
        }
        emit PaymasterPostOpResult(sponsorship.paymaster, sponsorship.authorizationId, userOpHash, callbackSucceeded);
    }

    function _maximumUserOpCostWei(PackedUserOperation420 calldata userOp) private pure returns (uint256) {
        uint256 packedLimits = uint256(userOp.accountGasLimits);
        uint256 verificationGasLimit = packedLimits >> 128;
        uint256 callGasLimit = uint128(packedLimits);
        uint256 maxFeePerGas = uint128(uint256(userOp.gasFees));
        uint256 totalGas = verificationGasLimit + callGasLimit + userOp.preVerificationGas;
        return totalGas * maxFeePerGas;
    }

    function _actualUserOpCostWei(PackedUserOperation420 calldata userOp, uint256 gasAtStart)
        private
        view
        returns (uint256)
    {
        uint256 meteredGas = gasAtStart - gasleft();
        uint256 maxFeePerGas = uint128(uint256(userOp.gasFees));
        return (meteredGas + userOp.preVerificationGas) * maxFeePerGas;
    }

    function _enforcePaymasterValidationData(uint256 validationData) private view {
        if (validationData == 1) revert PaymasterValidationFailed();
        if (address(uint160(validationData)) != address(0)) revert PaymasterValidationFailed();

        uint48 validUntil = uint48(validationData >> 160);
        uint48 validAfter = uint48(validationData >> 208);
        uint48 nowTs = uint48(block.timestamp);
        if (nowTs < validAfter) revert ValidationNotYetValid(validAfter);
        if (validUntil != 0 && nowTs > validUntil) revert ValidationExpired(validUntil);
    }

    function _enforceValidationData(uint256 validationData) private view {
        if (validationData == 1) revert ValidationFailed();
        if (address(uint160(validationData)) != address(0)) revert ValidationFailed();

        uint48 validUntil = uint48(validationData >> 160);
        uint48 validAfter = uint48(validationData >> 208);
        uint48 nowTs = uint48(block.timestamp);

        if (nowTs < validAfter) revert ValidationNotYetValid(validAfter);
        if (validUntil != 0 && nowTs > validUntil) revert ValidationExpired(validUntil);
    }
}
