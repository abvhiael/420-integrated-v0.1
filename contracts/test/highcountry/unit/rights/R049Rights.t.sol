// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { bindRetainedR04Emergency, retainedR04AuthorizationRoot } from "../../mocks/R04EmergencyFixture.sol";
import { RightsRegistry } from "../../../../src/highcountry/rights/RightsRegistry.sol";
import { LeaseRegistry } from "../../../../src/highcountry/rights/LeaseRegistry.sol";
import { LicenseRegistry } from "../../../../src/highcountry/rights/LicenseRegistry.sol";

contract R049Actor {
    function registerLease(
        LeaseRegistry l,
        bytes32 id,
        bytes32 asset,
        address tenant,
        uint64 start,
        uint64 end
    ) external {
        l.create(id, asset, tenant, start, end, 3, 0);
    }

    function place(
        LeaseRegistry l,
        bytes32 id,
        bytes32 op,
        uint256 count,
        bool add
    ) external {
        l.updatePlants(id, op, count, add);
    }

    function revokeLease(
        LeaseRegistry l,
        bytes32 id
    ) external {
        l.revoke(id);
    }

    function transferLease(
        LeaseRegistry l,
        bytes32 id,
        address to
    ) external {
        l.transferTenant(id, to);
    }

    function resolveDispute(
        LeaseRegistry l,
        bytes32 id,
        bool restore
    ) external {
        l.resolveDispute(id, restore);
    }

    function dispute(
        LeaseRegistry l,
        bytes32 id
    ) external {
        l.dispute(id);
    }

    function issue(
        LicenseRegistry l,
        bytes32 id,
        bytes32 asset,
        address user
    ) external {
        l.issue(id, asset, user, 3, uint64(block.timestamp), uint64(block.timestamp + 300), 0);
    }

    function revokeLicense(
        LicenseRegistry l,
        bytes32 id
    ) external {
        l.revoke(id);
    }

    function transferLicense(
        LicenseRegistry l,
        bytes32 id,
        address to
    ) external {
        l.transfer(id, to);
    }

    function transferOwnedAsset(
        RightsRegistry r,
        bytes32 asset,
        address to
    ) external {
        r.transferAsset(asset, to);
    }

    function grant(
        RightsRegistry r,
        bytes32 id,
        bytes32 asset,
        address holder
    ) external {
        r.grant(id, asset, holder, 3, uint64(block.timestamp), uint64(block.timestamp + 300));
    }
}

interface R049Vm {
    function warp(
        uint256
    ) external;
}

contract R049RightsTest {
    R049Vm constant vm = R049Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    RightsRegistry rights;
    LeaseRegistry leases;
    LicenseRegistry licenses;
    R049Actor owner;
    R049Actor tenant;
    R049Actor stranger;
    bytes32 constant PARCEL = keccak256("PARCEL");
    bytes32 constant LEASE = keccak256("LEASE");
    bytes32 constant LICENSE = keccak256("LICENSE");

    function setUp() public {
        rights = new RightsRegistry(retainedR04AuthorizationRoot());
        bindRetainedR04Emergency(address(rights));
        leases = new LeaseRegistry(retainedR04AuthorizationRoot(), address(rights));
        bindRetainedR04Emergency(address(leases));
        licenses = new LicenseRegistry(retainedR04AuthorizationRoot(), address(rights));
        bindRetainedR04Emergency(address(licenses));
        owner = new R049Actor();
        tenant = new R049Actor();
        stranger = new R049Actor();
        rights.registerAsset(PARCEL, address(owner));
    }

    function testLeaseActivePlantRevocationNeverSilentlyEvicts() public {
        owner.registerLease(
            leases, LEASE, PARCEL, address(tenant), uint64(block.timestamp), uint64(block.timestamp + 300)
        );
        require(leases.usable(LEASE), "lease inactive");
        leases.updatePlants(LEASE, bytes32(uint256(1)), 5, true);
        owner.revokeLease(leases, LEASE);
        require(!leases.usable(LEASE), "revoked access");
        (,,,,,,, uint256 active, LeaseRegistry.State state, bool pending) = leases.leases(LEASE);
        require(active == 5 && state == LeaseRegistry.State.Revoked && pending, "stranded plants erased");
        (bool add,) = address(tenant).call(abi.encodeCall(tenant.place, (leases, LEASE, bytes32(uint256(2)), 1, true)));
        require(!add, "new plants on revoked lease");
        (bool transfer,) =
            address(tenant).call(abi.encodeCall(tenant.transferLease, (leases, LEASE, address(stranger))));
        require(!transfer, "active-plant transfer");
        leases.updatePlants(LEASE, bytes32(uint256(3)), 5, false);
        require(!leases.usable(LEASE), "closed lease usable");
        (,,,,,,,, state, pending) = leases.leases(LEASE);
        require(state == LeaseRegistry.State.Closed && !pending, "plant exit incomplete");
    }

    function testRightsAndLicensesCannotEscalateAcrossOwnerChange() public {
        bytes32 g = keccak256("grant");
        owner.grant(rights, g, PARCEL, address(tenant));
        require(rights.hasRight(g, address(tenant), 1), "missing right");
        owner.issue(licenses, LICENSE, PARCEL, address(tenant));
        require(licenses.usable(LICENSE, address(tenant), 1), "missing license");
        (bool forged,) = address(stranger)
            .call(abi.encodeCall(stranger.issue, (licenses, bytes32(uint256(7)), PARCEL, address(stranger))));
        require(!forged, "stranger issued license");
        rights.freeze(PARCEL, true);
        require(!rights.hasRight(g, address(tenant), 1), "freeze bypass rights");
        require(!licenses.usable(LICENSE, address(tenant), 1), "freeze bypass license");
        rights.freeze(PARCEL, false);
        owner.transferOwnedAsset(rights, PARCEL, address(stranger));
        require(!rights.hasRight(g, address(tenant), 1), "old owner grant survives transfer");
        require(!licenses.usable(LICENSE, address(tenant), 1), "old owner license survives transfer");
        owner.revokeLicense(licenses, LICENSE);
        require(!licenses.usable(LICENSE, address(tenant), 1), "revocation bypass");
    }

    function testExpiryDisablesUseButPreservesPlantExit() public {
        owner.registerLease(
            leases, LEASE, PARCEL, address(tenant), uint64(block.timestamp), uint64(block.timestamp + 100)
        );
        leases.updatePlants(LEASE, bytes32(uint256(201)), 2, true);
        owner.issue(licenses, LICENSE, PARCEL, address(tenant));
        require(leases.usable(LEASE), "lease should start active");
        vm.warp(block.timestamp + 101);
        require(!leases.usable(LEASE), "expired lease usable");
        leases.expire(LEASE);
        (,,,,,,, uint256 plants, LeaseRegistry.State state, bool pending) = leases.leases(LEASE);
        require(plants == 2 && state == LeaseRegistry.State.Revoked && pending, "expiry destroyed live plants");
        leases.updatePlants(LEASE, bytes32(uint256(202)), 2, false);
        (,,,,,,,, state, pending) = leases.leases(LEASE);
        require(state == LeaseRegistry.State.Closed && !pending, "expiry cleanup missing");
        vm.warp(block.timestamp + 300);
        require(!licenses.usable(LICENSE, address(tenant), 1), "expired license usable");
    }

    function testDisputeBlocksPlacementUntilResolved() public {
        owner.registerLease(
            leases, LEASE, PARCEL, address(tenant), uint64(block.timestamp), uint64(block.timestamp + 100)
        );
        leases.updatePlants(LEASE, bytes32(uint256(210)), 1, true);
        tenant.dispute(leases, LEASE);
        require(!leases.usable(LEASE), "disputed lease usable");
        (bool place,) =
            address(leases).call(abi.encodeCall(leases.updatePlants, (LEASE, bytes32(uint256(211)), uint256(1), true)));
        require(!place, "plant entered disputed site");
        owner.resolveDispute(leases, LEASE, true);
        require(leases.usable(LEASE), "restored dispute not usable");
    }

    function testRejectReplayAndUnauthorizedPlantAccounting() public {
        owner.registerLease(
            leases, LEASE, PARCEL, address(tenant), uint64(block.timestamp), uint64(block.timestamp + 100)
        );
        (bool replay,) = address(owner)
            .call(
                abi.encodeCall(
                    owner.registerLease,
                    (leases, LEASE, PARCEL, address(tenant), uint64(block.timestamp), uint64(block.timestamp + 100))
                )
            );
        require(!replay, "duplicate lease");
        (bool foreign,) =
            address(stranger).call(abi.encodeCall(stranger.place, (leases, LEASE, bytes32(uint256(10)), 1, true)));
        require(!foreign, "foreign placement");
        leases.updatePlants(LEASE, bytes32(uint256(10)), 1, true);
        (bool duplicate,) =
            address(this).call(abi.encodeCall(leases.updatePlants, (LEASE, bytes32(uint256(10)), uint256(1), true)));
        require(!duplicate, "operation replay");
    }
}
