// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/vault/VaultIds420.sol";
import "../src/vault/VaultAuthorization420.sol";
import "../src/vault/VaultPolicyRegistry420.sol";
import "../src/vault/VaultRegistry420.sol";
import "../src/vault/VaultAccounting420.sol";
import "../src/vault/AssetVault420.sol";
import "../src/vault/VaultRouter420.sol";

interface VmVault420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
    function deal(address, uint256) external;
}

contract MockCapabilityRegistryVault420 is ICapabilityRegistry420 {
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

contract MockExactTokenVault420 {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract MockFeeTokenVault420 {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount - (amount / 10);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount - (amount / 10);
        return true;
    }
}

contract Vault420Test {
    VmVault420 constant vm = VmVault420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    address constant EVE = address(0xE7E);

    bytes32 constant VAULT_ID = keccak256("vault/alice/1");
    bytes32 constant SECOND_VAULT_ID = keccak256("vault/alice/2");
    bytes32 constant AUTH_POLICY = keccak256("vault/policy/auth");
    bytes32 constant ASSET_POLICY = keccak256("vault/policy/asset");
    bytes32 constant RELEASE_POLICY = keccak256("vault/policy/release");
    bytes32 constant ACCOUNTING_POLICY = keccak256("vault/policy/accounting");

    struct Suite {
        MockCapabilityRegistryVault420 caps;
        VaultAuthorization420 auth;
        VaultPolicyRegistry420 policies;
        VaultRegistry420 registry;
        VaultAccounting420 accounting;
        AssetVault420 vault;
        VaultRouter420 router;
    }

    function _deploy() private returns (Suite memory s) {
        s.caps = new MockCapabilityRegistryVault420();
        s.auth = new VaultAuthorization420(address(s.caps));
        s.policies = new VaultPolicyRegistry420(address(this));
        s.registry = new VaultRegistry420(address(s.auth), address(s.policies));
        s.accounting = new VaultAccounting420(address(s.registry));

        s.policies.setPolicy(AUTH_POLICY, VaultIds420.POLICY_AUTHORIZATION, keccak256("auth-v1"), bytes32(0), true);
        s.policies.setPolicy(ASSET_POLICY, VaultIds420.POLICY_ASSET, keccak256("asset-v1"), bytes32(0), true);
        s.policies.setPolicy(RELEASE_POLICY, VaultIds420.POLICY_RELEASE, keccak256("release-v1"), bytes32(0), true);
        s.policies.setPolicy(ACCOUNTING_POLICY, VaultIds420.POLICY_ACCOUNTING, keccak256("accounting-v1"), bytes32(0), true);

        s.vault = new AssetVault420(VAULT_ID, address(s.registry), address(s.auth), address(s.accounting), ALICE);
        vm.prank(ALICE);
        s.registry.registerVault(
            VAULT_ID,
            address(s.vault),
            VaultIds420.VAULT_PERSONAL,
            AUTH_POLICY,
            ASSET_POLICY,
            RELEASE_POLICY,
            ACCOUNTING_POLICY,
            bytes32(0),
            bytes32(0),
            bytes32(0)
        );
        s.router = new VaultRouter420(address(s.registry), address(s.accounting), address(s.auth));
    }

    function _allow(Suite memory s, address who, bytes32 actionId) private {
        s.caps.setAllowed(who, VaultIds420.COMPONENT_VAULT, actionId, s.auth.scopeForVault(VAULT_ID), true);
    }

    function _deposit(Suite memory s, uint256 amount) private {
        vm.deal(ALICE, amount);
        vm.prank(ALICE);
        s.vault.depositNative{value: amount}();
    }

    function _beginWindDown(Suite memory s) private {
        _allow(s, ALICE, VaultIds420.ACTION_BEGIN_WIND_DOWN);
        vm.prank(ALICE);
        s.registry.setState(VAULT_ID, VaultRegistry420.VaultState.WINDING_DOWN);
    }

    function testCreatorHasNoImplicitWithdrawalAuthority() public {
        Suite memory s = _deploy();
        _deposit(s, 10 ether);
        vm.prank(ALICE);
        vm.expectRevert(AssetVault420.Unauthorized.selector);
        s.vault.withdraw(keccak256("op1"), address(0), ALICE, 1 ether);
    }

    function testAuthorizedWithdrawalUsesFreeBalance() public {
        Suite memory s = _deploy();
        _deposit(s, 10 ether);
        _allow(s, ALICE, VaultIds420.ACTION_WITHDRAW);
        vm.prank(ALICE);
        s.vault.withdraw(keccak256("op1"), address(0), ALICE, 2 ether);
        VaultAccounting420.AssetAccounting memory a = s.accounting.getAccounting(VAULT_ID, address(0));
        require(a.recordedBalance == 8 ether, "balance");
    }

    function testObligationProtectsEncumberedBalance() public {
        Suite memory s = _deploy();
        _deposit(s, 10 ether);
        _allow(s, ALICE, VaultIds420.ACTION_CREATE_OBLIGATION);
        _allow(s, ALICE, VaultIds420.ACTION_WITHDRAW);
        vm.prank(ALICE);
        s.vault.createObligation(keccak256("op-ob"), keccak256("ob1"), address(0), BOB, 7 ether, keccak256("BENEFICIARY"), bytes32(0));
        require(s.accounting.freeBalance(VAULT_ID, address(0)) == 3 ether, "free");
        vm.prank(ALICE);
        vm.expectRevert(VaultAccounting420.InsufficientFreeBalance.selector);
        s.vault.withdraw(keccak256("op2"), address(0), ALICE, 4 ether);
    }

    function testReservedObligationCanBeCancelledAndFreesBalance() public {
        Suite memory s = _deploy();
        _deposit(s, 5 ether);
        _allow(s, ALICE, VaultIds420.ACTION_CREATE_OBLIGATION);
        _allow(s, ALICE, VaultIds420.ACTION_CANCEL_OBLIGATION);
        bytes32 obligationId = keccak256("cancel-ob");
        vm.prank(ALICE);
        s.vault.createObligation(keccak256("create-cancel"), obligationId, address(0), BOB, 2 ether, keccak256("ESCROW"), bytes32(0));
        vm.prank(ALICE);
        s.vault.cancelObligation(keccak256("cancel"), obligationId);
        require(s.accounting.freeBalance(VAULT_ID, address(0)) == 5 ether, "cancel did not free");
        require(s.accounting.openObligationCount(VAULT_ID) == 0, "open obligation survived");
    }

    function testReleasedBeneficiaryCanClaimWithoutAdminRedirect() public {
        Suite memory s = _deploy();
        _deposit(s, 5 ether);
        _allow(s, ALICE, VaultIds420.ACTION_CREATE_OBLIGATION);
        _allow(s, ALICE, VaultIds420.ACTION_RELEASE_OBLIGATION);
        bytes32 ob = keccak256("ob");
        vm.prank(ALICE);
        s.vault.createObligation(keccak256("create"), ob, address(0), BOB, 2 ether, keccak256("BENEFICIARY"), bytes32(0));
        vm.prank(ALICE);
        s.vault.releaseObligation(keccak256("release"), ob);
        uint256 beforeBal = BOB.balance;
        vm.prank(BOB);
        s.vault.claim(keccak256("claim"), ob);
        require(BOB.balance == beforeBal + 2 ether, "claim");
    }

    function testUnauthorizedClaimDoesNotChangeClaimState() public {
        Suite memory s = _deploy();
        _deposit(s, 5 ether);
        _allow(s, ALICE, VaultIds420.ACTION_CREATE_OBLIGATION);
        _allow(s, ALICE, VaultIds420.ACTION_RELEASE_OBLIGATION);
        bytes32 ob = keccak256("auth-order-ob");
        vm.prank(ALICE);
        s.vault.createObligation(keccak256("create-auth"), ob, address(0), BOB, 2 ether, keccak256("BENEFICIARY"), bytes32(0));
        vm.prank(ALICE);
        s.vault.releaseObligation(keccak256("release-auth"), ob);
        vm.prank(EVE);
        vm.expectRevert(AssetVault420.Unauthorized.selector);
        s.vault.claim(keccak256("bad-claim"), ob);
        VaultAccounting420.Obligation memory obligation = s.accounting.getObligation(ob);
        require(obligation.state == 2, "claim state mutated");
    }

    function testClaimRemainsAvailableWhileFrozen() public {
        Suite memory s = _deploy();
        _deposit(s, 5 ether);
        _allow(s, ALICE, VaultIds420.ACTION_CREATE_OBLIGATION);
        _allow(s, ALICE, VaultIds420.ACTION_RELEASE_OBLIGATION);
        _allow(s, ALICE, VaultIds420.ACTION_FREEZE);
        bytes32 ob = keccak256("frozen-claim");
        vm.prank(ALICE);
        s.vault.createObligation(keccak256("create-frozen"), ob, address(0), BOB, 1 ether, keccak256("BENEFICIARY"), bytes32(0));
        vm.prank(ALICE);
        s.vault.releaseObligation(keccak256("release-frozen"), ob);
        vm.prank(ALICE);
        s.registry.setState(VAULT_ID, VaultRegistry420.VaultState.FROZEN);
        uint256 beforeBal = BOB.balance;
        vm.prank(BOB);
        s.vault.claim(keccak256("claim-frozen"), ob);
        require(BOB.balance == beforeBal + 1 ether, "frozen claim blocked");
    }

    function testFrozenVaultRejectsNewDeposits() public {
        Suite memory s = _deploy();
        _allow(s, ALICE, VaultIds420.ACTION_FREEZE);
        vm.prank(ALICE);
        s.registry.setState(VAULT_ID, VaultRegistry420.VaultState.FROZEN);
        vm.deal(ALICE, 1 ether);
        vm.prank(ALICE);
        vm.expectRevert(AssetVault420.InvalidState.selector);
        s.vault.depositNative{value: 1 ether}();
    }

    function testWindDownCannotEscapeThroughFreeze() public {
        Suite memory s = _deploy();
        _beginWindDown(s);
        _allow(s, ALICE, VaultIds420.ACTION_FREEZE);
        vm.prank(ALICE);
        vm.expectRevert(VaultRegistry420.InvalidStateTransition.selector);
        s.registry.setState(VAULT_ID, VaultRegistry420.VaultState.FROZEN);
    }

    function testCloseRejectedWhileCanonicalBalanceRemains() public {
        Suite memory s = _deploy();
        _deposit(s, 1 ether);
        _beginWindDown(s);
        _allow(s, ALICE, VaultIds420.ACTION_CLOSE);
        vm.prank(ALICE);
        vm.expectRevert(VaultRegistry420.OutstandingAssetsOrObligations.selector);
        s.registry.setState(VAULT_ID, VaultRegistry420.VaultState.CLOSED);
    }

    function testCloseRejectedWhileObligationRemains() public {
        Suite memory s = _deploy();
        _deposit(s, 2 ether);
        _allow(s, ALICE, VaultIds420.ACTION_CREATE_OBLIGATION);
        vm.prank(ALICE);
        s.vault.createObligation(keccak256("close-create"), keccak256("close-ob"), address(0), BOB, 1 ether, keccak256("ESCROW"), bytes32(0));
        _beginWindDown(s);
        _allow(s, ALICE, VaultIds420.ACTION_CLOSE);
        vm.prank(ALICE);
        vm.expectRevert(VaultRegistry420.OutstandingAssetsOrObligations.selector);
        s.registry.setState(VAULT_ID, VaultRegistry420.VaultState.CLOSED);
    }

    function testClosedVaultCannotReactivate() public {
        Suite memory s = _deploy();
        _beginWindDown(s);
        _allow(s, ALICE, VaultIds420.ACTION_CLOSE);
        _allow(s, ALICE, VaultIds420.ACTION_UNFREEZE);
        vm.prank(ALICE);
        s.registry.setState(VAULT_ID, VaultRegistry420.VaultState.CLOSED);
        vm.prank(ALICE);
        vm.expectRevert(VaultRegistry420.InvalidStateTransition.selector);
        s.registry.setState(VAULT_ID, VaultRegistry420.VaultState.ACTIVE);
    }

    function testOperationReplayRejected() public {
        Suite memory s = _deploy();
        _deposit(s, 3 ether);
        _allow(s, ALICE, VaultIds420.ACTION_WITHDRAW);
        bytes32 op = keccak256("same");
        vm.prank(ALICE);
        s.vault.withdraw(op, address(0), ALICE, 1 ether);
        vm.prank(ALICE);
        vm.expectRevert(AssetVault420.Replay.selector);
        s.vault.withdraw(op, address(0), ALICE, 1 ether);
    }

    function testRegistrationRequiresIntendedCreator() public {
        Suite memory s = _deploy();
        AssetVault420 second = new AssetVault420(SECOND_VAULT_ID, address(s.registry), address(s.auth), address(s.accounting), ALICE);
        vm.prank(EVE);
        vm.expectRevert(VaultRegistry420.InvalidVaultRegistration.selector);
        s.registry.registerVault(
            SECOND_VAULT_ID,
            address(second),
            VaultIds420.VAULT_PERSONAL,
            AUTH_POLICY,
            ASSET_POLICY,
            RELEASE_POLICY,
            ACCOUNTING_POLICY,
            bytes32(0),
            bytes32(0),
            bytes32(0)
        );
    }

    function testRegistrationRejectsWrongPolicyClass() public {
        Suite memory s = _deploy();
        AssetVault420 second = new AssetVault420(SECOND_VAULT_ID, address(s.registry), address(s.auth), address(s.accounting), ALICE);
        vm.prank(ALICE);
        vm.expectRevert(VaultRegistry420.InvalidPolicy.selector);
        s.registry.registerVault(
            SECOND_VAULT_ID,
            address(second),
            VaultIds420.VAULT_PERSONAL,
            ASSET_POLICY,
            AUTH_POLICY,
            RELEASE_POLICY,
            ACCOUNTING_POLICY,
            bytes32(0),
            bytes32(0),
            bytes32(0)
        );
    }

    function testExactTokenDepositUsesActualBalanceDelta() public {
        Suite memory s = _deploy();
        MockExactTokenVault420 token = new MockExactTokenVault420();
        token.mint(ALICE, 100 ether);
        vm.prank(ALICE);
        s.vault.depositToken(address(token), 25 ether);
        VaultAccounting420.AssetAccounting memory a = s.accounting.getAccounting(VAULT_ID, address(token));
        require(a.recordedBalance == 25 ether, "token accounting");
        require(token.balanceOf(address(s.vault)) == 25 ether, "token custody");
    }

    function testFeeOnTransferDepositRejected() public {
        Suite memory s = _deploy();
        MockFeeTokenVault420 token = new MockFeeTokenVault420();
        token.mint(ALICE, 100 ether);
        vm.prank(ALICE);
        vm.expectRevert(AssetVault420.UnexpectedTokenDelta.selector);
        s.vault.depositToken(address(token), 10 ether);
        require(token.balanceOf(address(s.vault)) == 0, "fee token transfer not reverted");
    }

    function testRouterReadsAccounting() public {
        Suite memory s = _deploy();
        _deposit(s, 4 ether);
        IVault420.AssetAccountingRead memory a = s.router.readAccounting(VAULT_ID, address(0));
        require(a.recordedBalance == 4 ether && a.freeBalance == 4 ether, "router accounting");
    }
}
