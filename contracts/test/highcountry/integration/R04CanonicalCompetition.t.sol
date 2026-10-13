// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { PublicPlantCapacityFixture } from "./PublicPlantCapacity.t.sol";
import { CultivationEngine } from "../../../src/highcountry/cultivation/CultivationEngine.sol";
import { HarvestEngine } from "../../../src/highcountry/harvest/HarvestEngine.sol";
import { HarvestProductRegistry } from "../../../src/highcountry/harvest/HarvestProductRegistry.sol";
import { RulesetRegistry } from "../../../src/highcountry/rules/RulesetRegistry.sol";
import { RulesetRouter } from "../../../src/highcountry/rules/RulesetRouter.sol";
import { ActionIds } from "../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../src/highcountry/constants/ModuleIds.sol";
import { R04EmergencyConsumer } from "../../../src/highcountry/security/R04EmergencyConsumer.sol";
import { CanonicalCompetitionEvidence } from "../../../src/highcountry/competition/CanonicalCompetitionEvidence.sol";
import {
    CanonicalCompetitionEntitlement
} from "../../../src/highcountry/competition/CanonicalCompetitionEntitlement.sol";
import { CompetitionEngine } from "../../../src/highcountry/competition/CompetitionEngine.sol";
import { SeasonRegistry } from "../../../src/highcountry/competition/SeasonRegistry.sol";
import { CompetitionTemplateRegistry } from "../../../src/highcountry/competition/CompetitionTemplateRegistry.sol";
import { Global420Cup } from "../../../src/highcountry/cup/Global420Cup.sol";
import { CanonicalCupAttestationConsumer } from "../../../src/highcountry/cup/CanonicalCupAttestationConsumer.sol";
import { GrowerProfileRegistry } from "../../../src/highcountry/player/GrowerProfileRegistry.sol";
import { HighCountryGamingBridge420 } from "../../../src/highcountry/player/HighCountryGamingBridge420.sol";
import { HighCountryCrossGame420 } from "../../../src/highcountry/player/HighCountryCrossGame420.sol";
import { OptionalCompetitionAccess420 } from "../../../src/highcountry/player/OptionalCompetitionAccess420.sol";
import { HighCountryGamingIds } from "../../../src/highcountry/player/HighCountryGamingIds.sol";
import { GamingAuthorization420 } from "../../../src/gaming/GamingAuthorization420.sol";
import { GamingIds420 } from "../../../src/gaming/GamingIds420.sol";
import { GameRegistry420 } from "../../../src/gaming/GameRegistry420.sol";
import { GameIdentity420 } from "../../../src/gaming/GameIdentity420.sol";
import { GameClaims420 } from "../../../src/gaming/GameClaims420.sol";
import { GameEntitlements420 } from "../../../src/gaming/GameEntitlements420.sol";
import { CrossGameRegistry420 } from "../../../src/gaming/CrossGameRegistry420.sol";

interface VmR04Blocks {
    function roll(
        uint256
    ) external;
    function setBlockhash(
        uint256,
        bytes32
    ) external;
}

contract R04CanonicalCompetitionTest is PublicPlantCapacityFixture {
    VmR04Blocks constant blocks = VmR04Blocks(address(uint160(uint256(keccak256("hevm cheat code")))));
    CultivationEngine cultivation;
    HarvestEngine harvest;
    HarvestProductRegistry products;
    CanonicalCompetitionEvidence evidence;
    CompetitionEngine competition;
    Global420Cup cup;
    GameRegistry420 games;
    GameIdentity420 identity;
    GameEntitlements420 entitlements;
    CrossGameRegistry420 sharedCross;
    GrowerProfileRegistry profiles;
    HighCountryGamingBridge420 bridge;
    CanonicalCupAttestationConsumer consumer;
    bytes32 rules;
    uint64 firstOpen;
    uint64 finalOpen;
    uint64 myGrower;
    uint64 aliceGrower;
    bytes32 constant GAME = keccak256("420/GAMING/GAME/HIGH_COUNTRY/V1");
    bytes32 constant OPTIONAL = keccak256("R04.OPTIONAL");
    bytes32 constant S = keccak256("season");
    bytes32 constant T = keccak256("template");
    bytes32 constant A = keccak256("semiA");
    bytes32 constant B = keccak256("semiB");
    bytes32 constant F = keccak256("final");
    bytes32 constant CUP = keccak256("cup");
    bytes32 constant SCOPE = keccak256("prestige");
    bytes32 constant MY_ENTITLEMENT = keccak256("my-entitlement");
    bytes32 constant ALICE_ENTITLEMENT = keccak256("alice-entitlement");

    function _bind(
        R04EmergencyConsumer target
    ) internal {
        _grant(
            address(this),
            ModuleIds.EMERGENCY_STATE,
            target.R04_BIND_ACTION(),
            target.emergencyBindingScope(address(emergency))
        );
        target.bindR04Emergency(address(emergency));
    }

    function setUp() public override {
        super.setUp();
        caps.registerProtocolComponent(ModuleIds.CULTIVATION_ENGINE, address(this));
        caps.registerProtocolComponent(ModuleIds.RULESET_REGISTRY, address(this));
        caps.registerProtocolComponent(ModuleIds.RULESET_ROUTER, address(this));
        caps.registerProtocolComponent(ModuleIds.HARVEST_ENGINE, address(this));
        cultivation = new CultivationEngine(address(auth), address(plants));
        _grant(
            address(this),
            ModuleIds.CULTIVATION_ENGINE,
            ActionIds.CULTIVATION_BIND_EMERGENCY,
            cultivation.EMERGENCY_BIND_SCOPE()
        );
        cultivation.bindEmergencyState(address(emergency));
        RulesetRegistry r = new RulesetRegistry(address(auth));
        RulesetRouter router = new RulesetRouter(address(auth), address(r));
        rules = r.deriveRulesetId(keccak256("approved"));
        _grant(address(this), ModuleIds.RULESET_REGISTRY, ActionIds.RULESET_REGISTER, rules);
        r.registerRuleset(keccak256("approved"));
        _grant(
            address(this), ModuleIds.RULESET_ROUTER, ActionIds.RULESET_ROUTE, cultivation.EXPRESSION_RULESET_DOMAIN()
        );
        router.setRulesetFor(cultivation.EXPRESSION_RULESET_DOMAIN(), rules);
        _grant(
            address(this),
            ModuleIds.CULTIVATION_ENGINE,
            ActionIds.CULTIVATION_BIND_RULESETS,
            cultivation.RULESET_BIND_SCOPE()
        );
        cultivation.bindRulesetRegistry(address(r), address(router));
        harvest = new HarvestEngine(address(auth), address(plants), address(cultivation));
        products = new HarvestProductRegistry(address(harvest));
        evidence = new CanonicalCompetitionEvidence(address(products), address(this), address(this), 1);
        _private(1);
        _private(3);
        _plot(1, 2);
        _allocate(1, ALICE, 2);
        _public(2, ALICE, 1);
        _public(4, ALICE, 1);
        vm.warp(block.timestamp + 17 days);
        for (uint64 i = 1; i <= 4; i++) {
            _grant(address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_ADVANCE, bytes32(uint256(i)));
            plants.syncOfflineGrowth(i);
        }
        _sharedIdentity();
        SeasonRegistry seasons = new SeasonRegistry();
        CompetitionTemplateRegistry templates = new CompetitionTemplateRegistry();
        firstOpen = uint64(block.timestamp + 10);
        finalOpen = firstOpen + 300;
        seasons.create(S, firstOpen, finalOpen + 1000, keccak256("season-rules"));
        templates.register(T, 1, keccak256("quality-only"), OPTIONAL);
        OptionalCompetitionAccess420 access = new OptionalCompetitionAccess420(address(auth), address(bridge));
        caps.registerProtocolComponent(ModuleIds.COMPETITION_ENGINE, address(this));
        _grant(address(this), ModuleIds.COMPETITION_ENGINE, ActionIds.OPTIONAL_COMPETITION_REGISTER, OPTIONAL);
        access.registerOptionalCompetition(OPTIONAL, MY_ENTITLEMENT, OPTIONAL);
        CanonicalCompetitionEntitlement gate = new CanonicalCompetitionEntitlement(address(profiles), address(access));
        competition = new CompetitionEngine(
            address(auth), address(seasons), address(templates), address(evidence), address(gate), address(this)
        );
        _bind(competition);
        competition.create(A, S, T, firstOpen, firstOpen + 100, firstOpen + 200);
        competition.create(B, S, T, firstOpen, firstOpen + 100, firstOpen + 200);
        competition.create(F, S, T, finalOpen, finalOpen + 100, finalOpen + 200);
        cup = new Global420Cup(address(auth), address(competition));
        _bind(cup);
        cup.create(CUP, A, B, F, keccak256("bracket"), keccak256("no-money"), SCOPE);
        HighCountryCrossGame420 cross = new HighCountryCrossGame420(address(sharedCross), address(bridge));
        consumer = new CanonicalCupAttestationConsumer(address(cup), address(cross));
    }

    function _sharedIdentity() internal {
        caps.registerProtocolComponent(GamingIds420.COMPONENT_GAMING, address(this));
        GamingAuthorization420 a = new GamingAuthorization420(address(caps));
        games = new GameRegistry420(address(a));
        _grant(address(this), GamingIds420.COMPONENT_GAMING, GamingIds420.ACTION_REGISTER_GAME, a.scopeForGame(GAME));
        games.registerGame(GAME, address(this), keccak256("hc"));
        identity = new GameIdentity420(address(games));
        entitlements = new GameEntitlements420(address(games), address(identity));
        sharedCross = new CrossGameRegistry420(address(games), address(identity));
        GameClaims420 claims = new GameClaims420(address(games), address(identity));
        profiles = new GrowerProfileRegistry(address(auth), address(regions), address(genesis));
        caps.registerProtocolComponent(ModuleIds.GROWER_PROFILE_REGISTRY, address(this));
        _grant(address(this), ModuleIds.GROWER_PROFILE_REGISTRY, ActionIds.GROWER_PROFILE_CREATE, bytes32(uint256(1)));
        myGrower = profiles.createProfile(1);
        _grant(ALICE, ModuleIds.GROWER_PROFILE_REGISTRY, ActionIds.GROWER_PROFILE_CREATE, bytes32(uint256(1)));
        vm.prank(ALICE);
        aliceGrower = profiles.createProfile(1);
        bytes32 mine = identity.createProfile(GAME, keccak256("registered-me"));
        vm.prank(ALICE);
        bytes32 alice = identity.createProfile(GAME, keccak256("registered-alice"));
        bridge = new HighCountryGamingBridge420(
            address(identity), address(claims), address(entitlements), address(profiles)
        );
        bridge.bindGrowerProfile(myGrower);
        vm.prank(ALICE);
        bridge.bindGrowerProfile(aliceGrower);
        entitlements.issue(MY_ENTITLEMENT, mine, HighCountryGamingIds.ENTITLEMENT_COMPETITION, OPTIONAL, 0, 0);
        entitlements.issue(ALICE_ENTITLEMENT, alice, HighCountryGamingIds.ENTITLEMENT_COMPETITION, OPTIONAL, 0, 0);
        bridge.bindPlayerEntitlement(myGrower, MY_ENTITLEMENT, HighCountryGamingIds.ENTITLEMENT_COMPETITION, OPTIONAL);
        vm.prank(ALICE);
        bridge.bindPlayerEntitlement(
            aliceGrower, ALICE_ENTITLEMENT, HighCountryGamingIds.ENTITLEMENT_COMPETITION, OPTIONAL
        );
    }

    function _product(
        uint64 plant,
        address player
    ) internal returns (bytes32 id, uint16 quality, uint64 at) {
        _grant(player, ModuleIds.CULTIVATION_ENGINE, ActionIds.CULTIVATION_UPDATE, bytes32(uint256(plant)));
        _grant(player, ModuleIds.CULTIVATION_ENGINE, ActionIds.PHENOTYPE_EXPRESS, bytes32(uint256(plant)));
        vm.prank(player);
        cultivation.updateEnvironment(
            plant,
            CultivationEngine.EnvironmentSnapshot(
                player == ALICE ? uint16(1100) : uint16(2400), 6000, 7000, 6000, 6500, 5000
            )
        );
        vm.prank(player);
        cultivation.expressPhenotype(plant, GENOME, rules);
        _grant(player, ModuleIds.HARVEST_ENGINE, ActionIds.HARVEST_ACCEPT, bytes32(uint256(plant)));
        vm.prank(player);
        harvest.acceptHarvest(plant);
        id = products.registerHarvestProduct(plant);
        uint256 b = products.registeredBlock(id);
        blocks.roll(b + 1);
        bytes32 hash = keccak256(abi.encode("canonical-block", b));
        blocks.setBlockhash(b, hash);
        (bool forged,) =
            address(evidence).call(abi.encodeCall(evidence.confirm, (id, keccak256("forged-source-block"))));
        require(!forged && evidence.confirmedProductHash(id) == bytes32(0), "forged source block confirmed");
        evidence.confirm(id, hash);
        HarvestProductRegistry.Product memory p = products.getProduct(id);
        return (id, p.qualityBps, p.harvestAcceptedAt);
    }

    function _submit(
        uint64 plant,
        address player,
        bytes32 eventId
    ) internal returns (bytes32 id) {
        vm.prank(player);
        competition.enter(eventId);
        uint16 quality;
        uint64 at;
        (id, quality, at) = _product(plant, player);
        vm.prank(player);
        competition.submit(eventId, id, quality, at);
    }

    function _finalCup() internal {
        vm.warp(firstOpen);
        _submit(1, address(this), A);
        _submit(2, ALICE, B);
        vm.warp(firstOpen + 200);
        competition.finalize(A);
        competition.finalize(B);
        vm.warp(finalOpen);
        _submit(3, address(this), F);
        _submit(4, ALICE, F);
        vm.warp(finalOpen + 200);
        competition.finalize(F);
        cup.finalize(CUP);
        cup.issueCrossGame(CUP);
    }

    function testCanonicalHarvestCupSharedAttestationAndRevocation() public {
        _finalCup();
        (bool refinalized,) = address(cup).call(abi.encodeCall(cup.finalize, (CUP)));
        (bool reissued,) = address(cup).call(abi.encodeCall(cup.issueCrossGame, (CUP)));
        require(!refinalized && !reissued, "canonical Cup replay");
        bytes32 payload = consumer.payload(CUP, SCOPE);
        bytes32 id = keccak256("shared-cup-attestation");
        HighCountryCrossGame420 cross = HighCountryCrossGame420(address(consumer.crossGame()));
        sharedCross.issue(id, bridge.gameProfileIdOfGrower(myGrower), cross.global420CupSubject(), CUP, payload, 0);
        require(consumer.eligible(myGrower, address(this), CUP, SCOPE, id), "canonical consumer denied");
        require(!consumer.eligible(myGrower, address(this), CUP, keccak256("wrong-scope"), id), "scope bypass");
        require(!consumer.eligible(aliceGrower, address(this), CUP, SCOPE, id), "profile/account bypass");
        bytes32 forgedId = keccak256("wrong-source-attestation");
        sharedCross.issue(
            forgedId,
            bridge.gameProfileIdOfGrower(myGrower),
            cross.global420CupSubject(),
            keccak256("wrong-cup"),
            payload,
            0
        );
        require(!consumer.eligible(myGrower, address(this), CUP, SCOPE, forgedId), "attestation source bypass");
        entitlements.revoke(MY_ENTITLEMENT);
        require(!cup.isIssued(CUP, address(this), SCOPE), "revoked entitlement still issued");
        require(!consumer.eligible(myGrower, address(this), CUP, SCOPE, id), "revocation bypass");
    }

    function testForgedHarvestOwnerQualityTimeBlockHashAndReplay() public {
        vm.warp(firstOpen);
        (bytes32 id, uint16 quality, uint64 at) = _product(1, address(this));
        require(!evidence.verifiedFlower(id, ALICE, quality, at), "forged owner");
        require(!evidence.verifiedFlower(id, address(this), quality - 1, at), "forged quality");
        require(!evidence.verifiedFlower(id, address(this), quality, at + 1), "forged time");
        require(!evidence.verifiedFlower(keccak256("fake"), address(this), quality, at), "forged product");
        (bool again,) = address(evidence).call(abi.encodeCall(evidence.confirm, (id, keccak256("fake-block"))));
        require(!again, "confirmation replay");
        competition.enter(A);
        competition.submit(A, id, quality, at);
        (bool replay,) = address(competition).call(abi.encodeCall(competition.submit, (A, id, quality, at)));
        require(!replay, "result replay");
        evidence.revoke(id);
        vm.warp(firstOpen + 200);
        competition.finalize(A);
        require(competition.winners(A) == address(0), "revoked harvest won");
    }

    function testDisputedCanonicalResultCannotQualifyCup() public {
        vm.warp(firstOpen);
        _submit(1, address(this), A);
        _submit(2, ALICE, B);
        competition.reject(A, address(this));
        vm.warp(firstOpen + 200);
        competition.finalize(A);
        competition.finalize(B);
        vm.warp(finalOpen);
        _submit(3, address(this), F);
        _submit(4, ALICE, F);
        vm.warp(finalOpen + 200);
        competition.finalize(F);
        (bool accepted,) = address(cup).call(abi.encodeCall(cup.finalize, (CUP)));
        require(!accepted, "disputed semifinal qualified");
    }
}
