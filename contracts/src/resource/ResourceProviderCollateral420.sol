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
    mapping(bytes32 => uint256) public outstandingReservations;
    mapping(bytes32 => bytes32) public obligationPosition;
    mapping(bytes32 => uint256) public obligationAmount;
    mapping(bytes32 => bool) public consumedDeposit;
    mapping(bytes32 => uint64) public withdrawalCursor;
    mapping(bytes32 => uint256) public withdrawnAmount;
    uint256 public totalWithdrawn;
    mapping(bytes32 => uint256) public outstandingPenaltyHolds;
    struct PenaltyHold {
        bytes32 position;
        uint256 amount;
        bool resolved;
    }
    mapping(bytes32 => PenaltyHold) public penaltyHolds;
    event PenaltyHeld(bytes32 indexed penaltyId, bytes32 indexed positionId, uint256 amount);
    event PenaltyHoldDismissed(bytes32 indexed penaltyId, bytes32 indexed positionId);
    event ExitCompleted(bytes32 indexed positionId, address indexed owner, uint256 withdrawn);
    struct Reservation {
        bytes32 position;
        address controller;
        uint256 exposure;
        uint32 policyRevision;
        bool released;
    }
    mapping(bytes32 => Reservation) public reservations;
    mapping(address => bytes32) public reservationControllerCodeHash;
    event ReservationControllerConfigured(address indexed controller, bytes32 codeHash);
    event ExposureReserved(bytes32 indexed reservationId, bytes32 indexed position, address indexed controller, uint256 exposure, uint32 policyRevision);
    event ExposureReleased(bytes32 indexed reservationId, bytes32 indexed position);
    event CollateralWithdrawn(bytes32 indexed positionId, uint64 indexed tranche, uint256 amount);
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
    function deposit(bytes32 providerId, bytes32 depositNonce) external payable returns (bytes32 id) {
        if (depositNonce == bytes32(0)) revert InvalidDeposit();
        bytes32 depositKey = keccak256(abi.encode("420/RESOURCE/COLLATERAL/DEPOSIT/V1", block.chainid, address(this), msg.sender, depositNonce));
        if (consumedDeposit[depositKey]) revert InvalidDeposit();
        consumedDeposit[depositKey] = true;
        if (entered || address(providers.collateral()) != address(this) || msg.value == 0 || !_registered() || registry.vaultState(vaultId) != VaultRegistry420.VaultState.ACTIVE) revert InvalidDeposit();
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
        if (obligationPosition[obligationId] != bytes32(0)) revert InvalidDeposit();
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
        obligationPosition[obligationId] = id;
        obligationAmount[obligationId] = msg.value;
        emit CollateralDeposited(id, providerId, msg.sender, obligationId, msg.value);
        entered = false;
    }
    function reconciledTranche(bytes32 id, uint64 index) external view returns (uint256) {
        Position storage p = positions[id];
        bytes32 obligationId = trancheObligation[id][index];
        if (obligationId == bytes32(0)) return 0;
        VaultAccounting420.Obligation memory o = accounting.getObligation(obligationId);
        return obligationPosition[obligationId] == id && _validObligation(obligationId, id, p.owner, obligationAmount[obligationId]) ? o.amount : 0;
    }
    function custodyInvariant() public view returns (bool) {
        VaultAccounting420.AssetAccounting memory a = accounting.getAccounting(vaultId, address(0));
        return _registered() && a.reserved >= totalSlashable && a.recordedBalance >= a.reserved + a.claimable
            && address(vault).balance >= a.recordedBalance;
    }
    /// @notice Only governance-qualified protocol controllers can create exposure.
    /// Revoking admission authority does not remove an existing controller's release authority.
    function configureReservationController(address controller, bool enabled) external {
        if (msg.sender != providers.governanceTimelock()) revert Unauthorized();
        if (enabled && controller.code.length == 0) revert InvalidBinding();
        bytes32 hash = enabled ? controller.codehash : bytes32(0);
        reservationControllerCodeHash[controller] = hash;
        emit ReservationControllerConfigured(controller, hash);
    }

    function reservationId(address controller, bytes32 obligationRef) public view returns (bytes32) {
        return keccak256(abi.encode("420/RESOURCE/COLLATERAL/RESERVATION/V1", block.chainid, address(this), controller, obligationRef));
    }

    function reserveExposure(bytes32 providerId, bytes32 obligationRef, uint256 exposure) external returns (bytes32 key) {
        if (entered || obligationRef == bytes32(0) || reservationControllerCodeHash[msg.sender] == bytes32(0)
            || msg.sender.codehash != reservationControllerCodeHash[msg.sender]) revert Unauthorized();
        if (address(providers.collateral()) != address(this) || !providers.isActive(providerId)) revert InvalidDeposit();
        bytes32 id = positionId(providerId);
        key = reservationId(msg.sender, obligationRef);
        if (reservations[key].controller != address(0)) revert InvalidDeposit();
        uint256 aggregate = outstandingExposure[id] + exposure;
        if (positions[id].slashable - outstandingPenaltyHolds[id] < providers.requiredSlashable(aggregate)) revert InvalidDeposit();
        uint32 revision = providers.collateralPolicyRevision();
        reservations[key] = Reservation(id, msg.sender, exposure, revision, false);
        outstandingExposure[id] = aggregate;
        outstandingReservations[id]++;
        emit ExposureReserved(key, id, msg.sender, exposure, revision);
    }

    function releaseExposure(bytes32 key) external {
        Reservation storage r = reservations[key];
        if (entered || r.controller != msg.sender || r.released) revert Unauthorized();
        r.released = true;
        outstandingExposure[r.position] -= r.exposure;
        outstandingReservations[r.position]--;
        emit ExposureReleased(key, r.position);
    }

    /// @notice Freeze collateral pending adjudication of a specific penalty.
    /// @dev The governance timelock must supply a unique evidence reference.
    function holdPenalty(bytes32 id, bytes32 evidenceRef, uint256 amount) external returns (bytes32 key) {
        if (entered || msg.sender != providers.governanceTimelock()) revert Unauthorized();
        Position storage p = positions[id];
        if ((p.state != State.BONDED && p.state != State.EXITING && p.state != State.DISQUALIFIED)
            || evidenceRef == bytes32(0) || amount == 0 || amount > p.slashable - outstandingPenaltyHolds[id])
            revert InvalidDeposit();
        key = keccak256(abi.encode("420/RESOURCE/COLLATERAL/PENALTY/V1", block.chainid, address(this), id, evidenceRef));
        if (penaltyHolds[key].position != bytes32(0)) revert InvalidDeposit();
        penaltyHolds[key] = PenaltyHold(id, amount, false);
        outstandingPenaltyHolds[id] += amount;
        emit PenaltyHeld(key, id, amount);
    }

    /// @notice Dismiss an adjudicated penalty without confiscation; never releases unrelated holds.
    function dismissPenalty(bytes32 key) external {
        if (entered || msg.sender != providers.governanceTimelock()) revert Unauthorized();
        PenaltyHold storage h = penaltyHolds[key];
        if (h.position == bytes32(0) || h.resolved) revert InvalidDeposit();
        h.resolved = true;
        outstandingPenaltyHolds[h.position] -= h.amount;
        emit PenaltyHoldDismissed(key, h.position);
    }

    function canWithdraw(bytes32 id) public view returns (bool) {
        Position storage p = positions[id];
        return p.state == State.EXITING && withdrawableAt[id] != 0
            && block.timestamp >= withdrawableAt[id] && outstandingReservations[id] == 0
            && outstandingExposure[id] == 0 && outstandingPenaltyHolds[id] == 0
            && p.slashable != 0 && withdrawalCursor[id] < p.trancheCount;
    }

    /// @notice Withdraw one fully backed tranche after the frozen delay and all reservations clear.
    /// Partial exit payouts are deliberately restricted to whole tranches and require ALL holds to clear.
    function withdraw(bytes32 id) external {
        Position storage p = positions[id];
        if (entered || p.owner != msg.sender || !canWithdraw(id)) revert Unauthorized();
        entered = true;
        uint64 index = withdrawalCursor[id] + 1;
        bytes32 obligationId = trancheObligation[id][index];
        uint256 amount = obligationAmount[obligationId];
        if (index > p.trancheCount || amount == 0 || !_validObligation(obligationId, id, p.owner, amount)) revert AccountingMismatch();
        VaultAccounting420.AssetAccounting memory beforeA = accounting.getAccounting(vaultId, address(0));
        uint256 beforeBalance = address(vault).balance;
        withdrawalCursor[id] = index;
        withdrawnAmount[id] += amount;
        totalWithdrawn += amount;
        p.slashable -= amount;
        totalSlashable -= amount;
        if (index == p.trancheCount) p.state = State.WITHDRAWN;
        vault.releaseObligation(keccak256(abi.encode(obligationId, "EXIT_RELEASE")), obligationId);
        vault.claim(keccak256(abi.encode(obligationId, "EXIT_CLAIM")), obligationId);
        VaultAccounting420.AssetAccounting memory afterA = accounting.getAccounting(vaultId, address(0));
        if (accounting.getObligation(obligationId).state != 3
            || beforeBalance != address(vault).balance + amount
            || beforeA.recordedBalance != afterA.recordedBalance + amount
            || beforeA.reserved != afterA.reserved + amount
            || beforeA.claimable != afterA.claimable
            || afterA.released != beforeA.released + amount
            || p.deposited != p.slashable + withdrawnAmount[id]
            || !custodyInvariant()) revert AccountingMismatch();
        if (p.state == State.WITHDRAWN) {
            if (p.slashable != 0) revert AccountingMismatch();
            emit ExitCompleted(id, p.owner, withdrawnAmount[id]);
        }
        emit CollateralWithdrawn(id, index, amount);
        entered = false;
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
            || p.slashable - outstandingPenaltyHolds[referenceId] < minimum || p.slashable - outstandingPenaltyHolds[referenceId] < providers.requiredSlashable(outstandingExposure[referenceId]) || p.trancheCount == 0
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
