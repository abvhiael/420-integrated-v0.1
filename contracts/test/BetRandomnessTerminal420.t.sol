// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bet/BetAuthorization420.sol";
import "../src/bet/BetIds420.sol";
import "../src/bet/BetTypes420.sol";
import "../src/bet/RandomnessRouter420.sol";

interface VmBetRandomnessTerminal420 {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
}

contract MockCapabilityRegistryRandomnessTerminal420 is ICapabilityRegistry420 {
    mapping(bytes32 => bool) private _allowed;

    function setAllowed(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, bool value) external {
        _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))] = value;
    }

    function grant(bytes32) external pure returns (CapabilityGrant memory g) { return g; }

    function isAuthorized(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256)
        external view returns (bool)
    {
        return _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))];
    }
}

contract MockRandomnessTerminalProfiles420 {
    mapping(bytes32 => bool) public active;
    function setActive(bytes32 profileId, bool value) external { active[profileId] = value; }
    function isActiveOfType(bytes32 profileId, bytes32) external view returns (bool) { return active[profileId]; }
}

contract MockRandomnessTerminalRegistry420 {
    BetTypes420.Wager private _wager;
    function setWager(BetTypes420.Wager calldata wager_) external { _wager = wager_; }
    function getWager(bytes32 wagerId) external view returns (BetTypes420.Wager memory wager) {
        require(_wager.wagerId == wagerId, "wager");
        return _wager;
    }
}

contract BetRandomnessTerminal420Test {
    VmBetRandomnessTerminal420 constant vm = VmBetRandomnessTerminal420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ADMIN = address(0xA11CE);
    address constant REQUESTER = address(0xA0A0);
    address constant PRIMARY = address(0xB0B0);
    bytes32 constant WAGER = keccak256("randomness-terminal/wager");
    bytes32 constant PROFILE = keccak256("randomness-terminal/profile");
    bytes32 constant GAME_V1 = keccak256("randomness-terminal/game/v1");

    struct Suite {
        MockCapabilityRegistryRandomnessTerminal420 caps;
        BetAuthorization420 auth;
        MockRandomnessTerminalProfiles420 profiles;
        MockRandomnessTerminalRegistry420 registry;
        RandomnessRouter420 router;
        uint64 deadline;
    }

    function _deploy() private returns (Suite memory s) {
        s.caps = new MockCapabilityRegistryRandomnessTerminal420();
        s.auth = new BetAuthorization420(address(s.caps));
        s.profiles = new MockRandomnessTerminalProfiles420();
        s.registry = new MockRandomnessTerminalRegistry420();
        s.router = new RandomnessRouter420(address(s.auth), address(s.profiles), address(s.registry));
        s.deadline = uint64(block.timestamp + 1 hours);

        s.profiles.setActive(PROFILE, true);
        s.caps.setAllowed(
            ADMIN,
            BetIds420.COMPONENT_BET,
            BetIds420.ACTION_RANDOMNESS_CONFIGURE,
            s.auth.scopeForProfile(PROFILE),
            true
        );
        vm.prank(ADMIN);
        s.router.configureProfile(RandomnessRouter420.RandomnessProfile({
            profileId: PROFILE,
            method: RandomnessRouter420.Method.THRESHOLD_VRF,
            primaryProvider: PRIMARY,
            fallbackProvider: address(0),
            fallbackDelay: 15 minutes,
            securityLevelHash: keccak256("security"),
            domainSeparator: keccak256("domain"),
            manifestHash: keccak256("manifest"),
            exists: false
        }));

        s.registry.setWager(BetTypes420.Wager({
            wagerId: WAGER,
            player: address(0xC0FFEE),
            operatorId: keccak256("operator"),
            gameId: keccak256("game"),
            gameVersionId: GAME_V1,
            asset: address(0xCA0C),
            stake: 100 ether,
            maxGrossPayout: 500 ether,
            paramsHash: keccak256("params"),
            vaultId: keccak256("vault"),
            randomnessProfileId: PROFILE,
            riskProfileId: keccak256("risk"),
            settlementProfileId: keccak256("settlement"),
            accessPolicyId: keccak256("access"),
            rulesetId: keccak256("ruleset"),
            acceptedAt: uint64(block.timestamp),
            deadline: s.deadline,
            status: BetTypes420.WagerStatus.ACCEPTED
        }));

        s.caps.setAllowed(
            REQUESTER,
            BetIds420.COMPONENT_BET,
            BetIds420.ACTION_RANDOMNESS_REQUEST,
            s.auth.scopeForWager(WAGER),
            true
        );
        s.caps.setAllowed(
            PRIMARY,
            BetIds420.COMPONENT_BET,
            BetIds420.ACTION_RANDOMNESS_FULFILL,
            s.auth.scopeForWager(WAGER),
            true
        );
    }

    function testExpiredWagerCannotStartRandomness() public {
        Suite memory s = _deploy();
        vm.warp(s.deadline);
        vm.prank(REQUESTER);
        vm.expectRevert(RandomnessRouter420.WagerExpired.selector);
        s.router.requestRandomness(WAGER, keccak256("context"));
    }

    function testCommittedRandomnessMayFulfillAfterDeadlineForAuditability() public {
        Suite memory s = _deploy();
        vm.prank(REQUESTER);
        s.router.requestRandomness(WAGER, keccak256("context"));

        vm.warp(s.deadline + 1);
        vm.prank(PRIMARY);
        bytes32 root = s.router.fulfillPrimary(WAGER, keccak256("entropy"), keccak256("proof"));

        require(root != bytes32(0), "root");
        require(s.router.rootOf(WAGER) == root, "root mismatch");
        RandomnessRouter420.RandomnessRequest memory request = s.router.getRequest(WAGER);
        require(request.fulfilled, "not fulfilled");
        require(request.source == RandomnessRouter420.Source.PRIMARY, "source");
    }
}
