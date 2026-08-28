// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bet/slots/BetSlotIds420.sol";
import "../src/bet/slots/BetSlotAuthorization420.sol";
import "../src/bet/slots/SlotDefinitionRegistry420.sol";

interface VmBetSlot420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract MockCapabilityRegistryBetSlot420 is ICapabilityRegistry420 {
    mapping(bytes32 => CapabilityGrant) private _grants;
    mapping(bytes32 => bool) public allowed;

    function setAllowed(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, bool value) external {
        allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))] = value;
    }

    function grant(bytes32 grantId) external view returns (CapabilityGrant memory) { return _grants[grantId]; }

    function isAuthorized(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256)
        external
        view
        returns (bool)
    {
        return allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))];
    }
}

contract BetSlotRegistry420Test {
    VmBetSlot420 constant vm = VmBetSlot420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant CURATOR = address(0xC0FFEE);
    address constant RISK = address(0xBEEF);
    address constant EVE = address(0xE7E);

    bytes32 constant SLOT_ID = keccak256("420BET.SLOT.TEST");
    bytes32 constant SECOND_SLOT_ID = keccak256("420BET.SLOT.SECOND");
    bytes32 constant VAULT_ID = keccak256("420BET.VAULT.CASINO.420");

    bytes32 constant MANIFEST = keccak256("manifest-v1");
    bytes32 constant CODE = keccak256("code-v1");
    bytes32 constant REELS = keccak256("reels-v1");
    bytes32 constant PAYTABLE = keccak256("paytable-v1");
    bytes32 constant RTP = keccak256("rtp-v1");
    bytes32 constant LIABILITY = keccak256("liability-v1");

    struct Suite {
        MockCapabilityRegistryBetSlot420 caps;
        BetSlotAuthorization420 auth;
        SlotDefinitionRegistry420 registry;
    }

    function _deploy() private returns (Suite memory s) {
        s.caps = new MockCapabilityRegistryBetSlot420();
        s.auth = new BetSlotAuthorization420(address(s.caps));
        s.registry = new SlotDefinitionRegistry420(address(s.auth));
    }

    function _allowSlot(Suite memory s, address who, bytes32 slotId, uint32 version, bytes32 actionId) private {
        s.caps.setAllowed(
            who,
            BetSlotIds420.COMPONENT_BET_SLOTS,
            actionId,
            s.auth.scopeForSlot(slotId, version),
            true
        );
    }

    function _allowVault(Suite memory s, address who, bytes32 slotId, uint32 version, bytes32 actionId) private {
        s.caps.setAllowed(
            who,
            BetSlotIds420.COMPONENT_BET_SLOTS,
            actionId,
            s.auth.scopeForSlotVault(VAULT_ID, slotId, version),
            true
        );
    }

    function _register(Suite memory s, bytes32 slotId, uint32 version) private {
        _allowSlot(s, CURATOR, slotId, version, BetSlotIds420.ACTION_REGISTER);
        vm.prank(CURATOR);
        s.registry.registerSlot(slotId, version, 1, MANIFEST, CODE, REELS, PAYTABLE, RTP, LIABILITY, 10_000e18);
    }

    function _approve(Suite memory s, bytes32 slotId, uint32 version) private {
        _allowSlot(s, CURATOR, slotId, version, BetSlotIds420.ACTION_SUBMIT_REVIEW);
        vm.prank(CURATOR);
        s.registry.submitForReview(slotId, version);
        _allowSlot(s, CURATOR, slotId, version, BetSlotIds420.ACTION_APPROVE);
        vm.prank(CURATOR);
        s.registry.approveSlot(slotId, version);
    }

    function _activate(Suite memory s, bytes32 slotId, uint32 version) private {
        _allowSlot(s, CURATOR, slotId, version, BetSlotIds420.ACTION_ACTIVATE);
        vm.prank(CURATOR);
        s.registry.activateSlot(slotId, version);
    }

    function testDefaultDenyRegistration() public {
        Suite memory s = _deploy();
        vm.prank(EVE);
        vm.expectRevert(SlotDefinitionRegistry420.Unauthorized.selector);
        s.registry.registerSlot(SLOT_ID, 1, 1, MANIFEST, CODE, REELS, PAYTABLE, RTP, LIABILITY, 10_000e18);
    }

    function testRegistrationCreatesDraftOnly() public {
        Suite memory s = _deploy();
        _register(s, SLOT_ID, 1);
        SlotDefinitionRegistry420.SlotDefinition memory d = s.registry.getSlot(SLOT_ID, 1);
        require(d.status == SlotDefinitionRegistry420.SlotStatus.DRAFT, "not draft");
        require(!s.registry.isPlayable(VAULT_ID, SLOT_ID, 1), "draft playable");
    }

    function testApprovalDoesNotActivateOrAuthorizeVault() public {
        Suite memory s = _deploy();
        _register(s, SLOT_ID, 1);
        _approve(s, SLOT_ID, 1);
        SlotDefinitionRegistry420.SlotDefinition memory d = s.registry.getSlot(SLOT_ID, 1);
        require(d.status == SlotDefinitionRegistry420.SlotStatus.APPROVED, "not approved");
        require(!s.registry.isVaultAuthorized(VAULT_ID, SLOT_ID, 1), "vault implicitly authorized");
        require(!s.registry.isPlayable(VAULT_ID, SLOT_ID, 1), "approved playable");
    }

    function testActivationDoesNotGrantVaultAuthorization() public {
        Suite memory s = _deploy();
        _register(s, SLOT_ID, 1);
        _approve(s, SLOT_ID, 1);
        _activate(s, SLOT_ID, 1);
        require(!s.registry.isPlayable(VAULT_ID, SLOT_ID, 1), "active without vault playable");
    }

    function testVaultAuthorizationAloneDoesNotMakeApprovedSlotPlayable() public {
        Suite memory s = _deploy();
        _register(s, SLOT_ID, 1);
        _approve(s, SLOT_ID, 1);
        _allowVault(s, RISK, SLOT_ID, 1, BetSlotIds420.ACTION_VAULT_AUTHORIZE);
        vm.prank(RISK);
        s.registry.authorizeSlotForVault(VAULT_ID, SLOT_ID, 1);
        require(s.registry.isVaultAuthorized(VAULT_ID, SLOT_ID, 1), "vault auth missing");
        require(!s.registry.isPlayable(VAULT_ID, SLOT_ID, 1), "approved slot playable");
    }

    function testActiveAndVaultAuthorizedIsPlayable() public {
        Suite memory s = _deploy();
        _register(s, SLOT_ID, 1);
        _approve(s, SLOT_ID, 1);
        _allowVault(s, RISK, SLOT_ID, 1, BetSlotIds420.ACTION_VAULT_AUTHORIZE);
        vm.prank(RISK);
        s.registry.authorizeSlotForVault(VAULT_ID, SLOT_ID, 1);
        _activate(s, SLOT_ID, 1);
        require(s.registry.isPlayable(VAULT_ID, SLOT_ID, 1), "not playable");
    }

    function testPauseBlocksNewPlayWithoutErasingVaultAuthorization() public {
        Suite memory s = _deploy();
        _register(s, SLOT_ID, 1);
        _approve(s, SLOT_ID, 1);
        _allowVault(s, RISK, SLOT_ID, 1, BetSlotIds420.ACTION_VAULT_AUTHORIZE);
        vm.prank(RISK);
        s.registry.authorizeSlotForVault(VAULT_ID, SLOT_ID, 1);
        _activate(s, SLOT_ID, 1);
        _allowSlot(s, CURATOR, SLOT_ID, 1, BetSlotIds420.ACTION_PAUSE);
        vm.prank(CURATOR);
        s.registry.pauseSlot(SLOT_ID, 1);
        require(!s.registry.isPlayable(VAULT_ID, SLOT_ID, 1), "paused playable");
        require(s.registry.isVaultAuthorized(VAULT_ID, SLOT_ID, 1), "pause erased vault auth");
    }

    function testResumeReusesExistingVaultAuthorization() public {
        Suite memory s = _deploy();
        _register(s, SLOT_ID, 1);
        _approve(s, SLOT_ID, 1);
        _allowVault(s, RISK, SLOT_ID, 1, BetSlotIds420.ACTION_VAULT_AUTHORIZE);
        vm.prank(RISK);
        s.registry.authorizeSlotForVault(VAULT_ID, SLOT_ID, 1);
        _activate(s, SLOT_ID, 1);
        _allowSlot(s, CURATOR, SLOT_ID, 1, BetSlotIds420.ACTION_PAUSE);
        vm.prank(CURATOR);
        s.registry.pauseSlot(SLOT_ID, 1);
        vm.prank(CURATOR);
        s.registry.activateSlot(SLOT_ID, 1);
        require(s.registry.isPlayable(VAULT_ID, SLOT_ID, 1), "resume not playable");
    }

    function testVaultRevocationBlocksPlayWithoutChangingGlobalStatus() public {
        Suite memory s = _deploy();
        _register(s, SLOT_ID, 1);
        _approve(s, SLOT_ID, 1);
        _allowVault(s, RISK, SLOT_ID, 1, BetSlotIds420.ACTION_VAULT_AUTHORIZE);
        vm.prank(RISK);
        s.registry.authorizeSlotForVault(VAULT_ID, SLOT_ID, 1);
        _activate(s, SLOT_ID, 1);
        _allowVault(s, RISK, SLOT_ID, 1, BetSlotIds420.ACTION_VAULT_REVOKE);
        vm.prank(RISK);
        s.registry.revokeSlotForVault(VAULT_ID, SLOT_ID, 1);
        SlotDefinitionRegistry420.SlotDefinition memory d = s.registry.getSlot(SLOT_ID, 1);
        require(d.status == SlotDefinitionRegistry420.SlotStatus.ACTIVE, "global status changed");
        require(!s.registry.isPlayable(VAULT_ID, SLOT_ID, 1), "revoked slot playable");
    }

    function testDeprecatedSlotCannotReactivate() public {
        Suite memory s = _deploy();
        _register(s, SLOT_ID, 1);
        _approve(s, SLOT_ID, 1);
        _activate(s, SLOT_ID, 1);
        _allowSlot(s, CURATOR, SLOT_ID, 1, BetSlotIds420.ACTION_DEPRECATE);
        vm.prank(CURATOR);
        s.registry.deprecateSlot(SLOT_ID, 1);
        vm.prank(CURATOR);
        vm.expectRevert(SlotDefinitionRegistry420.InvalidStateTransition.selector);
        s.registry.activateSlot(SLOT_ID, 1);
    }

    function testDuplicateSlotVersionCannotRebindDefinition() public {
        Suite memory s = _deploy();
        _register(s, SLOT_ID, 1);
        vm.prank(CURATOR);
        vm.expectRevert(SlotDefinitionRegistry420.SlotAlreadyRegistered.selector);
        s.registry.registerSlot(SLOT_ID, 1, 1, keccak256("different"), CODE, REELS, PAYTABLE, RTP, LIABILITY, 99_999e18);
        SlotDefinitionRegistry420.SlotDefinition memory d = s.registry.getSlot(SLOT_ID, 1);
        require(d.manifestHash == MANIFEST, "manifest rebound");
        require(d.maxMultiplier == 10_000e18, "max multiplier rebound");
    }

    function testVersionAuthorizationIsIsolated() public {
        Suite memory s = _deploy();
        _register(s, SLOT_ID, 1);
        _approve(s, SLOT_ID, 1);
        _activate(s, SLOT_ID, 1);
        _allowVault(s, RISK, SLOT_ID, 1, BetSlotIds420.ACTION_VAULT_AUTHORIZE);
        vm.prank(RISK);
        s.registry.authorizeSlotForVault(VAULT_ID, SLOT_ID, 1);

        _register(s, SLOT_ID, 2);
        _approve(s, SLOT_ID, 2);
        _activate(s, SLOT_ID, 2);

        require(s.registry.isPlayable(VAULT_ID, SLOT_ID, 1), "v1 not playable");
        require(!s.registry.isPlayable(VAULT_ID, SLOT_ID, 2), "v2 inherited vault auth");
    }

    function testDifferentSlotCannotReuseSlotCapability() public {
        Suite memory s = _deploy();
        _allowSlot(s, CURATOR, SLOT_ID, 1, BetSlotIds420.ACTION_REGISTER);
        vm.prank(CURATOR);
        vm.expectRevert(SlotDefinitionRegistry420.Unauthorized.selector);
        s.registry.registerSlot(SECOND_SLOT_ID, 1, 1, MANIFEST, CODE, REELS, PAYTABLE, RTP, LIABILITY, 10_000e18);
    }

    function testInvalidLifecycleSkipsAreRejected() public {
        Suite memory s = _deploy();
        _register(s, SLOT_ID, 1);
        _allowSlot(s, CURATOR, SLOT_ID, 1, BetSlotIds420.ACTION_ACTIVATE);
        vm.prank(CURATOR);
        vm.expectRevert(SlotDefinitionRegistry420.InvalidStateTransition.selector);
        s.registry.activateSlot(SLOT_ID, 1);
    }
}