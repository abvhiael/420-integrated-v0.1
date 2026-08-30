// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetAuthorization420.sol";
import "./BetIds420.sol";
import "./VaultAccounting420.sol";
import "./WithdrawalQueue420.sol";

interface IERC20Bankroll420 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract BankrollVault420 is I420System {
    bytes32 public immutable vaultId;
    address public immutable asset;
    BetAuthorization420 public immutable authorization;
    VaultAccounting420 public immutable accounting;
    WithdrawalQueue420 public immutable withdrawalQueue;
    uint64 public immutable withdrawalCooldown;

    uint256 public totalShares;
    mapping(address => uint256) public shareBalance;
    mapping(bytes32 => uint256) public wagerStakeEscrow;
    mapping(bytes32 => address) public wagerPlayer;
    uint256 public activeWagerStakeEscrow;
    uint256 private _entered;

    error ZeroAddress();
    error InvalidId();
    error InvalidAmount();
    error WrongAsset();
    error WrongVault();
    error Unauthorized();
    error InsufficientShares();
    error InsufficientFreeLiquidity();
    error TransferFailed();
    error UnexpectedTokenDelta();
    error Reentrancy();
    error StakeAlreadyEscrowed();
    error StakeNotEscrowed();

    event Deposited(address indexed provider, uint256 assets, uint256 shares);
    event WagerStakeEscrowed(bytes32 indexed wagerId, address indexed player, uint256 amount);
    event WagerStakeResolved(
        bytes32 indexed wagerId,
        address indexed player,
        uint256 stake,
        uint256 grossPayout,
        uint256 stakeAbsorbed,
        uint256 bankrollOutflow
    );
    event WithdrawalRequested(
        bytes32 indexed requestId,
        address indexed provider,
        uint256 shares,
        uint256 assets,
        uint64 claimableAt
    );
    event WithdrawalClaimed(bytes32 indexed requestId, address indexed provider, uint256 assets);

    constructor(
        bytes32 vaultId_,
        address asset_,
        address authorization_,
        address accounting_,
        address withdrawalQueue_,
        uint64 withdrawalCooldown_
    ) {
        if (vaultId_ == bytes32(0)) revert InvalidId();
        if (authorization_ == address(0) || accounting_ == address(0) || withdrawalQueue_ == address(0)) revert ZeroAddress();
        vaultId = vaultId_;
        asset = asset_;
        authorization = BetAuthorization420(authorization_);
        accounting = VaultAccounting420(accounting_);
        withdrawalQueue = WithdrawalQueue420(withdrawalQueue_);
        withdrawalCooldown = withdrawalCooldown_;
    }

    modifier nonReentrant() {
        if (_entered != 0) revert Reentrancy();
        _entered = 1;
        _;
        _entered = 0;
    }

    function systemName() external pure returns (string memory) { return "BankrollVault420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function depositToken(uint256 amount) external nonReentrant returns (uint256 shares) {
        if (asset == address(0)) revert WrongAsset();
        if (amount == 0) revert InvalidAmount();
        _requireRegisteredAsset();
        _requireUserAuth(BetIds420.ACTION_LP_DEPOSIT, amount);
        uint256 equityBefore = accounting.lpEquity(vaultId);
        shares = _previewDeposit(amount, equityBefore);

        IERC20Bankroll420 token = IERC20Bankroll420(asset);
        uint256 beforeBalance = token.balanceOf(address(this));
        // The surrounding nonReentrant modifier prevents a token callback from re-entering while
        // the balance-delta check deliberately spans transferFrom to reject fee-on-transfer assets.
        // slither-disable-next-line reentrancy-balance
        if (!token.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        uint256 afterBalance = token.balanceOf(address(this));
        if (afterBalance < beforeBalance || afterBalance - beforeBalance != amount) revert UnexpectedTokenDelta();

        _mint(msg.sender, shares);
        accounting.recordDeposit(vaultId, amount);
        emit Deposited(msg.sender, amount, shares);
    }

    function depositNative() external payable nonReentrant returns (uint256 shares) {
        if (asset != address(0)) revert WrongAsset();
        if (msg.value == 0) revert InvalidAmount();
        _requireRegisteredAsset();
        _requireUserAuth(BetIds420.ACTION_LP_DEPOSIT, msg.value);
        uint256 equityBefore = accounting.lpEquity(vaultId);
        shares = _previewDeposit(msg.value, equityBefore);
        _mint(msg.sender, shares);
        accounting.recordDeposit(vaultId, msg.value);
        emit Deposited(msg.sender, msg.value, shares);
    }

    function escrowWagerStakeToken(bytes32 wagerId, address player, uint256 amount) external nonReentrant {
        if (asset == address(0)) revert WrongAsset();
        if (wagerId == bytes32(0)) revert InvalidId();
        if (player == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (wagerStakeEscrow[wagerId] != 0) revert StakeAlreadyEscrowed();
        _requireRegisteredAsset();
        _requireSystemAuth(BetIds420.ACTION_VAULT_ESCROW_STAKE, amount);

        wagerStakeEscrow[wagerId] = amount;
        wagerPlayer[wagerId] = player;
        activeWagerStakeEscrow += amount;

        IERC20Bankroll420 token = IERC20Bankroll420(asset);
        uint256 beforeBalance = token.balanceOf(address(this));
        // The caller must hold the vault-scoped ACTION_VAULT_ESCROW_STAKE capability. The canonical
        // WagerRouter passes its authenticated msg.sender as player, so `player` cannot be selected
        // by an untrusted external caller even though transferFrom necessarily names that account.
        // The nonReentrant guard protects the escrow state while this exact-delta check rejects
        // fee-on-transfer/rebasing transfer semantics for canonical wager stakes.
        // slither-disable-next-line arbitrary-send-erc20,reentrancy-balance
        if (!token.transferFrom(player, address(this), amount)) revert TransferFailed();
        uint256 afterBalance = token.balanceOf(address(this));
        if (afterBalance < beforeBalance || afterBalance - beforeBalance != amount) revert UnexpectedTokenDelta();
        emit WagerStakeEscrowed(wagerId, player, amount);
    }

    function escrowWagerStakeNative(bytes32 wagerId, address player) external payable nonReentrant {
        if (asset != address(0)) revert WrongAsset();
        if (wagerId == bytes32(0)) revert InvalidId();
        if (player == address(0)) revert ZeroAddress();
        if (msg.value == 0) revert InvalidAmount();
        if (wagerStakeEscrow[wagerId] != 0) revert StakeAlreadyEscrowed();
        _requireRegisteredAsset();
        _requireSystemAuth(BetIds420.ACTION_VAULT_ESCROW_STAKE, msg.value);
        wagerStakeEscrow[wagerId] = msg.value;
        wagerPlayer[wagerId] = player;
        activeWagerStakeEscrow += msg.value;
        emit WagerStakeEscrowed(wagerId, player, msg.value);
    }

    function resolveWager(bytes32 wagerId, uint256 grossPayout)
        external
        nonReentrant
        returns (uint256 stake, uint256 stakeAbsorbed, uint256 bankrollOutflow)
    {
        if (wagerId == bytes32(0)) revert InvalidId();
        stake = wagerStakeEscrow[wagerId];
        address player = wagerPlayer[wagerId];
        if (stake == 0 || player == address(0)) revert StakeNotEscrowed();
        _requireRegisteredAsset();
        _requireSystemAuth(BetIds420.ACTION_VAULT_SETTLE_WAGER, grossPayout);

        uint256 stakeReturned = grossPayout < stake ? grossPayout : stake;
        stakeAbsorbed = stake - stakeReturned;
        bankrollOutflow = grossPayout > stake ? grossPayout - stake : 0;

        wagerStakeEscrow[wagerId] = 0;
        wagerPlayer[wagerId] = address(0);
        activeWagerStakeEscrow -= stake;
        accounting.recordWagerSettlement(vaultId, stakeAbsorbed, bankrollOutflow);
        if (grossPayout != 0) _sendExact(player, grossPayout);

        emit WagerStakeResolved(wagerId, player, stake, grossPayout, stakeAbsorbed, bankrollOutflow);
    }

    function requestWithdrawal(uint256 shares) external nonReentrant returns (bytes32 requestId, uint256 assets) {
        if (shares == 0) revert InvalidAmount();
        if (shareBalance[msg.sender] < shares) revert InsufficientShares();
        _requireRegisteredAsset();
        uint256 equity = accounting.lpEquity(vaultId);
        assets = totalShares == 0 ? 0 : shares * equity / totalShares;
        if (assets == 0) revert InvalidAmount();
        _requireUserAuth(BetIds420.ACTION_LP_REQUEST_WITHDRAWAL, assets);
        if (assets > accounting.availableForWithdrawal(vaultId)) revert InsufficientFreeLiquidity();

        _burn(msg.sender, shares);
        accounting.queueWithdrawal(vaultId, assets);
        uint64 claimableAt = uint64(block.timestamp) + withdrawalCooldown;
        requestId = withdrawalQueue.enqueue(vaultId, msg.sender, assets, claimableAt);
        emit WithdrawalRequested(requestId, msg.sender, shares, assets, claimableAt);
    }

    function claimWithdrawal(bytes32 requestId) external nonReentrant returns (uint256 assets) {
        WithdrawalQueue420.WithdrawalRequest memory r = withdrawalQueue.getRequest(requestId);
        if (r.vaultId != vaultId) revert WrongVault();
        _requireUserAuth(BetIds420.ACTION_LP_CLAIM_WITHDRAWAL, r.amount);
        assets = withdrawalQueue.consume(requestId, msg.sender);
        accounting.completeWithdrawal(vaultId, assets);
        _sendExact(msg.sender, assets);
        emit WithdrawalClaimed(requestId, msg.sender, assets);
    }

    function previewDeposit(uint256 assets) external view returns (uint256) {
        return _previewDeposit(assets, accounting.lpEquity(vaultId));
    }

    function previewRedeem(uint256 shares) external view returns (uint256) {
        if (shares == 0 || totalShares == 0) return 0;
        return shares * accounting.lpEquity(vaultId) / totalShares;
    }

    function _previewDeposit(uint256 assets, uint256 equityBefore) private view returns (uint256 shares) {
        if (totalShares == 0) return assets;
        if (equityBefore == 0) revert InvalidAmount();
        shares = assets * totalShares / equityBefore;
        if (shares == 0) revert InvalidAmount();
    }

    function _mint(address provider, uint256 shares) private {
        totalShares += shares;
        shareBalance[provider] += shares;
    }

    function _burn(address provider, uint256 shares) private {
        shareBalance[provider] -= shares;
        totalShares -= shares;
    }

    function _requireRegisteredAsset() private view {
        if (accounting.assetOf(vaultId) != asset) revert WrongAsset();
    }

    function _requireUserAuth(bytes32 action, uint256 amount) private view {
        if (!authorization.isAuthorized(msg.sender, action, authorization.scopeForVault(vaultId), amount)) revert Unauthorized();
    }

    function _requireSystemAuth(bytes32 action, uint256 amount) private view {
        if (!authorization.isAuthorized(msg.sender, action, authorization.scopeForVault(vaultId), amount)) revert Unauthorized();
    }

    function _sendExact(address recipient, uint256 amount) private {
        if (asset == address(0)) {
            // recipient is derived from authenticated withdrawal ownership or the player bound when
            // the wager stake entered escrow; no settlement caller supplies an arbitrary recipient.
            // slither-disable-next-line arbitrary-send-eth
            (bool ok,) = payable(recipient).call{value: amount}("");
            if (!ok) revert TransferFailed();
            return;
        }
        IERC20Bankroll420 token = IERC20Bankroll420(asset);
        uint256 beforeVault = token.balanceOf(address(this));
        uint256 beforeRecipient = token.balanceOf(recipient);
        // recipient is derived from authenticated withdrawal ownership or canonical wager escrow.
        // Exact before/after deltas intentionally reject non-canonical transfer semantics.
        // slither-disable-next-line arbitrary-send-erc20,reentrancy-balance
        if (!token.transfer(recipient, amount)) revert TransferFailed();
        uint256 afterVault = token.balanceOf(address(this));
        uint256 afterRecipient = token.balanceOf(recipient);
        if (
            beforeVault < afterVault || beforeVault - afterVault != amount
                || afterRecipient < beforeRecipient || afterRecipient - beforeRecipient != amount
        ) revert UnexpectedTokenDelta();
    }
}
