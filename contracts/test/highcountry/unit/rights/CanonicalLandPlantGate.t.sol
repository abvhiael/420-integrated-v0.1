// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { CanonicalLandPlantGate } from "../../../../src/highcountry/rights/CanonicalLandPlantGate.sol";
import { RightsRegistry } from "../../../../src/highcountry/rights/RightsRegistry.sol";
import { LeaseRegistry } from "../../../../src/highcountry/rights/LeaseRegistry.sol";
import { LandRegistry } from "../../../../src/highcountry/land/LandRegistry.sol";

contract R049CanonicalLandFixture {
    LandRegistry.LandParcel internal parcel;

    function configure(
        uint64 parcelId,
        address owner,
        address occupant,
        bytes32 leaseId
    ) external {
        parcel.id = parcelId;
        parcel.owner = owner;
        parcel.occupant = occupant;
        parcel.occupancyRef = leaseId;
        parcel.occupancyKind = LandRegistry.OccupancyKind.LEASE;
        parcel.growCapacity = 20;
        parcel.exists = true;
    }

    function changeOwner(
        address owner
    ) external {
        parcel.owner = owner;
    }

    function changeOccupant(
        address occupant
    ) external {
        parcel.occupant = occupant;
    }

    function getParcel(
        uint64
    ) external view returns (LandRegistry.LandParcel memory) {
        return parcel;
    }
}
contract R049CanonicalPlantsFixture {
    address public landRegistry;

    function bindLand(
        address land
    ) external {
        landRegistry = land;
    }
    mapping(uint64 => uint32) public activePlantsByParcel;

    function set(
        uint64 parcelId,
        uint32 count
    ) external {
        activePlantsByParcel[parcelId] = count;
    }
}
contract R049CanonicalLandOwner {
    function register(
        RightsRegistry r,
        bytes32 asset
    ) external {
        r.transferAsset(asset, address(this));
    }

    function create(
        LeaseRegistry l,
        bytes32 id,
        uint64 parcelId,
        address tenant
    ) external {
        l.createCanonical(id, parcelId, tenant, uint64(block.timestamp), uint64(block.timestamp + 1000), 1, 0);
    }

    function revoke(
        LeaseRegistry l,
        bytes32 id
    ) external {
        l.revoke(id);
    }

    function revoke(
        LeaseRegistry l,
        bytes32 id
    ) external {
        l.revoke(id);
    }

    function shadow(
        LeaseRegistry l,
        bytes32 id,
        bytes32 asset,
        address tenant
    ) external {
        l.create(id, asset, tenant, uint64(block.timestamp), uint64(block.timestamp + 1000), 1, 0);
    }

    function transfer(
        LeaseRegistry l,
        bytes32 id,
        address to
    ) external {
        l.transferTenant(id, to);
    }

}
contract CanonicalLandPlantGateR049Test {
    RightsRegistry rights;
    LeaseRegistry lease;
    CanonicalLandPlantGate gate;
    R049CanonicalLandFixture land;
    R049CanonicalPlantsFixture plants;
    R049CanonicalLandOwner owner;
    address constant TENANT = address(0xB0B);
    bytes32 constant LEASE_ID = keccak256("canonical-lease");
    uint64 constant PARCEL = 44;

    function setUp() public {
        rights = new RightsRegistry();
        lease = new LeaseRegistry(address(rights));
        land = new R049CanonicalLandFixture();
        plants = new R049CanonicalPlantsFixture();
        plants.bindLand(address(land));
        owner = new R049CanonicalLandOwner();
        gate = new CanonicalLandPlantGate(address(land), address(plants));
        lease.bindCanonicalGate(address(gate));
        land.configure(PARCEL, address(owner), TENANT, LEASE_ID);
        rights.registerAsset(gate.parcelAsset(PARCEL), address(owner));

    }
    function testCanonicalLeaseUsesActualLandAndPlantState() public {
        owner.create(lease, LEASE_ID, PARCEL, TENANT);
        require(lease.usable(LEASE_ID), "canonical lease admission failed");
        plants.set(PARCEL, 4);
        owner.revoke(lease, LEASE_ID);
        (,,,,,,,, LeaseRegistry.State status, bool exitPending) = lease.leases(LEASE_ID);
        require(status == LeaseRegistry.State.Revoked && exitPending, "active plants silently evicted");
        (bool fakeReconcile,) =
            address(lease).call(abi.encodeCall(lease.updatePlants, (LEASE_ID, bytes32(uint256(88)), uint256(4), false)));
        require(!fakeReconcile, "shadow plant count accepted");
        plants.set(PARCEL, 0);
        require(gate.canClearOccupancy(PARCEL, LEASE_ID), "actual canonical count not read");
        lease.reconcileCanonicalExit(LEASE_ID);
        (,,,,,,,, status, exitPending) = lease.leases(LEASE_ID);
        require(status == LeaseRegistry.State.Closed && !exitPending, "canonical exit not finalized");
    }
    function testBoundCanonicalGateDisablesShadowLeaseEntry() public {
        (bool shadowOk,) =
            address(owner).call(abi.encodeCall(owner.shadow, (lease, LEASE_ID, gate.parcelAsset(PARCEL), TENANT)));
        require(!shadowOk, "parallel shadow lease bypassed canonical land");
    }
    function testCanonicalOwnershipAndOccupancyChangeFailClosed() public {
        owner.create(lease, LEASE_ID, PARCEL, TENANT);
        land.changeOwner(address(0x9999));
        require(!lease.usable(LEASE_ID), "stale owner accepted");
        land.changeOwner(address(owner));
        land.changeOccupant(address(0x9999));
        require(!lease.usable(LEASE_ID), "stale tenant occupancy accepted");
    }
    function testCrossRegistryPlantBindingFailsClosed() public {
        R049CanonicalPlantsFixture bogus = new R049CanonicalPlantsFixture();
        try new CanonicalLandPlantGate(address(land), address(bogus)) returns (CanonicalLandPlantGate) {
            revert("unrelated cultivation registry accepted");
        } catch { }
    }
    function testForgedParcelAndOverCapacityRejected() public {
        (bool forged,) = address(owner).call(abi.encodeCall(owner.create, (lease, bytes32(uint256(7)), PARCEL, TENANT)));
        require(!forged, "unregistered canonical lease succeeded");
        plants.set(PARCEL, 21);
        require(!gate.leaseAdmissible(PARCEL, LEASE_ID, address(owner), TENANT), "overcapacity allowed");
        plants.set(PARCEL, 0);
        owner.create(lease, LEASE_ID, PARCEL, TENANT);
        (bool shadowTransfer,) = address(owner).call(abi.encodeCall(owner.transfer, (lease, LEASE_ID, address(0xCAFE))));
        require(!shadowTransfer, "canonical transfer skipped LandRegistry occupant transition");
    }
}
