// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { RightsRegistry } from "./RightsRegistry.sol";
import { CanonicalLandPlantGate } from "./CanonicalLandPlantGate.sol";

/// @notice R04.9 fixed term parcel lease, consented transfers and active-plant dispute boundary.
/// @dev Settled lease rent/fees and off-chain plant relocation are NOT implied; deposit/payment external.
contract LeaseRegistry {
    error InvalidLease();
    error Unauthorized();
    enum State {
        None,
        Active,
        Disputed,
        Revoked,
        Closed
    }

    struct Lease {
        bytes32 asset;
        address lessor;
        address tenant;
        uint64 starts;
        uint64 ends;
        uint256 scopes;
        uint256 feeUnits;
        uint256 activePlants;
        State state;
        bool exitPending;
    }
    RightsRegistry public immutable rights;
    address public immutable plantAuthority;
    CanonicalLandPlantGate public canonicalGate;
    mapping(bytes32 => uint64) public canonicalParcelOf;
    event CanonicalGateBound(address indexed gate);
    mapping(bytes32 => Lease) public leases;
    mapping(bytes32 => bool) public operationUsed;
    event LeaseCreated(
        bytes32 indexed id, bytes32 indexed asset, address indexed tenant, uint64 ends, uint256 feeUnits
    );
    event PlantsChanged(bytes32 indexed id, uint256 amount);
    event LeaseStatus(bytes32 indexed id, State state, bool exitPending);
    event LeaseTransferred(bytes32 indexed id, address indexed oldTenant, address indexed newTenant);

    constructor(
        address rights_
    ) {
        if (rights_ == address(0) || rights_.code.length == 0) revert InvalidLease();
        rights = RightsRegistry(rights_);
        plantAuthority = msg.sender;
    }

    /// @notice Bind a trusted canonical land/plant reader exactly once.
    function bindCanonicalGate(address gate) external {
        if (msg.sender != plantAuthority || address(canonicalGate) != address(0) || gate.code.length == 0) revert Unauthorized();
        canonicalGate = CanonicalLandPlantGate(gate);
        emit CanonicalGateBound(gate);
    }

    /// @notice Admit only parcels already occupied under this exact lease identity in R02.
    function createCanonical(bytes32 id, uint64 parcelId, address tenant, uint64 starts, uint64 ends, uint256 scopes, uint256 feeUnits) external {
        if (address(canonicalGate) == address(0)) revert InvalidLease();
        bytes32 asset = canonicalGate.parcelAsset(parcelId);
        if (!canonicalGate.leaseAdmissible(parcelId, id, msg.sender, tenant)) revert InvalidLease();
        createInternal(id, asset, tenant, starts, ends, scopes, feeUnits);
        canonicalParcelOf[id] = parcelId;
    }

    function createInternal(bytes32 id, bytes32 asset, address tenant, uint64 starts, uint64 ends, uint256 scopes, uint256 feeUnits) private {
        (address owner, bool exists, bool frozen) = rights.assets(asset);
        if (id == bytes32(0) || leases[id].state != State.None || !exists || frozen || msg.sender != owner
            || tenant == address(0) || tenant == owner || starts >= ends || ends <= block.timestamp || scopes == 0) revert InvalidLease();
        leases[id] = Lease(asset, owner, tenant, starts, ends, scopes, feeUnits, 0, State.Active, false);
        emit LeaseCreated(id, asset, tenant, ends, feeUnits);
    }

    function create(
        bytes32 id,
        bytes32 asset,
        address tenant,
        uint64 starts,
        uint64 ends,
        uint256 scopes,
        uint256 feeUnits
    ) external {
        (address owner, bool exists, bool frozen) = rights.assets(asset);
        if (
            id == bytes32(0) || leases[id].state != State.None || !exists || frozen || msg.sender != owner
                || tenant == address(0) || tenant == owner || starts >= ends || ends <= block.timestamp || scopes == 0
        ) {
            revert InvalidLease();
        }
        leases[id] = Lease(asset, owner, tenant, starts, ends, scopes, feeUnits, 0, State.Active, false);
        emit LeaseCreated(id, asset, tenant, ends, feeUnits);
    }

    function usable(
        bytes32 id
    ) public view returns (bool) {
        Lease memory l = leases[id];
        (address owner, bool exists, bool frozen) = rights.assets(l.asset);
        uint64 parcelId = canonicalParcelOf[id];
        if (parcelId != 0 && !canonicalGate.leaseAdmissible(parcelId, id, l.lessor, l.tenant)) return false;
        return l.state == State.Active && !l.exitPending && exists && !frozen && owner == l.lessor
            && block.timestamp >= l.starts && block.timestamp < l.ends;
    }

    /// @dev Only the trusted cultivation/plant authority may reconcile live plants; tenants cannot falsify exits.
    function updatePlants(
        bytes32 id,
        bytes32 op,
        uint256 quantity,
        bool place
    ) external {
        Lease storage l = leases[id];
        if (msg.sender != plantAuthority || op == bytes32(0) || operationUsed[op]) revert Unauthorized();
        if (place && !usable(id)) revert InvalidLease();
        if (canonicalParcelOf[id] != 0) revert InvalidLease(); // canonical occupancy is read from PlantRegistry, never self-reported
        if (!place && l.state == State.None) revert InvalidLease();
        operationUsed[op] = true;
        if (place) {
            l.activePlants += quantity;
        } else {
            if (quantity > l.activePlants) revert InvalidLease();
            l.activePlants -= quantity;
        }
        if (quantity == 0) revert InvalidLease();
        emit PlantsChanged(id, l.activePlants);
        if (l.activePlants == 0 && l.exitPending) {
            l.exitPending = false;
            l.state = State.Closed;
            emit LeaseStatus(id, l.state, false);
        }
    }

    function transferTenant(
        bytes32 id,
        address to
    ) external {
        Lease storage l = leases[id];
        if (msg.sender != l.tenant || to == address(0) || to == l.tenant || !usable(id) || _hasPlantsOrUnresolvedOccupancy(id, l)) {
            revert Unauthorized();
        }
        address old = l.tenant;
        l.tenant = to;
        emit LeaseTransferred(id, old, to);
    }

    function _hasPlantsOrUnresolvedOccupancy(bytes32 id, Lease storage l) private view returns (bool) {
        uint64 parcelId = canonicalParcelOf[id];
        return parcelId == 0 ? l.activePlants != 0 : !canonicalGate.canClearOccupancy(parcelId, id);
    }

    function dispute(
        bytes32 id
    ) external {
        Lease storage l = leases[id];
        if (l.state != State.Active || (msg.sender != l.lessor && msg.sender != l.tenant)) revert Unauthorized();
        l.state = State.Disputed;
        l.exitPending = _hasPlantsOrUnresolvedOccupancy(id, l);
        emit LeaseStatus(id, l.state, l.exitPending);
    }

    function revoke(
        bytes32 id
    ) external {
        Lease storage l = leases[id];
        if (msg.sender != l.lessor || l.state != State.Active) revert Unauthorized();
        l.state = State.Revoked;
        l.exitPending = _hasPlantsOrUnresolvedOccupancy(id, l);
        emit LeaseStatus(id, l.state, l.exitPending);
    }

    function expire(
        bytes32 id
    ) external {
        Lease storage l = leases[id];
        if (l.state != State.Active || block.timestamp < l.ends) revert InvalidLease();
        l.state = _hasPlantsOrUnresolvedOccupancy(id, l) ? State.Revoked : State.Closed;
        l.exitPending = _hasPlantsOrUnresolvedOccupancy(id, l);
        emit LeaseStatus(id, l.state, l.exitPending);
    }

    function resolveDispute(
        bytes32 id,
        bool restore
    ) external {
        Lease storage l = leases[id];
        if (l.state != State.Disputed || msg.sender != l.lessor) revert Unauthorized();
        if (restore && block.timestamp < l.ends) {
            l.state = State.Active;
            l.exitPending = false;
        } else {
            l.state = l.activePlants == 0 ? State.Closed : State.Revoked;
            l.exitPending = _hasPlantsOrUnresolvedOccupancy(id, l);
        }
        emit LeaseStatus(id, l.state, l.exitPending);
    }
}
