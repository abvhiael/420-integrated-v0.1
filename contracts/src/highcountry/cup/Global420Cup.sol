// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {R04EmergencyConsumer} from "../security/R04EmergencyConsumer.sol";
import {EmergencyDomains} from "../constants/EmergencyDomains.sol";
import { CompetitionEngine } from "../competition/CompetitionEngine.sol";

/// @title Global420Cup
/// @notice Fixed two-semifinal/one-final cup backed exclusively by finalized canonical competition results.
/// @dev This contract cannot transfer assets, mint monetary prizes, or call another game's contracts.
contract Global420Cup is R04EmergencyConsumer {
    error Invalid();
    error Unauthorized();

    struct Cup {
        address organizer;
        bytes32 semiA;
        bytes32 semiB;
        bytes32 finalEvent;
        bytes32 rulesHash;
        bytes32 prizeRulesHash;
        bytes32 crossGameScope;
        bool finalized;
        address champion;
    }

    CompetitionEngine public immutable engine;
    mapping(bytes32 => Cup) public cups;
    mapping(bytes32 => bool) public claimedEvent;
    mapping(bytes32 => mapping(address => bool)) public issued;
    mapping(bytes32 => bytes32) public finalResultCommitment;

    event CupCreated(bytes32 indexed cupId, bytes32 semiA, bytes32 semiB, bytes32 finalEvent);
    event CupFinalized(bytes32 indexed cupId, address indexed champion, bytes32 resultCommitment);
    event CrossGameIssued(
        bytes32 indexed cupId, address indexed champion, bytes32 indexed scope, bytes32 resultCommitment
    );

    constructor(address r04Authorization_, 
        address engine_
    ) R04EmergencyConsumer(r04Authorization_) {
        if (engine_.code.length == 0) revert Invalid();
        engine = CompetitionEngine(engine_);
    }

    function create(
        bytes32 id,
        bytes32 semiA,
        bytes32 semiB,
        bytes32 finalEvent,
        bytes32 rulesHash,
        bytes32 prizeRulesHash,
        bytes32 crossGameScope
    ) external r04Unrestricted(EmergencyDomains.COMPETITION_ENTRY) {
        if (
            id == bytes32(0) || rulesHash == bytes32(0) || prizeRulesHash == bytes32(0) || crossGameScope == bytes32(0)
                || cups[id].organizer != address(0) || semiA == bytes32(0) || semiB == bytes32(0)
                || finalEvent == bytes32(0) || semiA == semiB || semiA == finalEvent || semiB == finalEvent
                || claimedEvent[semiA] || claimedEvent[semiB] || claimedEvent[finalEvent]
        ) revert Invalid();

        (bytes32 seasonA,, address organizerA,,,,, bool closedA, bool cancelledA) = engine.events(semiA);
        (bytes32 seasonB,, address organizerB,,,,, bool closedB, bool cancelledB) = engine.events(semiB);
        (bytes32 seasonF,, address organizerF,,,,, bool closedF, bool cancelledF) = engine.events(finalEvent);
        if (
            organizerA != msg.sender || organizerB != msg.sender || organizerF != msg.sender || seasonA == bytes32(0)
                || seasonA != seasonB || seasonA != seasonF || closedA || closedB || closedF || cancelledA || cancelledB
                || cancelledF
        ) revert Unauthorized();

        claimedEvent[semiA] = true;
        claimedEvent[semiB] = true;
        claimedEvent[finalEvent] = true;
        cups[id] =
            Cup(msg.sender, semiA, semiB, finalEvent, rulesHash, prizeRulesHash, crossGameScope, false, address(0));
        emit CupCreated(id, semiA, semiB, finalEvent);
    }

    /// @dev Refuses nonqualifiers even if a compromised external organizer entered them in the final.
    function finalize(
        bytes32 id
    ) external {
        Cup storage c = cups[id];
        if (c.organizer == address(0) || c.finalized || !resultsCurrent(id)) revert Unauthorized();
        (,, address organizerA,,,,, bool closedA, bool cancelledA) = engine.events(c.semiA);
        (,, address organizerB,,,,, bool closedB, bool cancelledB) = engine.events(c.semiB);
        (,, address organizerF,,,,, bool closedF, bool cancelledF) = engine.events(c.finalEvent);
        if (
            organizerA != c.organizer || organizerB != c.organizer || organizerF != c.organizer || !closedA || !closedB
                || !closedF || cancelledA || cancelledB || cancelledF
        ) revert Unauthorized();

        address first = engine.winners(c.semiA);
        address second = engine.winners(c.semiB);
        address champion = engine.winners(c.finalEvent);
        if (
            first == address(0) || second == address(0) || first == second || champion == address(0)
                || (champion != first && champion != second)
        ) revert Invalid();

        // Exactly two finalists, neither substituted nor duplicated.
        (,,,,,, uint32 count,,) = engine.events(c.finalEvent);
        if (
            count != 2 || engine.entrantAt(c.finalEvent, 0) != first && engine.entrantAt(c.finalEvent, 0) != second
                || engine.entrantAt(c.finalEvent, 1) != first && engine.entrantAt(c.finalEvent, 1) != second
                || engine.entrantAt(c.finalEvent, 0) == engine.entrantAt(c.finalEvent, 1)
        ) revert Invalid();

        bytes32 commitment = keccak256(
            abi.encode(
                block.chainid,
                address(this),
                id,
                c.rulesHash,
                c.prizeRulesHash,
                c.crossGameScope,
                c.semiA,
                c.semiB,
                c.finalEvent,
                first,
                second,
                champion,
                engine.winnerScore(c.semiA),
                engine.winnerScore(c.semiB),
                engine.winnerScore(c.finalEvent)
            )
        );
        c.finalized = true;
        c.champion = champion;
        finalResultCommitment[id] = commitment;
        emit CupFinalized(id, champion, commitment);
    }

    /// @notice A scoped, nonfinancial attestation. Consumers must validate chain, contract, cup and scope.
    /// @dev No arbitrary external calls or uncollateralized funded reward promises.
    function issueCrossGame(
        bytes32 id
    ) external r04Unrestricted(EmergencyDomains.COMPETITION_ENTRY) {
        Cup memory c = cups[id];
        if (!c.finalized || c.champion == address(0) || issued[id][c.champion] || !resultsCurrent(id)) revert Unauthorized();
        issued[id][c.champion] = true;
        emit CrossGameIssued(id, c.champion, c.crossGameScope, finalResultCommitment[id]);
    }

    function resultsCurrent(bytes32 id) public view returns (bool) {
        Cup memory c = cups[id];
        (,,,,,, uint32 count,,) = engine.events(c.finalEvent);
        if (count != 2) return false;
        return c.organizer != address(0)
            && engine.resultIsCurrent(c.semiA, engine.winners(c.semiA))
            && engine.resultIsCurrent(c.semiB, engine.winners(c.semiB))
            && engine.resultIsCurrent(c.finalEvent, engine.entrantAt(c.finalEvent, 0))
            && engine.resultIsCurrent(c.finalEvent, engine.entrantAt(c.finalEvent, 1));
    }

    function isIssued(
        bytes32 id,
        address player,
        bytes32 scope
    ) external view returns (bool) {
        Cup memory c = cups[id];
        return resultsCurrent(id) && c.finalized && c.champion == player && c.crossGameScope == scope && issued[id][player];
    }
}

