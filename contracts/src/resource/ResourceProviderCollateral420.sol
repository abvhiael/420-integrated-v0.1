// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../vault/AssetVault420.sol";
import "../vault/VaultRegistry420.sol";
import "../vault/VaultAccounting420.sol";
import "../vault/VaultIds420.sol";
import "./ResourceProviderRegistry420.sol";

/// @notice Native Resource collateral, independently funded and reserved in canonical 420Vault.
/// @dev No validator credit, Compute position or wallet balance is accepted as collateral.
contract ResourceProviderCollateral420 is I420System {
    bytes32 public constant COLLATERAL_TYPE = keccak256("420/RESOURCE/PROVIDER-COLLATERAL/V1");
    bytes32 public constant POSITION_DOMAIN = keccak256("420/RESOURCE/COLLATERAL/POSITION/V1");
    bytes32 public constant TRANCHE_DOMAIN = keccak256("420/RESOURCE/COLLATERAL/TRANCHE/V1");
    enum State { NONE, BONDED, EXITING, WITHDRAWN, DISQUALIFIED }
    struct Position {
        bytes32 providerId;
        address owner;
        uint256 deposited;
        uint256 slashable;
        uint64 trancheCount;
        State state;
    }
    ResourceProviderRegistry420 public immutable providers;
    AssetVault420 public immutable vault;
    VaultRegistry420 public immutable registry;
    VaultAccounting420 public immutable accounting;
    bytes32 public immutable vaultId;
    mapping(bytes32 => Position) private positions;
    mapping(bytes32 => mapping(uint64 => bytes32)) public trancheObligation;
    uint256 public totalSlashable;
    mapping(bytes32 => uint256) public outstandingExposure;
    mapping(bytes32 => uint32) public exitPolicyRevision;
    mapping(bytes32 => uint64) public withdrawableAt;
    event CollateralExitRequested(bytes32 indexed positionId, uint32 indexed revision, uint64 withdrawableAt);
    bool private entered;
    error InvalidBinding();
    error InvalidDeposit();
    error Unauthorized();
    error AccountingMismatch();
    event CollateralDeposited(bytes32 indexed positionId, bytes32 indexed providerId, address indexed owner, bytes32 obligationId, uint256 amount);
    constructor(address providers_, address vault_, address registry_, address accounting_) {
        if (providers_.code.length == 0 || vault_.code.length == 0 || registry_.code.length == 0 || accounting_.code.length == 0) revert InvalidBinding();
        providers = ResourceProviderRegistry420(providers_);
        vault = AssetVault420(payable(vault_));
        registry = VaultRegistry420(registry_);
        accounting = VaultAccounting420(accounting_);
        vaultId = vault.vaultId();
        if (address(vault.registry()) != registry_ || address(vault.accounting()) != accounting_
            || address(accounting.registry()) != registry_
            || address(vault.authorization()) != address(registry.authorization())
            || !_registered()) revert InvalidBinding();
    }
    function systemName() external pure returns (string memory) { return "ResourceProviderCollateral420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }
    function positionId(bytes32 providerId) public view returns (bytes32) {
        return keccak256(abi.encode(POSITION_DOMAIN, block.chainid, address(this), address(providers), providerId));
    }
    function getPosition(bytes32 id) external view returns (Position memory) { return positions[id]; }
    function deposit(bytes32 providerId) external payable returns (bytes32 id) {
        if (entered || msg.value == 0 || !_registered() || registry.vaultState(vaultId) != VaultRegistry420.VaultState.ACTIVE) revert InvalidDeposit();
        entered = true;
        ResourceProviderRegistry420.Provider memory provider = providers.getProvider(providerId);
        if ((provider.operatorAccount != msg.sender && providers.collateralSponsor(providerId) != msg.sender) || provider.state == ResourceProviderRegistry420.State.RETIRED) revert Unauthorized();
        id = positionId(providerId);
        Position storage p = positions[id];
        if (p.state == State.NONE) {
            p.providerId = providerId;
            p.owner = msg.sender;
            p.state = State.BONDED;
        }
        if (p.state != State.BONDED || p.owner != msg.sender) revert InvalidDeposit();
        uint64 index = p.trancheCount + 1;
        bytes32 obligationId = keccak256(abi.encode(TRANCHE_DOMAIN, block.chainid, address(this), vaultId, id, index));
        VaultAccounting420.AssetAccounting memory beforeA = accounting.getAccounting(vaultId, address(0));
        uint256 beforeBalance = address(vault).balance;
        vault.depositNative{value: msg.value}();
        vault.createObligation(keccak256(abi.encode(obligationId, "RESERVE")), obligationId, address(0), msg.sender, msg.value, COLLATERAL_TYPE, id);
        VaultAccounting420.AssetAccounting memory afterA = accounting.getAccounting(vaultId, address(0));
        if (address(vault).balance != beforeBalance + msg.value || afterA.recordedBalance != beforeA.recordedBalance + msg.value
            || afterA.reserved != beforeA.reserved + msg.value || afterA.claimable != beforeA.claimable
            || !_validObligation(obligationId, id, msg.sender, msg.value)) revert AccountingMismatch();
        p.trancheCount = index;
        p.deposited += msg.value;
        p.slashable += msg.value;
        totalSlashable += msg.value;
        trancheObligation[id][index] = obligationId;
        emit CollateralDeposited(id, providerId, msg.sender, obligationId, msg.value);
        entered = false;
    }
    function reconciledTranche(bytes32 id, uint64 index) external view returns (uint256) {
        Position storage p = positions[id];
        bytes32 obligationId = trancheObligation[id][index];
        if (obligationId == bytes32(0)) return 0;
        VaultAccounting420.Obligation memory o = accounting.getObligation(obligationId);
        return _validObligation(obligationId, id, p.owner, o.amount) ? o.amount : 0;
    }
    function custodyInvariant() public view returns (bool) {
        VaultAccounting420.AssetAccounting memory a = accounting.getAccounting(vaultId, address(0));
        return _registered() && a.reserved >= totalSlashable && a.recordedBalance >= a.reserved + a.claimable
            && address(vault).balance >= a.recordedBalance;
    }
    function requestExit(bytes32 id) external {
        Position storage p = positions[id];
        if (entered || p.state != State.BONDED || p.owner != msg.sender) revert Unauthorized();
        uint32 revision = providers.collateralPolicyRevision();
        ResourceProviderRegistry420.CollateralPolicy memory policy = providers.collateralPolicy(revision);
        uint256 maturity = block.timestamp + policy.withdrawalDelay;
        if (maturity > type(uint64).max) revert InvalidDeposit();
        p.state = State.EXITING;
        exitPolicyRevision[id] = revision;
        withdrawableAt[id] = uint64(maturity);
        emit CollateralExitRequested(id, revision, uint64(maturity));
    }

    function eligible(bytes32 providerId, bytes32 referenceId, address operator, uint256 minimum) external view returns (bool) {
        if (minimum == 0 || referenceId != positionId(providerId)) return false;
        Position storage p = positions[referenceId];
        if (p.state != State.BONDED || p.providerId != providerId || p.owner == address(0)
            || (p.owner != operator && p.owner != providers.collateralSponsor(providerId))
            || p.slashable < minimum || p.slashable < providers.requiredSlashable(outstandingExposure[referenceId]) || p.trancheCount == 0
            || registry.vaultState(vaultId) != VaultRegistry420.VaultState.ACTIVE || !custodyInvariant()) return false;
        // Each deposit is atomically reserved with an immutable Vault controller.
        // Only this authority can cancel or release its obligations; balance changes must update slashable in the same transaction.
        return true;
    }

    function _registered() private view returns (bool) {
        VaultRegistry420.Vault memory v = registry.getVault(vaultId);
        return v.vaultAddress == address(vault) && v.vaultType == VaultIds420.VAULT_COLLATERAL
            && registry.vaultIdForAddress(address(vault)) == vaultId;
    }
    function _validObligation(bytes32 obligationId, bytes32 id, address owner, uint256 amount) private view returns (bool) {
        VaultAccounting420.Obligation memory o = accounting.getObligation(obligationId);
        return o.exists && o.state == 1 && o.vaultId == vaultId && o.asset == address(0)
            && o.beneficiary == owner && o.amount == amount && o.obligationType == COLLATERAL_TYPE && o.sourceRef == id
            && vault.payerSafetyController(obligationId) == address(this);
    }
}
