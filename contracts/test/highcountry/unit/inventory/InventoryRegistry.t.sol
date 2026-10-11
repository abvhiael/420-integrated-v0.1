// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { InventoryRegistry } from "../../../../src/highcountry/inventory/InventoryRegistry.sol";
import { ResourceLedger } from "../../../../src/highcountry/inventory/ResourceLedger.sol";
import { HarvestProductRegistry } from "../../../../src/highcountry/harvest/HarvestProductRegistry.sol";

contract R041ProductSource {
    HarvestProductRegistry.Product private record;
    function set(bytes32 id, address grower, uint32 grams) external {
        record.productId = id;
        record.grower = grower;
        record.quantityGrams = grams;
        record.registered = true;
    }
    function getProduct(bytes32) external view returns (HarvestProductRegistry.Product memory) {
        return record;
    }
}

contract R041Actor {
    function reserve(InventoryRegistry i, bytes32 op, bytes32 id, uint256 amount) external {
        i.reserve(op,id,amount);
    }
    function release(InventoryRegistry i, bytes32 op, bytes32 id, uint256 amount) external {
        i.release(op,id,amount);
    }
    function consume(InventoryRegistry i, bytes32 op, bytes32 id, uint256 amount, bool reserved) external {
        i.consume(op,id,amount,reserved);
    }
    function transferTo(InventoryRegistry i, bytes32 op, bytes32 id, address to, uint256 amount) external {
        i.transferAvailable(op,id,to,amount);
    }
    function acquire(InventoryRegistry i, bytes32 op, bytes32 id, address to, uint256 amount) external {
        i.acquire(op,id,to,amount);
    }
}

contract InventoryRegistryR041Test {
    R041ProductSource source;
    InventoryRegistry inventory;
    ResourceLedger ledger;
    R041Actor alice;
    R041Actor bob;
    bytes32 constant RESOURCE = keccak256("SEED-COUNT");
    function setUp() public {
        source = new R041ProductSource();
        inventory = new InventoryRegistry(address(source));
        ledger = inventory.ledger();
        alice = new R041Actor();
        bob = new R041Actor();
        inventory.registerResource(RESOURCE,InventoryRegistry.Unit.COUNT);
        inventory.setIssuer(address(this),true);
    }
    function testAcquisitionReserveReleaseConsumeAndConservation() public {
        ledgerCheck(RESOURCE,address(alice),0,0,0);
        inventory.acquire(bytes32(uint256(1)),RESOURCE,address(alice),100);
        alice.reserve(inventory,bytes32(uint256(2)),RESOURCE,60);
        ledgerCheck(RESOURCE,address(alice),40,60,0);
        alice.release(inventory,bytes32(uint256(3)),RESOURCE,10);
        alice.consume(inventory,bytes32(uint256(4)),RESOURCE,30,true);
        alice.transferTo(inventory,bytes32(uint256(5)),RESOURCE,address(bob),20);
        ledgerCheck(RESOURCE,address(alice),30,20,30);
        ledgerCheck(RESOURCE,address(bob),20,0,0);
        require(ledger.issued(RESOURCE)==100 && ledger.consumed(RESOURCE)==30,"global totals");
    }
    function testReplayAndOverdrawFailClosed() public {
        inventory.acquire(bytes32(uint256(11)),RESOURCE,address(alice),2);
        (bool replay,) = address(inventory).call(abi.encodeCall(inventory.acquire,(bytes32(uint256(11)),RESOURCE,address(alice),2)));
        require(!replay,"duplicate issue");
        (bool overdraw,) = address(alice).call(abi.encodeCall(alice.reserve,(inventory,bytes32(uint256(12)),RESOURCE,3)));
        require(!overdraw,"overdraft");
        (bool unauthorized,) = address(bob).call(abi.encodeCall(bob.acquire,(inventory,bytes32(uint256(13)),RESOURCE,address(bob),5)));
        require(!unauthorized,"unauthorized issuer");
        require(ledger.issued(RESOURCE)==2,"supply unchanged");
    }
    function testHarvestImportIsSingleUseAndOwnerFixed() public {
        bytes32 product=keccak256("product");
        source.set(product,address(alice),55);
        bytes32 id=inventory.importHarvest(product);
        ledgerCheck(id,address(alice),55,0,0);
        require(ledger.issued(id)==55,"harvest issued");
        (bool replay,) = address(inventory).call(abi.encodeCall(inventory.importHarvest,(product)));
        require(!replay,"double import");
        (bool spoof,) = address(bob).call(abi.encodeCall(bob.transferTo,(inventory,bytes32(uint256(20)),id,address(alice),1)));
        require(!spoof,"foreign balance transfer");
    }
    function testZeroHarvestNoTradableLot() public {
        bytes32 product=keccak256("zero");
        source.set(product,address(alice),0);
        (bool ok,) = address(inventory).call(abi.encodeCall(inventory.importHarvest,(product)));
        require(!ok,"zero harvest created inventory");
        require(!inventory.importedProduct(product),"zero import recorded");
    }
    function testRawLedgerExternalMutationForbidden() public {
        (bool ok,) = address(ledger).call(abi.encodeCall(ledger.acquire,(bytes32(uint256(1)),RESOURCE,address(alice),100)));
        require(!ok,"direct ledger mint");
    }
    function ledgerCheck(bytes32 id,address owner,uint256 a,uint256 r,uint256 c) internal view {
        ResourceLedger.Balance memory b=ledger.balance(id,owner);
        require(b.available==a && b.reserved==r && b.consumed==c,"balance mismatch");
    }
}
