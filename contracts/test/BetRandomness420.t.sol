// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bet/BetAuthorization420.sol";
import "../src/bet/BetIds420.sol";
import "../src/bet/BetProfileRegistry420.sol";
import "../src/bet/BetRegistry420.sol";
import "../src/bet/BetTypes420.sol";
import "../src/bet/RandomnessRouter420.sol";

interface VmBetRandomness420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
    function warp(uint256) external;
}

contract MockCapabilityRegistryBetRandomness420 is ICapabilityRegistry420 {
    mapping(bytes32 => CapabilityGrant) private _grants;
    mapping(bytes32 => bool) private _allowed;
    function setAllowed(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, bool value) external {
        _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))] = value;
    }
    function grant(bytes32 grantId) external view returns (CapabilityGrant memory) { return _grants[grantId]; }
    function isAuthorized(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256) external view returns (bool) {
        return _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))];
    }
}

contract BetRandomness420Test {
    VmBetRandomness420 constant vm = VmBetRandomness420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ADMIN = address(0xA11CE);
    address constant RECORDER = address(0xBEEF);
    address constant REQUESTER = address(0xCAFE);
    address constant PRIMARY = address(0x1111);
    address constant FALLBACK = address(0x2222);
    address constant PLAYER = address(0x3333);
    bytes32 constant PROFILE = keccak256("profile/randomness/v1");
    bytes32 constant WAGER = keccak256("wager/randomness/1");
    bytes32 constant GAME = keccak256("game/dice");
    bytes32 constant GAME_V1 = keccak256("game/dice/v1");
    bytes32 constant VAULT = keccak256("vault/1");

    struct Suite { MockCapabilityRegistryBetRandomness420 caps; BetAuthorization420 auth; BetProfileRegistry420 profiles; BetRegistry420 wagers; RandomnessRouter420 router; }

    function _allow(Suite memory s, address principal, bytes32 action, bytes32 scope) private {
        s.caps.setAllowed(principal, BetIds420.COMPONENT_BET, action, scope, true);
    }

    function _deploy() private returns (Suite memory s) {
        s.caps = new MockCapabilityRegistryBetRandomness420();
        s.auth = new BetAuthorization420(address(s.caps));
        s.profiles = new BetProfileRegistry420(address(s.auth));
        s.wagers = new BetRegistry420(address(s.auth));
        s.router = new RandomnessRouter420(address(s.auth), address(s.profiles), address(s.wagers));
        _allow(s, ADMIN, BetIds420.ACTION_PROFILE_REGISTER, s.auth.scopeForProfile(PROFILE));
        vm.prank(ADMIN);
        s.profiles.registerProfile(PROFILE, keccak256("RANDOMNESS"), keccak256("manifest"), keccak256("artifact"));
        _allow(s, ADMIN, BetIds420.ACTION_RANDOMNESS_CONFIGURE, s.auth.scopeForProfile(PROFILE));
        RandomnessRouter420.RandomnessProfile memory p = RandomnessRouter420.RandomnessProfile(PROFILE, RandomnessRouter420.Method.THRESHOLD_VRF, PRIMARY, FALLBACK, 100, keccak256("security"), keccak256("dice-domain"), keccak256("randomness-manifest"), false);
        vm.prank(ADMIN);
        s.router.configureProfile(p);
        _allow(s, RECORDER, BetIds420.ACTION_WAGER_RECORD, s.auth.scopeForVault(VAULT));
        BetTypes420.Wager memory w = BetTypes420.Wager(WAGER, PLAYER, keccak256("operator"), GAME, GAME_V1, address(0x4444), 1 ether, 2 ether, keccak256("params"), VAULT, PROFILE, keccak256("risk"), keccak256("settlement"), keccak256("access"), keccak256("rules"), 0, uint64(block.timestamp + 1 days), BetTypes420.WagerStatus.NONE);
        vm.prank(RECORDER);
        s.wagers.recordAccepted(w);
    }

    function _request(Suite memory s) private returns (uint64 fallbackAt) {
        _allow(s, REQUESTER, BetIds420.ACTION_RANDOMNESS_REQUEST, s.auth.scopeForWager(WAGER));
        vm.prank(REQUESTER);
        fallbackAt = s.router.requestRandomness(WAGER, keccak256("draw-context/base"));
    }

    function testRequestDefaultDeny() public {
        Suite memory s = _deploy();
        vm.prank(REQUESTER);
        vm.expectRevert(RandomnessRouter420.Unauthorized.selector);
        s.router.requestRandomness(WAGER, keccak256("draw-context/base"));
    }

    function testPrimaryFulfillmentIsSingleUseAndIdempotent() public {
        Suite memory s = _deploy(); _request(s);
        _allow(s, PRIMARY, BetIds420.ACTION_RANDOMNESS_FULFILL, s.auth.scopeForWager(WAGER));
        bytes32 entropy = keccak256("entropy-primary"); bytes32 proof = keccak256("proof-primary");
        vm.prank(PRIMARY); bytes32 root = s.router.fulfillPrimary(WAGER, entropy, proof);
        require(root != bytes32(0) && s.router.rootOf(WAGER) == root, "root missing");
        vm.prank(PRIMARY); require(s.router.fulfillPrimary(WAGER, entropy, proof) == root, "retry changed root");
        vm.prank(PRIMARY); vm.expectRevert(RandomnessRouter420.AlreadyFulfilled.selector);
        s.router.fulfillPrimary(WAGER, keccak256("other-entropy"), proof);
    }

    function testFallbackCannotOverwritePrimaryRoot() public {
        Suite memory s = _deploy(); _request(s);
        _allow(s, PRIMARY, BetIds420.ACTION_RANDOMNESS_FULFILL, s.auth.scopeForWager(WAGER));
        _allow(s, FALLBACK, BetIds420.ACTION_RANDOMNESS_FULFILL, s.auth.scopeForWager(WAGER));

        bytes32 primaryRoot;
        vm.prank(PRIMARY);
        primaryRoot = s.router.fulfillPrimary(WAGER, keccak256("entropy-primary"), keccak256("proof-primary"));

        vm.prank(FALLBACK);
        vm.expectRevert(RandomnessRouter420.AlreadyFulfilled.selector);
        s.router.fulfillFallback(WAGER, keccak256("entropy-fallback"), keccak256("proof-fallback"));

        require(s.router.rootOf(WAGER) == primaryRoot, "fallback overwrote root");
        RandomnessRouter420.RandomnessRequest memory request = s.router.getRequest(WAGER);
        require(request.source == RandomnessRouter420.Source.PRIMARY, "source changed");
    }

    function testFallbackCannotRacePrimary() public {
        Suite memory s = _deploy(); uint64 fallbackAt = _request(s);
        _allow(s, PRIMARY, BetIds420.ACTION_RANDOMNESS_FULFILL, s.auth.scopeForWager(WAGER));
        _allow(s, FALLBACK, BetIds420.ACTION_RANDOMNESS_FULFILL, s.auth.scopeForWager(WAGER));
        vm.prank(FALLBACK); vm.expectRevert(RandomnessRouter420.FallbackNotReady.selector);
        s.router.fulfillFallback(WAGER, keccak256("fallback-entropy"), keccak256("fallback-proof"));
        vm.warp(fallbackAt);
        vm.prank(PRIMARY); vm.expectRevert(RandomnessRouter420.PrimaryExpired.selector);
        s.router.fulfillPrimary(WAGER, keccak256("primary-late"), keccak256("primary-proof"));
        vm.prank(FALLBACK); bytes32 root = s.router.fulfillFallback(WAGER, keccak256("fallback-entropy"), keccak256("fallback-proof"));
        require(root != bytes32(0), "fallback root missing");
    }

    function testDeprecatedProfileDoesNotDestroyAcceptedRequest() public {
        Suite memory s = _deploy(); _request(s);
        _allow(s, ADMIN, BetIds420.ACTION_PROFILE_DEPRECATE, s.auth.scopeForProfile(PROFILE));
        vm.prank(ADMIN); s.profiles.deprecate(PROFILE);
        _allow(s, PRIMARY, BetIds420.ACTION_RANDOMNESS_FULFILL, s.auth.scopeForWager(WAGER));
        vm.prank(PRIMARY); bytes32 root = s.router.fulfillPrimary(WAGER, keccak256("entropy"), keccak256("proof"));
        require(root != bytes32(0), "historical request blocked");
    }

    function testWrongProviderCannotFulfill() public {
        Suite memory s = _deploy(); _request(s);
        address attacker = address(0xDEAD);
        _allow(s, attacker, BetIds420.ACTION_RANDOMNESS_FULFILL, s.auth.scopeForWager(WAGER));
        vm.prank(attacker); vm.expectRevert(RandomnessRouter420.WrongProvider.selector);
        s.router.fulfillPrimary(WAGER, keccak256("entropy"), keccak256("proof"));
    }
}
