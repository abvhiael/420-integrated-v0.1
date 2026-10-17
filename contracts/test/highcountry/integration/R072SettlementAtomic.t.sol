// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { RegionalUtilities } from "../../../src/highcountry/world/RegionalUtilities.sol";
import {
    RegionalEnvironmentSettlement,
    IRegionalEnvironmentEngine
} from "../../../src/highcountry/world/RegionalEnvironmentSettlement.sol";

contract TestUtilityForSettlement {
    mapping(bytes32 => bool) public spent;
    bool public fail;

    function setFail(
        bool b
    ) external {
        fail = b;
    }

    function consume(
        bytes32 op,
        uint16,
        uint8,
        address,
        uint256
    ) external {
        require(!fail, "burn blocked");
        require(!spent[op], "replay");
        spent[op] = true;
    }
}

contract TestEnvironmentForSettlement {
    bool public fail;
    uint64 public applied;

    function setFail(
        bool b
    ) external {
        fail = b;
    }

    function updateEnvironment(
        uint64 plantId,
        IRegionalEnvironmentEngine.EnvironmentSnapshot calldata
    ) external {
        require(!fail, "update blocked");
        applied = plantId;
    }
}

contract R072SettlementAtomicTest {
    TestUtilityForSettlement private u;
    TestEnvironmentForSettlement private e;
    RegionalEnvironmentSettlement private settlement;

    constructor() {
        u = new TestUtilityForSettlement();
        e = new TestEnvironmentForSettlement();
        settlement = new RegionalEnvironmentSettlement(address(u), address(e), address(this));
    }

    function _snapshot() private pure returns (IRegionalEnvironmentEngine.EnvironmentSnapshot memory) {
        return IRegionalEnvironmentEngine.EnvironmentSnapshot(2300, 5500, 6500, 5500, 6000, 5000);
    }

    function testAtomicSuccessAndReplay() public {
        bytes32 op = keccak256("ok");
        settlement.applySettlement(op, 1, 42, address(this), 1000, 250, _snapshot());
        require(settlement.settled(op) && e.applied() == 42, "settlement not recorded");
        require(
            u.spent(keccak256(abi.encode(op, uint8(1)))) && u.spent(keccak256(abi.encode(op, uint8(2)))),
            "utilities not consumed"
        );
        (bool replay,) = address(settlement)
            .call(
                abi.encodeCall(settlement.applySettlement, (op, 1, uint64(42), address(this), 1000, 250, _snapshot()))
            );
        require(!replay, "replay accepted");
    }

    function testEnvironmentFailureRollsBackBothBurns() public {
        e.setFail(true);
        bytes32 op = keccak256("rollback");
        (bool ok,) = address(settlement)
            .call(
                abi.encodeCall(settlement.applySettlement, (op, 1, uint64(42), address(this), 1000, 250, _snapshot()))
            );
        require(!ok && !settlement.settled(op), "failed op committed");
        require(
            !u.spent(keccak256(abi.encode(op, uint8(1)))) && !u.spent(keccak256(abi.encode(op, uint8(2)))),
            "resource burn not reverted"
        );
    }

    function testUtilityFailureRollsBack() public {
        u.setFail(true);
        bytes32 op = keccak256("burnfail");
        (bool ok,) = address(settlement)
            .call(
                abi.encodeCall(settlement.applySettlement, (op, 1, uint64(42), address(this), 1000, 250, _snapshot()))
            );
        require(!ok && !settlement.settled(op) && e.applied() == 0, "failed burn committed");
    }
}
