// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./VaultRegistry420.sol";
import "./VaultAuthorization420.sol";
import "./VaultAccounting420.sol";
import "./VaultIds420.sol";

interface IERC20Vault420 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract AssetVault420 is I420System {
    bytes32 public immutable vaultId;
    VaultRegistry420 public immutable registry;
    VaultAuthorization420 public immutable authorization;
    VaultAccounting420 public immutable accounting;
    address public immutable registrationCreator;

    mapping(bytes32 => bool) public executedOperation;
    uint256 private _entered;

    error ZeroAddress();
    error Unauthorized();
    error InvalidState();
    error Replay();
    error TransferFailed();
    error InvalidAmount();
    error InvalidRecipient();
    error WrongVaultRegistration();
    error UnexpectedTokenDelta();
    error Reentrancy();

    event NativeDeposited(address indexed from, uint256 amount);
    event TokenDeposited(address indexed token, address indexed from, uint256 amount);
    event Withdrawal(bytes32 indexed operationId, address indexed asset, address indexed recipient, uint256 amount);
    event ObligationOperation(bytes32 indexed operationId, bytes32 indexed obligationId, bytes32 actionId);

    constructor(
        bytes32 vaultId_,
        address registry_,
        address authorization_,
        address accounting_,
        address registrationCreator_
    ) {
        if (
            vaultId_ == bytes32(0) || registry_ == address(0) || authorization_ == address(0)
                || accounting_ == address(0) || registrationCreator_ == address(0)
        ) revert ZeroAddress();
        vaultId = vaultId_;
        registry = VaultRegistry420(registry_);
        authorization = VaultAuthorization420(authorization_);
        accounting = VaultAccounting420(accounting_);
        registrationCreator = registrationCreator_;
    }

    modifier nonReentrant() {
        if (_entered != 0) revert Reentrancy();
        _entered = 1;
        _;
        _entered = 0;
    }

    function systemName() external pure returns (string memory) { return "AssetVault420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    receive() external payable nonReentrant { _recordNativeDeposit(); }

    function depositNative() external payable nonReentrant { _recordNativeDeposit(); }

    function depositToken(address token, uint256 amount) external nonReentrant {
        if (token == address(0) || amount == 0) revert InvalidAmount();
        _requireActive();
        uint256 beforeBalance = IERC20Vault420(token).balanceOf(address(this));
        if (!IERC20Vault420(token).transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        uint256 afterBalance = IERC20Vault420(token).balanceOf(address(this));
        if (afterBalance < beforeBalance || afterBalance - beforeBalance != amount) revert UnexpectedTokenDelta();
        accounting.recordDeposit(vaultId, token, amount);
        emit TokenDeposited(token, msg.sender, amount);
    }

    function withdraw(bytes32 operationId, address asset, address recipient, uint256 amount) external nonReentrant {
        _requireActive();
        if (recipient == address(0) || recipient == address(this)) revert InvalidRecipient();
        if (amount == 0) revert InvalidAmount();
        if (
            !authorization.isRouteAuthorized(msg.sender, vaultId, VaultIds420.ACTION_WITHDRAW, asset, recipient, amount)
                && !authorization.isAuthorized(msg.sender, vaultId, VaultIds420.ACTION_WITHDRAW, amount)
        ) revert Unauthorized();
        _consume(operationId);
        accounting.recordWithdrawal(vaultId, asset, amount);
        _sendExact(asset, recipient, amount);
        emit Withdrawal(operationId, asset, recipient, amount);
    }

    function createObligation(
        bytes32 operationId,
        bytes32 obligationId,
        address asset,
        address beneficiary,
        uint256 amount,
        bytes32 obligationType,
        bytes32 sourceRef
    ) external nonReentrant {
        _requireActive();
        if (!authorization.isAuthorized(msg.sender, vaultId, VaultIds420.ACTION_CREATE_OBLIGATION, amount)) revert Unauthorized();
        _consume(operationId);
        accounting.createObligation(vaultId, obligationId, asset, beneficiary, amount, obligationType, sourceRef);
        emit ObligationOperation(operationId, obligationId, VaultIds420.ACTION_CREATE_OBLIGATION);
    }

    function releaseObligation(bytes32 operationId, bytes32 obligationId) external nonReentrant {
        _requireActiveOrWindingDown();
        if (!authorization.isAuthorized(msg.sender, vaultId, VaultIds420.ACTION_RELEASE_OBLIGATION, 0)) revert Unauthorized();
        _consume(operationId);
        accounting.releaseObligation(vaultId, obligationId);
        emit ObligationOperation(operationId, obligationId, VaultIds420.ACTION_RELEASE_OBLIGATION);
    }

    function cancelObligation(bytes32 operationId, bytes32 obligationId) external nonReentrant {
        _requireActiveOrWindingDown();
        if (!authorization.isAuthorized(msg.sender, vaultId, VaultIds420.ACTION_CANCEL_OBLIGATION, 0)) revert Unauthorized();
        _consume(operationId);
        accounting.cancelObligation(vaultId, obligationId);
        emit ObligationOperation(operationId, obligationId, VaultIds420.ACTION_CANCEL_OBLIGATION);
    }

    function claim(bytes32 operationId, bytes32 obligationId) external nonReentrant {
        _requireNotClosed();
        (address asset, address beneficiary, uint256 amount) = accounting.previewClaim(vaultId, obligationId);
        if (msg.sender != beneficiary && !authorization.isAuthorized(msg.sender, vaultId, VaultIds420.ACTION_CLAIM, amount)) {
            revert Unauthorized();
        }
        _consume(operationId);
        accounting.recordClaim(vaultId, obligationId);
        _sendExact(asset, beneficiary, amount);
        emit Withdrawal(operationId, asset, beneficiary, amount);
    }

    function canClose() external view returns (bool) {
        _requireRegistered();
        return accounting.canClose(vaultId);
    }

    function _recordNativeDeposit() private {
        if (msg.value == 0) revert InvalidAmount();
        _requireActive();
        accounting.recordDeposit(vaultId, address(0), msg.value);
        emit NativeDeposited(msg.sender, msg.value);
    }

    function _consume(bytes32 operationId) private {
        if (operationId == bytes32(0) || executedOperation[operationId]) revert Replay();
        executedOperation[operationId] = true;
    }

    function _requireRegistered() private view {
        VaultRegistry420.Vault memory v = registry.getVault(vaultId);
        if (v.vaultAddress != address(this)) revert WrongVaultRegistration();
    }

    function _requireActive() private view {
        _requireRegistered();
        if (registry.vaultState(vaultId) != VaultRegistry420.VaultState.ACTIVE) revert InvalidState();
    }

    function _requireActiveOrWindingDown() private view {
        _requireRegistered();
        VaultRegistry420.VaultState state = registry.vaultState(vaultId);
        if (state != VaultRegistry420.VaultState.ACTIVE && state != VaultRegistry420.VaultState.WINDING_DOWN) revert InvalidState();
    }

    function _requireNotClosed() private view {
        _requireRegistered();
        if (registry.vaultState(vaultId) == VaultRegistry420.VaultState.CLOSED) revert InvalidState();
    }

    function _sendExact(address asset, address recipient, uint256 amount) private {
        if (asset == address(0)) {
            (bool ok,) = payable(recipient).call{value: amount}("");
            if (!ok) revert TransferFailed();
            return;
        }

        IERC20Vault420 token = IERC20Vault420(asset);
        uint256 beforeVault = token.balanceOf(address(this));
        uint256 beforeRecipient = token.balanceOf(recipient);
        if (!token.transfer(recipient, amount)) revert TransferFailed();
        uint256 afterVault = token.balanceOf(address(this));
        uint256 afterRecipient = token.balanceOf(recipient);
        if (
            beforeVault < afterVault || beforeVault - afterVault != amount
                || afterRecipient < beforeRecipient || afterRecipient - beforeRecipient != amount
        ) revert UnexpectedTokenDelta();
    }
}
