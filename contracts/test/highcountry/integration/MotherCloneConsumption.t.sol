// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { PublicPlantCapacityFixture } from "./PublicPlantCapacity.t.sol";
import { MotherRegistry } from "../../../src/highcountry/genetics/MotherRegistry.sol";
import { CloneRegistry } from "../../../src/highcountry/genetics/CloneRegistry.sol";
import { ModuleIds } from "../../../src/highcountry/constants/ModuleIds.sol";
import { ActionIds } from "../../../src/highcountry/constants/ActionIds.sol";
import {
    HCInvalidState,
    HCCapacityExceeded,
    HCUnauthorized,
    HCAlreadyExists
} from "../../../src/highcountry/errors/HighCountryErrors.sol";

contract MotherCloneConsumptionTest is PublicPlantCapacityFixture {
    function _mother(
        uint64 id,
        address owner,
        uint32 capacity
    ) internal returns (bytes32 cuttingGrant) {
        _grant(address(this), ModuleIds.MOTHER_REGISTRY, ActionIds.MOTHER_REGISTER, bytes32(uint256(id)));
        mothers.registerMother(id, GENOME, owner, capacity, keccak256("mother"));
        cuttingGrant =
            _grant(address(clones), ModuleIds.MOTHER_REGISTRY, ActionIds.MOTHER_CONSUME_CUTTING, bytes32(uint256(id)));
    }

    function _clone(
        uint64 id,
        uint64 motherId,
        address owner
    ) internal {
        _grant(address(this), ModuleIds.CLONE_REGISTRY, ActionIds.CLONE_REGISTER, bytes32(uint256(id)));
        clones.registerClone(id, GENOME, motherId, owner, keccak256("clone"));
    }

    function testFiniteCuttingBudgetAndRetirement() public {
        _mother(10, address(this), 2);
        _clone(20, 10, address(this));
        _clone(21, 10, address(this));
        require(mothers.getMother(10).retired && mothers.remainingCuttings(10) == 0, "retire");
        require(mothers.cuttingForClone(20) == 10 && mothers.cuttingForClone(21) == 10, "provenance");
        _grant(address(this), ModuleIds.CLONE_REGISTRY, ActionIds.CLONE_REGISTER, bytes32(uint256(22)));
        _reject(
            address(clones),
            abi.encodeCall(clones.registerClone, (22, GENOME, 10, address(this), keccak256("third"))),
            HCInvalidState.selector
        );
        require(!clones.exists(22) && mothers.getMother(10).cuttingsTaken == 2, "exhaustion");
    }

    function testWrongOwnerAndMissingGrantDoNotConsume() public {
        _mother(10, address(this), 2);
        _grant(address(this), ModuleIds.CLONE_REGISTRY, ActionIds.CLONE_REGISTER, bytes32(uint256(20)));
        _reject(
            address(clones),
            abi.encodeCall(clones.registerClone, (20, GENOME, 10, ALICE, bytes32(0))),
            HCInvalidState.selector
        );
        require(!clones.exists(20) && mothers.remainingCuttings(10) == 2, "owner rollback");
        bytes32 revoke = _mother(11, address(this), 1);
        // A revoked consumption capability must revert the complete clone issuance.
        caps.revokeGrant(revoke);
        _reject(
            address(clones),
            abi.encodeCall(clones.registerClone, (20, GENOME, 11, address(this), bytes32(0))),
            HCUnauthorized.selector
        );
        require(!clones.exists(20) && mothers.remainingCuttings(11) == 1, "auth rollback");
        _grant(address(clones), ModuleIds.MOTHER_REGISTRY, ActionIds.MOTHER_CONSUME_CUTTING, bytes32(uint256(11)));
        _clone(20, 11, address(this));
        require(clones.exists(20) && mothers.remainingCuttings(11) == 0, "retry");
    }

    function testLegacyConsumeDeniedAndDuplicateDoesNotTakeAnotherCutting() public {
        _mother(10, address(this), 3);
        _clone(20, 10, address(this));
        _reject(address(mothers), abi.encodeCall(mothers.consumeCutting, (10)), HCInvalidState.selector);
        _reject(
            address(clones),
            abi.encodeCall(clones.registerClone, (20, GENOME, 10, address(this), bytes32(0))),
            HCAlreadyExists.selector
        );
        require(mothers.getMother(10).cuttingsTaken == 1, "duplicate budget");
    }

    function testTransferChangesCurrentOwnerEligibility() public {
        _mother(10, address(this), 2);
        _grant(address(this), ModuleIds.MOTHER_REGISTRY, ActionIds.MOTHER_TRANSFER, bytes32(uint256(10)));
        mothers.transfer(10, ALICE);
        _grant(address(this), ModuleIds.CLONE_REGISTRY, ActionIds.CLONE_REGISTER, bytes32(uint256(20)));
        _reject(
            address(clones),
            abi.encodeCall(clones.registerClone, (20, GENOME, 10, address(this), bytes32(0))),
            HCInvalidState.selector
        );
        _clone(20, 10, ALICE);
        require(clones.getClone(20).owner == ALICE, "mother owner");
    }
}
