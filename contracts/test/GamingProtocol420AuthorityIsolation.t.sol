// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/system/CapabilityRegistry420.sol";
import "../src/accounts/SmartAccount420.sol";
import "../src/gaming/GamingAuthorization420.sol";
import "../src/gaming/GamingIds420.sol";
import "../src/gaming/GameRegistry420.sol";

interface VmGaming420AuthorityIsolation {
    function prank(address) external;
    function warp(uint256) external;
}

contract GamingProtocol420AuthorityIsolationTest {
    VmGaming420AuthorityIsolation internal constant vm =
        VmGaming420AuthorityIsolation(address(uint160(uint256(keccak256("hevm cheat code")))));

    address internal constant GOVERNOR = address(0x420);
    address internal constant OPERATOR = address(0xBEEF);
    address internal constant ATTACKER = address(0xBAD);
    address internal constant SESSION = address(0x5151);
    address internal constant ENTRYPOINT = address(0xE1);

    bytes32 internal constant GAME_A = keccak256("420/GAMING/GAME/HIGH_COUNTRY/V1");
    bytes32 internal constant GAME_B = keccak256("420/GAMING/GAME/THE_GREEN_ROAD/V1");
    bytes32 internal constant GAME_C = keccak256("420/GAMING/GAME/BUDTENDER/V1");

    function _stack()
        internal
        returns (CapabilityRegistry420 registry, GamingAuthorization420 authorization, GameRegistry420 games)
    {
        registry = new CapabilityRegistry420();
        registry.registerProtocolComponent(GamingIds420.COMPONENT_GAMING, address(this));
        authorization = new GamingAuthorization420(address(registry));
        games = new GameRegistry420(address(authorization));
    }

    function _grant(
        CapabilityRegistry420 registry,
        GamingAuthorization420 authorization,
        bytes32 grantId,
        address principal,
        bytes32 gameId,
        bytes32 actionId,
        uint64 validFrom,
        uint64 validUntil
    ) internal {
        registry.createGrant(
            grantId,
            principal,
            GamingIds420.COMPONENT_GAMING,
            actionId,
            authorization.scopeForGame(gameId),
            0,
            0,
            0,
            validFrom,
            validUntil
        );
    }

    function testProductionRegistryBindsExactGamingComponentActionAndGameScope() public {
        (CapabilityRegistry420 registry, GamingAuthorization420 authorization, GameRegistry420 games) = _stack();

        _grant(
            registry,
            authorization,
            keccak256("gp16-2-register-a"),
            GOVERNOR,
            GAME_A,
            GamingIds420.ACTION_REGISTER_GAME,
            0,
            0
        );

        require(
            authorization.isAuthorized(GOVERNOR, GAME_A, GamingIds420.ACTION_REGISTER_GAME),
            "exact gaming grant denied"
        );
        require(
            !authorization.isAuthorized(GOVERNOR, GAME_B, GamingIds420.ACTION_REGISTER_GAME),
            "wrong game scope authorized"
        );
        require(
            !authorization.isAuthorized(GOVERNOR, GAME_A, GamingIds420.ACTION_UPDATE_GAME),
            "wrong gaming action authorized"
        );
        require(
            !registry.isAuthorized(
                GOVERNOR,
                keccak256("420/OTHER/COMPONENT"),
                GamingIds420.ACTION_REGISTER_GAME,
                authorization.scopeForGame(GAME_A),
                0
            ),
            "wrong component authorized"
        );

        vm.prank(GOVERNOR);
        games.registerGame(GAME_A, OPERATOR, keccak256("high-country-v1"));
        require(games.isActive(GAME_A), "authorized registration failed");
    }

    function testProductionGamingGrantExpiryAndRevocationFailClosed() public {
        (CapabilityRegistry420 registry, GamingAuthorization420 authorization,) = _stack();

        uint64 expiry = uint64(block.timestamp + 10);
        bytes32 expiring = keccak256("gp16-2-expiring");
        _grant(
            registry,
            authorization,
            expiring,
            GOVERNOR,
            GAME_A,
            GamingIds420.ACTION_UPDATE_GAME,
            0,
            expiry
        );
        require(
            authorization.isAuthorized(GOVERNOR, GAME_A, GamingIds420.ACTION_UPDATE_GAME),
            "fresh grant inactive"
        );
        vm.warp(uint256(expiry) + 1);
        require(
            !authorization.isAuthorized(GOVERNOR, GAME_A, GamingIds420.ACTION_UPDATE_GAME),
            "expired grant authorized"
        );

        bytes32 revoked = keccak256("gp16-2-revoked");
        _grant(
            registry,
            authorization,
            revoked,
            GOVERNOR,
            GAME_A,
            GamingIds420.ACTION_SET_GAME_STATUS,
            0,
            0
        );
        require(
            authorization.isAuthorized(GOVERNOR, GAME_A, GamingIds420.ACTION_SET_GAME_STATUS),
            "fresh revocable grant inactive"
        );
        registry.revokeGrant(revoked);
        require(
            !authorization.isAuthorized(GOVERNOR, GAME_A, GamingIds420.ACTION_SET_GAME_STATUS),
            "revoked grant authorized"
        );
    }

    function testProtocolComponentRegistrarCannotBeClaimedOrHijackSmartAccountComponent() public {
        CapabilityRegistry420 registry = new CapabilityRegistry420();

        vm.prank(ATTACKER);
        (bool attackerRegisterOk,) = address(registry).call(
            abi.encodeWithSelector(
                registry.registerProtocolComponent.selector,
                GamingIds420.COMPONENT_GAMING,
                ATTACKER
            )
        );
        require(!attackerRegisterOk, "attacker registered protocol component");

        bytes32 smartComponent = registry.registerSmartAccount(GOVERNOR);
        require(registry.componentAuthority(smartComponent) == GOVERNOR, "smart account authority mismatch");

        (bool overwriteOk,) = address(registry).call(
            abi.encodeWithSelector(registry.registerProtocolComponent.selector, smartComponent, ATTACKER)
        );
        require(!overwriteOk, "registrar overwrote smart account component");
        require(!registry.protocolComponentManaged(smartComponent), "smart account marked registrar managed");
    }

    function testSmartAccountSessionNeedsBothCallGrantAndExactGamingGrant() public {
        (CapabilityRegistry420 registry, GamingAuthorization420 authorization, GameRegistry420 games) = _stack();
        SmartAccount420 account = new SmartAccount420(ENTRYPOINT, address(registry), address(this), address(0));

        account.enableSessionKey(SESSION);
        account.createSessionGrant(
            SESSION,
            address(games),
            games.registerGame.selector,
            0,
            0,
            0,
            0,
            0
        );

        SmartAccount420.Call[] memory calls = new SmartAccount420.Call[](1);
        calls[0] = SmartAccount420.Call({
            target: address(games),
            value: 0,
            data: abi.encodeWithSelector(games.registerGame.selector, GAME_B, OPERATOR, keccak256("tgr-v1"))
        });

        vm.prank(ENTRYPOINT);
        (bool withoutGamingGrant,) = address(account).call(
            abi.encodeWithSelector(account.executeSession.selector, SESSION, calls)
        );
        require(!withoutGamingGrant, "session call grant bypassed gaming capability");
        require(!games.exists(GAME_B), "game registered without gaming capability");

        _grant(
            registry,
            authorization,
            keccak256("gp16-2-account-register-b"),
            address(account),
            GAME_B,
            GamingIds420.ACTION_REGISTER_GAME,
            0,
            0
        );

        require(
            !registry.isAuthorized(
                SESSION,
                GamingIds420.COMPONENT_GAMING,
                GamingIds420.ACTION_REGISTER_GAME,
                authorization.scopeForGame(GAME_B),
                0
            ),
            "session principal inherited gaming authority"
        );

        vm.prank(ENTRYPOINT);
        account.executeSession(SESSION, calls);
        require(games.isActive(GAME_B), "two-layer authorized session failed");

        SmartAccount420.Call[] memory wrongGameCalls = new SmartAccount420.Call[](1);
        wrongGameCalls[0] = SmartAccount420.Call({
            target: address(games),
            value: 0,
            data: abi.encodeWithSelector(games.registerGame.selector, GAME_C, OPERATOR, keccak256("budtender-v1"))
        });

        vm.prank(ENTRYPOINT);
        (bool wrongGameOk,) = address(account).call(
            abi.encodeWithSelector(account.executeSession.selector, SESSION, wrongGameCalls)
        );
        require(!wrongGameOk, "gaming grant escaped into another game scope");
        require(!games.exists(GAME_C), "wrong-scope game registered");
    }
}
