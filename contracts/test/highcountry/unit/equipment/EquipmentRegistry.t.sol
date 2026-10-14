// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { bindRetainedR04Emergency, retainedR04AuthorizationRoot } from "../../mocks/R04EmergencyFixture.sol";

import { EquipmentRegistry } from "../../../../src/highcountry/equipment/EquipmentRegistry.sol";

contract R042Land {
    mapping(uint64 => address) public operators;
    mapping(uint64 => uint32) public capacities;

    function setParcel(
        uint64 id,
        address operator,
        uint32 capacity
    ) external {
        operators[id] = operator;
        capacities[id] = capacity;
    }

    function effectiveOperator(
        uint64 id
    ) external view returns (address) {
        require(operators[id] != address(0), "unknown parcel");
        return operators[id];
    }

    function growCapacityOf(
        uint64 id
    ) external view returns (uint32) {
        return capacities[id];
    }
}

contract R042Player {
    function place(
        EquipmentRegistry equipment,
        bytes32 id,
        uint64 parcelId
    ) external {
        equipment.place(id, parcelId);
    }

    function remove(
        EquipmentRegistry equipment,
        bytes32 id
    ) external {
        equipment.remove(id);
    }

    function issue(
        EquipmentRegistry equipment,
        bytes32 id,
        bytes32 typeId,
        address owner,
        bytes32 ref
    ) external {
        equipment.issue(id, typeId, owner, ref);
    }
}

contract EquipmentRegistryR042Test {
    R042Land land;
    EquipmentRegistry registry;
    R042Player alice;
    R042Player bob;

    bytes32 constant TYPE = keccak256("EARNED-LAMP");
    bytes32 constant VERSION = keccak256("EQUIPMENT-V1");

    function setUp() public {
        land = new R042Land();
        registry = new EquipmentRegistry(retainedR04AuthorizationRoot(), address(land));
        bindRetainedR04Emergency(address(registry));
        alice = new R042Player();
        bob = new R042Player();
        land.setParcel(1, address(alice), 2);
        land.setParcel(2, address(bob), 1);
        int16[6] memory effects;
        effects[0] = 30;
        effects[1] = -20;
        effects[2] = 100;
        registry.registerType(TYPE, VERSION, 1, effects);
        registry.setIssuer(address(this), true);
    }

    function _earn(
        bytes32 id,
        uint256 evidence
    ) internal {
        registry.issue(id, TYPE, address(alice), bytes32(evidence));
    }

    function testEarnPlacementAndSixControlEffects() public {
        bytes32 first = bytes32(uint256(11));
        bytes32 second = bytes32(uint256(12));
        _earn(first, 101);
        _earn(second, 102);
        alice.place(registry, first, 1);
        alice.place(registry, second, 1);
        require(registry.occupiedSlots(1) == 2, "slot conservation");
        int256[6] memory values = registry.effectiveEffects(1, address(alice));
        require(values[0] == 60 && values[1] == -40 && values[2] == 200, "effect sums");
        for (uint256 i = 3; i < 6; ++i) {
            require(values[i] == 0, "unexpected effect");
        }
        alice.remove(registry, first);
        alice.remove(registry, second);
        require(registry.occupiedSlots(1) == 0, "slot release");
        values = registry.effectiveEffects(1, address(alice));
        for (uint256 i; i < 6; ++i) {
            require(values[i] == 0, "removed effect persists");
        }
    }

    function testDenyUntrustedIssuanceAndReplay() public {
        (bool unauthorized,) = address(bob)
            .call(abi.encodeCall(bob.issue, (registry, bytes32(uint256(1)), TYPE, address(bob), bytes32(uint256(77)))));
        require(!unauthorized, "untrusted issuer");
        _earn(bytes32(uint256(1)), 77);
        (bool replay,) = address(registry)
            .call(abi.encodeCall(registry.issue, (bytes32(uint256(2)), TYPE, address(alice), bytes32(uint256(77)))));
        require(!replay, "earning replay");
        (bool duplicate,) = address(registry)
            .call(abi.encodeCall(registry.issue, (bytes32(uint256(1)), TYPE, address(alice), bytes32(uint256(78)))));
        require(!duplicate, "duplicate item");
        require(registry.issuedCount() == 1, "counter changed");
    }

    function testPlacementAuthorizationCapacityAndDuplicate() public {
        bytes32 first = bytes32(uint256(11));
        bytes32 second = bytes32(uint256(12));
        bytes32 third = bytes32(uint256(13));
        _earn(first, 101);
        _earn(second, 102);
        _earn(third, 103);
        (bool foreign,) = address(bob).call(abi.encodeCall(bob.place, (registry, first, uint64(2))));
        require(!foreign, "foreign placement");
        (bool wrongParcel,) = address(alice).call(abi.encodeCall(alice.place, (registry, first, uint64(2))));
        require(!wrongParcel, "other operator parcel");
        alice.place(registry, first, 1);
        alice.place(registry, second, 1);
        (bool excess,) = address(alice).call(abi.encodeCall(alice.place, (registry, third, uint64(1))));
        require(!excess, "exceeds capacity");
        (bool doublePlace,) = address(alice).call(abi.encodeCall(alice.place, (registry, first, uint64(1))));
        require(!doublePlace, "duplicate placement");
        require(registry.occupiedSlots(1) == 2, "bad occupancy");
    }

    function testLandTransferRevokesEffectsAndOwnerCanRemove() public {
        bytes32 id = bytes32(uint256(11));
        _earn(id, 101);
        alice.place(registry, id, 1);
        land.setParcel(1, address(bob), 2);
        (bool successor,) = address(registry).call(abi.encodeCall(registry.effectiveEffects, (uint64(1), address(bob))));
        require(!successor, "successor inherited stale equipment");
        (bool stale,) = address(registry).call(abi.encodeCall(registry.effectiveEffects, (uint64(1), address(alice))));
        require(!stale, "stale operator effect");
        alice.remove(registry, id);
        require(registry.occupiedSlots(1) == 0, "failed to recover stranded item");
    }

    function testImmutableCatalogueAndNoWalletInput() public {
        EquipmentRegistry.EquipmentType memory kind = registry.equipmentType(TYPE);
        require(kind.catalogueVersion == VERSION && kind.slotCost == 1, "catalogue version");
        int16[6] memory zero;
        (bool overwrite,) =
            address(registry).call(abi.encodeCall(registry.registerType, (TYPE, keccak256("new"), uint16(1), zero)));
        require(!overwrite, "catalogue overwritten");
        require(kind.effects[0] == 30 && kind.effects[1] == -20, "changed stats");
    }
}
