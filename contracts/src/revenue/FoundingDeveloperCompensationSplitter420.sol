// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IFounderCompensationToken420 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}

interface IDevelopmentCompensationVaultBinding420 {
    function beneficiary() external view returns (address);
    function capabilityRegistry() external view returns (address);
    function protocolVersion() external view returns (uint32);
}

/// @notice Immutable 50/25/25 distribution of AUTHENTICATED developer compensation.
/// @dev This is NOT Genesis grant custody. 0x0427 founder vesting and the three
/// direct liquid Genesis allocations are entirely separate. Unsolicited native
/// or ERC20 transfers never create compensation entitlements.
contract FoundingDeveloperCompensationSplitter420 {
    address public immutable administrator;
    address public immutable andrew;
    address public immutable janet;
    address public immutable deploymentAuthority;
    address public compensationVault;
    uint16 public constant ADMIN_BPS = 5000;
    uint16 public constant ANDREW_BPS = 2500;
    uint16 public constant JANET_BPS = 2500;

    uint256 public totalNativeCredited;
    uint256 public totalNativeClaimed;
    mapping(address => uint256) public nativeClaimed;
    mapping(address => uint256) public totalTokenCredited;
    mapping(address => uint256) public totalTokenClaimed;
    mapping(address => mapping(address => uint256)) public tokenClaimed;
    mapping(bytes32 => bool) public consumedTokenContribution;
    uint256 private _locked;

    error InvalidRecipients();
    error InvalidVaultBinding();
    error UnauthorizedRevenueSource();
    error UnrecognizedBeneficiary();
    error NothingClaimable();
    error TransferFailed();
    error Reentrancy();
    error ReplayedRevenueContribution();

    event CompensationVaultBound(address indexed immutableVault);
    event FounderCompensationDeposited(address indexed sourceVault, uint256 amount);
    event FounderTokenCompensationCredited(address indexed sourceVault, address indexed token, bytes32 indexed contributionId, uint256 amount);
    event FounderCompensationClaimed(address indexed beneficiary, address indexed asset, uint256 amount);

    constructor(address administrator_, address andrew_, address janet_) {
        if (administrator_ == address(0) || andrew_ == address(0) || janet_ == address(0)
            || administrator_ == andrew_ || administrator_ == janet_ || andrew_ == janet_
            || _reserved(administrator_) || _reserved(andrew_) || _reserved(janet_))
            revert InvalidRecipients();
        administrator = administrator_;
        andrew = andrew_;
        janet = janet_;
        deploymentAuthority = msg.sender;
    }

    modifier nonReentrant() {
        if (_locked != 0) revert Reentrancy();
        _locked = 1;
        _;
        _locked = 0;
    }

    /// @notice One-shot deployment-time handshake. The Vault's beneficiary is
    /// already immutable and must equal this exact splitter; a different vault
    /// cannot later take over. The deployment plan binds both code identities.
    function bindCompensationVault(address vault) external {
        if (msg.sender != deploymentAuthority || compensationVault != address(0)
            || vault.code.length == 0) revert InvalidVaultBinding();
        IDevelopmentCompensationVaultBinding420 candidate = IDevelopmentCompensationVaultBinding420(vault);
        if (candidate.beneficiary() != address(this)
            || candidate.capabilityRegistry().code.length == 0
            || candidate.protocolVersion() != 1) revert InvalidVaultBinding();
        compensationVault = vault;
        emit CompensationVaultBound(vault);
    }

    function isFoundingCompensationSplitter420() external pure returns (bool) { return true; }

    receive() external payable {
        if (msg.sender != compensationVault || msg.value == 0) revert UnauthorizedRevenueSource();
        totalNativeCredited += msg.value;
        emit FounderCompensationDeposited(msg.sender, msg.value);
    }

    /// @notice Called by the bound Vault AFTER its exact authorized ERC20
    /// transferFrom to this splitter. An arbitrary direct ERC20 transfer cannot
    /// increase credited revenue or become a founder's entitlement.
    function recordVaultTokenCompensation(
        address token, uint256 amount, bytes32 contributionId
    ) external nonReentrant {
        if (msg.sender != compensationVault || compensationVault == address(0))
            revert UnauthorizedRevenueSource();
        if (token.code.length == 0 || amount == 0 || contributionId == bytes32(0))
            revert TransferFailed();
        if (consumedTokenContribution[contributionId]) revert ReplayedRevenueContribution();
        consumedTokenContribution[contributionId] = true;
        totalTokenCredited[token] += amount;
        uint256 paid = totalTokenClaimed[token];
        // If a token lies about successful delivery and its credited amount
        // exceeds real assets plus previous real claims, the whole Vault call
        // reverts, preserving its replay marker and source balances atomically.
        if (IFounderCompensationToken420(token).balanceOf(address(this)) + paid < totalTokenCredited[token])
            revert TransferFailed();
        emit FounderTokenCompensationCredited(msg.sender, token, contributionId, amount);
    }

    function claimableNative(address wallet) public view returns (uint256) {
        uint256 entitlement = _entitlement(wallet, totalNativeCredited);
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
        uint256 entitlement = _entitlement(wallet, totalTokenCredited[token]);
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
            || afterRecipient < beforeRecipient || afterRecipient - beforeRecipient != amount)
            revert TransferFailed();
        emit FounderCompensationClaimed(msg.sender, token, amount);
    }

    function _entitlement(address wallet, uint256 receipts) private view returns (uint256) {
        if (wallet == administrator) return receipts * ADMIN_BPS / 10000;
        if (wallet == andrew) return receipts * ANDREW_BPS / 10000;
        if (wallet == janet) {
            return receipts - receipts * ADMIN_BPS / 10000 - receipts * ANDREW_BPS / 10000;
        }
        return 0;
    }

    function _reserved(address wallet) private pure returns (bool) {
        uint160 addr = uint160(wallet);
        return (addr >= 0x041f && addr <= 0x04ff)
            || addr == type(uint160).max - 1;
    }
}
