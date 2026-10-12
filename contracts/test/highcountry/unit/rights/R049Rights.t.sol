// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { RightsRegistry } from "../../../../src/highcountry/rights/RightsRegistry.sol";
import { LeaseRegistry } from "../../../../src/highcountry/rights/LeaseRegistry.sol";
import { LicenseRegistry } from "../../../../src/highcountry/rights/LicenseRegistry.sol";

contract R049Actor {
    function registerLease(LeaseRegistry l,bytes32 id,bytes32 asset,address tenant,uint64 start,uint64 end) external {
        l.create(id,asset,tenant,start,end,3,0);
    }
    function place(LeaseRegistry l,bytes32 id,bytes32 op,uint256 count,bool add) external {l.updatePlants(id,op,count,add);}
    function revokeLease(LeaseRegistry l,bytes32 id) external {l.revoke(id);}
    function transferLease(LeaseRegistry l,bytes32 id,address to) external {l.transferTenant(id,to);}
    function issue(LicenseRegistry l,bytes32 id,bytes32 asset,address user) external {
        l.issue(id,asset,user,3,uint64(block.timestamp),uint64(block.timestamp+300),0);
    }
    function revokeLicense(LicenseRegistry l,bytes32 id) external {l.revoke(id);}
    function transferLicense(LicenseRegistry l,bytes32 id,address to) external {l.transfer(id,to);}
    function transferOwnedAsset(RightsRegistry r,bytes32 asset,address to) external { r.transferAsset(asset,to); }
    function grant(RightsRegistry r,bytes32 id,bytes32 asset,address holder) external {
        r.grant(id,asset,holder,3,uint64(block.timestamp),uint64(block.timestamp+300));
    }
}
contract R049RightsTest {
    RightsRegistry rights;
    LeaseRegistry leases;
    LicenseRegistry licenses;
    R049Actor owner;
    R049Actor tenant;
    R049Actor stranger;
    bytes32 constant PARCEL=keccak256("PARCEL");
    bytes32 constant LEASE=keccak256("LEASE");
    bytes32 constant LICENSE=keccak256("LICENSE");
    function setUp() public {
        rights=new RightsRegistry();leases=new LeaseRegistry(address(rights));
        licenses=new LicenseRegistry(address(rights));
        owner=new R049Actor();tenant=new R049Actor();stranger=new R049Actor();
        rights.registerAsset(PARCEL,address(owner));
    }
    function testLeaseActivePlantRevocationNeverSilentlyEvicts() public {
        owner.registerLease(leases,LEASE,PARCEL,address(tenant),uint64(block.timestamp),uint64(block.timestamp+300));
        require(leases.usable(LEASE),"lease inactive");
        tenant.place(leases,LEASE,bytes32(uint256(1)),5,true);
        owner.revokeLease(leases,LEASE);
        require(!leases.usable(LEASE),"revoked access");
        (,,,,,,,uint256 active,LeaseRegistry.State state,bool pending)=leases.leases(LEASE);
        require(active==5&&state==LeaseRegistry.State.Revoked&&pending,"stranded plants erased");
        (bool add,) = address(tenant).call(abi.encodeCall(tenant.place,(leases,LEASE,bytes32(uint256(2)),1,true)));
        require(!add,"new plants on revoked lease");
        (bool transfer,) = address(tenant).call(abi.encodeCall(tenant.transferLease,(leases,LEASE,address(stranger))));
        require(!transfer,"active-plant transfer");
        tenant.place(leases,LEASE,bytes32(uint256(3)),5,false);
        require(!leases.usable(LEASE),"closed lease usable");
        (,,,,,,,,state,pending)=leases.leases(LEASE);
        require(state==LeaseRegistry.State.Closed&&!pending,"plant exit incomplete");
    }
    function testRightsAndLicensesCannotEscalateAcrossOwnerChange() public {
        bytes32 g=keccak256("grant");
        owner.grant(rights,g,PARCEL,address(tenant));
        require(rights.hasRight(g,address(tenant),1),"missing right");
        owner.issue(licenses,LICENSE,PARCEL,address(tenant));
        require(licenses.usable(LICENSE,address(tenant),1),"missing license");
        (bool forged,) = address(stranger).call(abi.encodeCall(stranger.issue,(licenses,bytes32(uint256(7)),PARCEL,address(stranger))));
        require(!forged,"stranger issued license");
        rights.freeze(PARCEL,true);
        require(!rights.hasRight(g,address(tenant),1),"freeze bypass rights");
        require(!licenses.usable(LICENSE,address(tenant),1),"freeze bypass license");
        rights.freeze(PARCEL,false);
        owner.transferOwnedAsset(rights,PARCEL,address(stranger));
        require(!rights.hasRight(g,address(tenant),1),"old owner grant survives transfer");
        require(!licenses.usable(LICENSE,address(tenant),1),"old owner license survives transfer");
        owner.revokeLicense(licenses,LICENSE);
        require(!licenses.usable(LICENSE,address(tenant),1),"revocation bypass");
    }
    function testRejectReplayAndUnauthorizedPlantAccounting() public {
        owner.registerLease(leases,LEASE,PARCEL,address(tenant),uint64(block.timestamp),uint64(block.timestamp+100));
        (bool replay,) = address(owner).call(abi.encodeCall(owner.registerLease,
            (leases,LEASE,PARCEL,address(tenant),uint64(block.timestamp),uint64(block.timestamp+100))));
        require(!replay,"duplicate lease");
        (bool foreign,) = address(stranger).call(abi.encodeCall(stranger.place,(leases,LEASE,bytes32(uint256(10)),1,true)));
        require(!foreign,"foreign placement");
        tenant.place(leases,LEASE,bytes32(uint256(10)),1,true);
        (bool duplicate,) = address(tenant).call(abi.encodeCall(tenant.place,(leases,LEASE,bytes32(uint256(10)),1,true)));
        require(!duplicate,"operation replay");
    }
}
