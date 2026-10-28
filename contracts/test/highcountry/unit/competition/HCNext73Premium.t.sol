// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {
    PremiumCompetitionEntitlements73,
    IHC73ExternalEntitlement
} from "../../../../src/highcountry/competition/PremiumCompetitionEntitlements73.sol";
import { CompetitionEngine } from "../../../../src/highcountry/competition/CompetitionEngine.sol";
import { SeasonRegistry } from "../../../../src/highcountry/competition/SeasonRegistry.sol";
import { CompetitionTemplateRegistry } from "../../../../src/highcountry/competition/CompetitionTemplateRegistry.sol";
import { bindRetainedR04Emergency, retainedR04AuthorizationRoot } from "../../mocks/R04EmergencyFixture.sol";

interface Vm73 {
    function warp(
        uint256
    ) external;
}

contract EntitledIssuer73 is IHC73ExternalEntitlement {
    mapping(address => mapping(bytes32 => bool)) public allowed;
    bool public unavailable;

    function set(
        address user,
        bytes32 scope,
        bool value
    ) external {
        allowed[user][scope] = value;
    }

    function setUnavailable(
        bool value
    ) external {
        unavailable = value;
    }

    function eligible(
        address user,
        bytes32 scope
    ) external view returns (bool) {
        require(!unavailable, "issuer-down");
        return allowed[user][scope];
    }
}

contract Flower73 {
    mapping(bytes32 => bytes32) public qualified;

    function set(
        bytes32 h,
        address a,
        uint16 q,
        uint64 at
    ) external {
        qualified[h] = keccak256(abi.encode(a, q, at));
    }

    function verifiedFlower(
        bytes32 h,
        address a,
        uint16 q,
        uint64 at
    ) external view returns (bool) {
        return qualified[h] != bytes32(0) && qualified[h] == keccak256(abi.encode(a, q, at));
    }
}

contract Entrant73 {
    function enter(
        CompetitionEngine e,
        bytes32 eventId
    ) external {
        e.enter(eventId);
    }

    function submit(
        CompetitionEngine e,
        bytes32 eventId,
        bytes32 h,
        uint16 q,
        uint64 at
    ) external {
        e.submit(eventId, h, q, at);
    }
}

contract PremiumCompetition73Test {
    Vm73 constant vm = Vm73(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 constant S = keccak256("season");
    bytes32 constant P = keccak256("premium");
    bytes32 constant B = keccak256("base");
    bytes32 constant G = keccak256("approved-premium-scope");
    SeasonRegistry seasons;
    CompetitionTemplateRegistry templates;
    PremiumCompetitionEntitlements73 gates;
    EntitledIssuer73 issuer;
    CompetitionEngine engine;
    Flower73 evidence;
    Entrant73 alice;
    Entrant73 bob;
    uint64 opens;
    uint64 closes;
    uint64 challenge;

    function setUp() public {
        seasons = new SeasonRegistry();
        templates = new CompetitionTemplateRegistry();
        gates = new PremiumCompetitionEntitlements73(address(this));
        issuer = new EntitledIssuer73();
        evidence = new Flower73();
        engine = new CompetitionEngine(
            retainedR04AuthorizationRoot(),
            address(seasons),
            address(templates),
            address(evidence),
            address(gates),
            address(this)
        );
        bindRetainedR04Emergency(address(engine));
        alice = new Entrant73();
        bob = new Entrant73();
        opens = uint64(block.timestamp + 100);
        closes = opens + 100;
        challenge = closes + 100;
        seasons.create(S, opens, closes + 1000, keccak256("season-rules"));
        templates.register(B, 1, keccak256("same-fair-scoring"), bytes32(0));
        templates.register(P, 1, keccak256("same-fair-scoring"), G);
        engine.create(B, S, B, opens, closes, challenge);
        engine.create(P, S, P, opens, closes, challenge);
    }

    function testBaseEntryIndependentOfPremiumAndNoPayToWin() public {
        vm.warp(opens);
        alice.enter(engine, B);
        (bool denied,) = address(alice).call(abi.encodeCall(alice.enter, (engine, P)));
        require(!denied, "unknown premium scope should deny");
        gates.registerGate(G, address(issuer));
        issuer.set(address(alice), G, true);
        alice.enter(engine, P);
        bob.enter(engine, B);
        bytes32 h1 = keccak256("a");
        bytes32 h2 = keccak256("b");
        evidence.set(h1, address(alice), 5000, opens);
        evidence.set(h2, address(bob), 9000, opens);
        alice.submit(engine, B, h1, 5000, opens);
        alice.submit(engine, P, h1, 5000, opens);
        bob.submit(engine, B, h2, 9000, opens);
        vm.warp(challenge);
        engine.finalize(B);
        engine.finalize(P);
        require(engine.winners(B) == address(bob), "premium player got score advantage");
        require(engine.winnerScore(B) == 9000 && engine.winnerScore(P) == 5000, "premium changed quality scoring");
    }

    function testRevocationAndIssuerOutageFailClosedAtEntryAndFinalization() public {
        gates.registerGate(G, address(issuer));
        issuer.set(address(alice), G, true);
        vm.warp(opens);
        alice.enter(engine, P);
        bytes32 h = keccak256("harvest");
        evidence.set(h, address(alice), 10000, opens);
        alice.submit(engine, P, h, 10000, opens);
        issuer.set(address(alice), G, false);
        vm.warp(challenge);
        engine.finalize(P);
        require(engine.winners(P) == address(0), "revoked entitlement won");
        require(!engine.resultIsCurrent(P, address(alice)), "revoked result current");
    }

    function testScopeCollisionMissingVerifierPauseAndDuplicateRegistration() public {
        require(!gates.eligible(address(alice), G), "unknown scope allowed");
        gates.registerGate(G, address(issuer));
        (bool duplicate,) = address(gates).call(abi.encodeCall(gates.registerGate, (G, address(issuer))));
        require(!duplicate, "scope rebound");
        issuer.set(address(alice), G, true);
        require(gates.eligible(address(alice), G), "valid independent issuer denied");
        issuer.setUnavailable(true);
        require(!gates.eligible(address(alice), G), "issuer outage allowed");
        issuer.setUnavailable(false);
        gates.setActive(G, false);
        require(!gates.eligible(address(alice), G), "paused scope allowed");
        vm.warp(opens);
        alice.enter(engine, B);
        (bool denied,) = address(alice).call(abi.encodeCall(alice.enter, (engine, P)));
        require(!denied, "paused premium accepted");
    }
}
