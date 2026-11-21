// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IFounderCompensationToken420 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @notice 50/25/25 immutable pull split for the DevelopmentCompensationVault420 beneficiary.
/// @dev Configure the existing vault's immutable 'beneficiary' to THIS splitter at deployment.
/// This is separate from the ten-grant FounderVestingRegistry at genesis.
contract FoundingDeveloperCompensationSplitter420 {
    address public immutable administrator;
    address public immutable andrew;
    address public immutable janet;
    uint16 public constant ADMIN_BPS = 5000;
    uint16 public constant ANDREW_BPS = 2500;
    uint16 public constant JANET_BPS = 2500;

    uint256 public totalNativeClaimed;
    mapping(address => uint256) public nativeClaimed;
    mapping(address => uint256) public totalTokenClaimed;
    mapping(address => mapping(address => uint256)) public tokenClaimed;
    uint256 private _locked;

    error InvalidRecipients();
    error UnrecognizedBeneficiary();
    error NothingClaimable();
    error TransferFailed();
    error Reentrancy();

    event FounderCompensationDeposited(address indexed sender, uint256 amount);
    event FounderCompensationClaimed(address indexed beneficiary, address indexed asset, uint256 amount);

    constructor(address administrator_, address andrew_, address janet_) {
        if (administrator_ == address(0) || andrew_ == address(0) || janet_ == address(0)
            || administrator_ == andrew_ || administrator_ == janet_ || andrew_ == janet_
            || _reserved(administrator_) || _reserved(andrew_) || _reserved(janet_))
            revert InvalidRecipients();
        administrator = administrator_;
        andrew = andrew_;
        janet = janet_;
    }

    modifier nonReentrant() {
        if (_locked != 0) revert Reentrancy();
        _locked = 1;
        _;
        _locked = 0;
    }

    receive() external payable {
        emit FounderCompensationDeposited(msg.sender, msg.value);
    }

    function claimableNative(address wallet) public view returns (uint256) {
        uint256 receipts = address(this).balance + totalNativeClaimed;
        uint256 entitlement = _entitlement(wallet, receipts);
        return entitlement > nativeClaimed[wallet] ? entitlement - nativeClaimed[wallet] : 0;
    }

    function claimNative() external nonReentrant returns (uint256 amount) {
        amount = claimableNative(msg.sender);
        if (amount == 0) revert NothingClaimable();
        nativeClaimed[msg.sender] += amount;
        totalNativeClaimed += amount;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit FounderCompensationClaimed(msg.sender, address(0), amount);
    }

    function claimableToken(address token, address wallet) public view returns (uint256) {
        if (token == address(0) || token.code.length == 0) return 0;
        uint256 receipts = IFounderCompensationToken420(token).balanceOf(address(this)) + totalTokenClaimed[token];
        uint256 entitlement = _entitlement(wallet, receipts);
        uint256 paid = tokenClaimed[token][wallet];
        return entitlement > paid ? entitlement - paid : 0;
    }

    function claimToken(address token) external nonReentrant returns (uint256 amount) {
        if (token == address(0) || token.code.length == 0) revert TransferFailed();
        amount = claimableToken(token, msg.sender);
        if (amount == 0) revert NothingClaimable();
        IFounderCompensationToken420 asset = IFounderCompensationToken420(token);
        uint256 beforeSource = asset.balanceOf(address(this));
        uint256 beforeRecipient = asset.balanceOf(msg.sender);
        tokenClaimed[token][msg.sender] += amount;
        totalTokenClaimed[token] += amount;
        if (!asset.transfer(msg.sender, amount)) revert TransferFailed();
        uint256 afterSource = asset.balanceOf(address(this));
        uint256 afterRecipient = asset.balanceOf(msg.sender);
        if (afterSource > beforeSource || beforeSource - afterSource != amount
            || afterRecipient < beforeRecipient || afterRecipient - beforeRecipient != amount) revert TransferFailed();
        emit FounderCompensationClaimed(msg.sender, token, amount);
    }

    function _entitlement(address wallet, uint256 receipts) private view returns (uint256) {
        if (wallet == administrator) return receipts * ADMIN_BPS / 10000;
        if (wallet == andrew) return receipts * ANDREW_BPS / 10000;
        if (wallet == janet) {
            // Assign indivisible smallest-unit remainder deterministically to the final 25% seat.
            return receipts - receipts * ADMIN_BPS / 10000 - receipts * ANDREW_BPS / 10000;
        }
        return 0;
    }

    function _reserved(address wallet) private pure returns (bool) {
        uint160 addr = uint160(wallet);
        return addr >= 0x041f && addr <= 0x04ff
            || uint160(wallet) == type(uint160).max - 1;
    }
}
