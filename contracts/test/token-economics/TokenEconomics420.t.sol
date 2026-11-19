// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../../src/token/TokenFactory420.sol";
import "../../src/system/CapabilityRegistry420.sol";
import "../../src/vault/AssetVault420.sol";
import "../../src/revenue/DevelopmentCompensationVault420.sol";

interface VmTokenEconomics420 {
    struct Log {
        bytes32[] topics;
        bytes data;
        address emitter;
    }

    function deal(
        address who,
        uint256 amount
    ) external;
    function prank(
        address who
    ) external;
    function expectRevert(
        bytes4 selector
    ) external;
    function recordLogs() external;
    function getRecordedLogs() external returns (Log[] memory);
    function snapshotState() external returns (uint256);
    function revertToState(
        uint256 snapshot
    ) external returns (bool);
}

contract HostileTokenFeeVault420 {
    bytes32 public constant vaultId = TokenIds420.COMMUNITY_TOKEN_REVENUE_VAULT;
    TokenFactory420 public factory;
    uint256 public recorded;
    uint256 public attempts;
    bool public rejectAfterCallbacks;

    error IntentionalFailure();

    function configure(
        TokenFactory420 factory_,
        bool reject_
    ) external {
        factory = factory_;
        rejectAfterCallbacks = reject_;
    }

    function depositNative() external payable {
        require(msg.sender == address(factory), "unexpected depositor");
        recorded += msg.value;
        _attempt(
            abi.encodeCall(
                factory.createERC20, (TokenIds420.ERC20_FIXED, "Nested", "NEST", 1, 0, bytes32("nested20"))
            )
        );
        _attempt(abi.encodeCall(factory.createERC721, ("Nested", "NEST", "ipfs://nft", bytes32("nested721"))));
        _attempt(abi.encodeCall(factory.createERC1155, ("ipfs://{id}", bytes32("nested1155"))));
        if (rejectAfterCallbacks) revert IntentionalFailure();
    }

    function _attempt(
        bytes memory data
    ) private {
        (bool ok, bytes memory reason) = address(factory).call{ value: 42 ether }(data);
        require(!ok && reason.length == 4 && bytes4(reason) == TokenFactory420.Reentrancy.selector, "nested create");
        ++attempts;
    }
}

contract TokenEconomics420Test {
    VmTokenEconomics420 constant vm = VmTokenEconomics420(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 constant FEE = 42 ether;
    uint256 constant START = 1000 ether;
    address constant ALICE = address(0xA11CE);
    address constant ATTACKER = address(0xBAD);
    address constant BENEFICIARY = address(0xB0B);
    bytes32 constant ID = TokenIds420.COMMUNITY_TOKEN_REVENUE_VAULT;
    bytes32 constant OTHER_ID = keccak256("unrelated-vault");
    bytes32 constant AUTH = keccak256("token-economics/auth");
    bytes32 constant ASSET = keccak256("token-economics/asset");
    bytes32 constant RELEASE = keccak256("token-economics/release");
    bytes32 constant ACCOUNTING = keccak256("token-economics/accounting");
    bytes32 constant MANIFEST = keccak256("token-economics/community-manifest");
    bytes32 constant METADATA = keccak256("token-economics/community-metadata");
    bytes32 constant TOKEN_EVENT = keccak256("TokenDeployed(address,address,bytes32,uint32,bytes32,uint256)");
    bytes32 constant FEE_EVENT = keccak256("CreationFeeDeposited(address,bytes32,uint256)");
    bytes32 constant VAULT_EVENT = keccak256("NativeDeposited(address,uint256)");
    bytes32 constant LEDGER_EVENT = keccak256("DepositRecorded(bytes32,address,uint256,uint256)");
    bytes32 constant SALT = keccak256("token-economics/creation");

    CapabilityRegistry420 caps;
    VaultAuthorization420 auth;
    VaultPolicyRegistry420 policies;
    VaultRegistry420 registry;
    VaultAccounting420 ledger;
    AssetVault420 vault;
    AssetVault420 otherVault;
    DevelopmentCompensationVault420 devComp;
    TokenTemplateRegistry420 templates;
    TokenFactory420 factory;

    function setUp() public {
        caps = new CapabilityRegistry420();
        caps.registerProtocolComponent(VaultIds420.COMPONENT_VAULT, address(this));
        auth = new VaultAuthorization420(address(caps));
        policies = new VaultPolicyRegistry420(address(this));
        registry = new VaultRegistry420(address(auth), address(policies));
        ledger = new VaultAccounting420(address(registry));
        policies.setPolicy(AUTH, VaultIds420.POLICY_AUTHORIZATION, keccak256("auth-v1"), bytes32(0), true);
        policies.setPolicy(ASSET, VaultIds420.POLICY_ASSET, keccak256("asset-v1"), bytes32(0), true);
        policies.setPolicy(RELEASE, VaultIds420.POLICY_RELEASE, keccak256("release-v1"), bytes32(0), true);
        policies.setPolicy(ACCOUNTING, VaultIds420.POLICY_ACCOUNTING, keccak256("accounting-v1"), bytes32(0), true);
        vault = new AssetVault420(ID, address(registry), address(auth), address(ledger), address(this));
        otherVault = new AssetVault420(OTHER_ID, address(registry), address(auth), address(ledger), address(this));
        _register(registry, vault, ID);
        _register(registry, otherVault, OTHER_ID);
        devComp = new DevelopmentCompensationVault420(address(caps), BENEFICIARY);
        templates = new TokenTemplateRegistry420(address(this));
        factory = new TokenFactory420(address(templates), address(vault));
        _grant(address(this), VaultIds420.ACTION_FREEZE, auth.scopeForVault(ID), 0);
        _grant(address(this), VaultIds420.ACTION_UNFREEZE, auth.scopeForVault(ID), 0);
        _grant(address(this), VaultIds420.ACTION_BEGIN_WIND_DOWN, auth.scopeForVault(ID), 0);
        _grant(address(this), VaultIds420.ACTION_CLOSE, auth.scopeForVault(ID), 0);
        vm.deal(ALICE, START);
        vm.deal(ATTACKER, 0);
        vm.deal(BENEFICIARY, 0);
    }

    function _register(
        VaultRegistry420 destinationRegistry,
        AssetVault420 destination,
        bytes32 id
    ) private {
        destinationRegistry.registerVault(
            id, address(destination), VaultIds420.VAULT_COMMUNITY, AUTH, ASSET, RELEASE, ACCOUNTING,
            bytes32(0), METADATA, MANIFEST
        );
    }

    function _grant(
        address principal,
        bytes32 action,
        bytes32 scope,
        uint256 limit
    ) private {
        caps.createGrant(
            keccak256(abi.encode(principal, action, scope)), principal, VaultIds420.COMPONENT_VAULT, action, scope,
            limit, 0, 0, 0, 0
        );
    }

    function _id(
        uint256 index
    ) private pure returns (bytes32) {
        bytes32[8] memory ids = [
            TokenIds420.ERC20_FIXED,
            TokenIds420.ERC20_MINTABLE,
            TokenIds420.ERC20_CAPPED,
            TokenIds420.ERC20_BURNABLE,
            TokenIds420.ERC20_PERMIT,
            TokenIds420.ERC20_VOTES,
            TokenIds420.ERC721_COLLECTION,
            TokenIds420.ERC1155_MULTI
        ];
        return ids[index];
    }

    function _config(
        uint256 index
    ) private pure returns (bytes32) {
        if (index == 6) return keccak256(abi.encode("Token", "TOK", "ipfs://nft"));
        if (index == 7) return keccak256(abi.encode("ipfs://{id}"));
        return keccak256(abi.encode("Token", "TOK", uint256(100 ether), index == 2 ? uint256(200 ether) : 0));
    }

    function _calldata(
        TokenFactory420 target,
        uint256 index
    ) private pure returns (bytes memory) {
        if (index == 6) return abi.encodeCall(target.createERC721, ("Token", "TOK", "ipfs://nft", SALT));
        if (index == 7) return abi.encodeCall(target.createERC1155, ("ipfs://{id}", SALT));
        return abi.encodeCall(
            target.createERC20, (_id(index), "Token", "TOK", 100 ether, index == 2 ? 200 ether : 0, SALT)
        );
    }

    function _create(
        TokenFactory420 target,
        uint256 index
    ) private returns (address token) {
        bytes memory data = _calldata(target, index);
        vm.prank(ALICE);
        (bool ok, bytes memory result) = address(target).call{ value: FEE }(data);
        require(ok, "creation failed");
        token = abi.decode(result, (address));
    }

    function _reject(
        TokenFactory420 target,
        uint256 index,
        uint256 value,
        bytes4 expected
    ) private {
        bytes memory data = _calldata(target, index);
        vm.prank(ALICE);
        (bool ok, bytes memory reason) = address(target).call{ value: value }(data);
        require(!ok && reason.length == 4 && bytes4(reason) == expected, "unexpected creation result");
    }

    function _economicState(
        uint256 count,
        uint256 preexistingUnrecorded,
        uint256 creatorStart
    ) private view {
        uint256 total = count * FEE;
        VaultAccounting420.AssetAccounting memory a = ledger.getAccounting(ID, address(0));
        require(a.recordedBalance == total && ledger.freeBalance(ID, address(0)) == total, "ledger delta");
        require(a.reserved == 0 && a.claimable == 0 && a.released == 0, "unexpected obligation or release");
        require(ledger.nonzeroAssetCount(ID) == (count == 0 ? 0 : 1), "asset count");
        require(ledger.openObligationCount(ID) == 0, "unexpected obligation count");
        require(address(vault).balance == total + preexistingUnrecorded, "native custody delta");
        require(ALICE.balance == creatorStart - total && address(factory).balance == 0, "payer or factory balance");
        require(factory.deploymentCount() == count && factory.creatorNonce(ALICE) == count, "provenance count");
        require(address(factory.communityTreasuryVault()) == address(vault), "destination changed");
        require(address(otherVault).balance == 0 && address(devComp).balance == 0, "unrelated vault funded");
        require(ledger.getAccounting(OTHER_ID, address(0)).recordedBalance == 0, "unrelated ledger funded");
        require(BENEFICIARY.balance == 0 && ATTACKER.balance == 0, "unauthorized beneficiary");
    }

    function _provenance(
        uint256 index,
        address token
    ) private view {
        TokenFactory420.Deployment memory d = factory.deployment(index);
        require(token.code.length != 0 && factory.isFactoryDeployment(token), "deployment missing");
        require(d.token == token && d.creator == ALICE && d.templateId == _id(index), "deployment identity");
        require(d.templateVersion == 1 && d.configHash == _config(index), "deployment configuration");
        if (index < 6) {
            ERC20Template420 t = ERC20Template420(token);
            require(t.owner() == ALICE && t.balanceOf(ALICE) == 100 ether, "creator rights");
            require(t.balanceOf(address(factory)) == 0 && t.templateId() == _id(index), "factory token custody");
        } else if (index == 6) {
            require(ERC721Template420(token).owner() == ALICE, "ERC721 creator");
        } else {
            require(ERC1155Template420(token).owner() == ALICE, "ERC1155 creator");
        }
    }

    function _events(
        uint256 index,
        address token,
        VmTokenEconomics420.Log[] memory logs
    ) private view {
        uint256 deployed;
        uint256 fee;
        uint256 recorded;
        uint256 native;
        for (uint256 i; i < logs.length; ++i) {
            VmTokenEconomics420.Log memory entry = logs[i];
            if (entry.emitter == address(factory) && entry.topics[0] == TOKEN_EVENT) {
                require(entry.topics.length == 4, "provenance topics");
                require(entry.topics[1] == bytes32(uint256(uint160(token))), "event token");
                require(entry.topics[2] == bytes32(uint256(uint160(ALICE))), "event creator");
                require(entry.topics[3] == _id(index), "event template");
                (uint32 version, bytes32 configHash, uint256 amount) = abi.decode(entry.data, (uint32, bytes32, uint256));
                require(version == 1 && configHash == _config(index) && amount == FEE, "event provenance");
                ++deployed;
            } else if (entry.emitter == address(factory) && entry.topics[0] == FEE_EVENT) {
                require(entry.topics.length == 3 && entry.topics[2] == ID, "fee event vault id");
                require(entry.topics[1] == bytes32(uint256(uint160(address(vault)))), "fee destination");
                require(abi.decode(entry.data, (uint256)) == FEE, "fee event value");
                ++fee;
            } else if (entry.emitter == address(ledger) && entry.topics[0] == LEDGER_EVENT) {
                require(entry.topics.length == 3 && entry.topics[1] == ID, "ledger vault id");
                require(entry.topics[2] == bytes32(0), "ledger asset");
                (uint256 amount, uint256 balance) = abi.decode(entry.data, (uint256, uint256));
                require(amount == FEE && balance == (index + 1) * FEE, "ledger event delta");
                ++recorded;
            } else if (entry.emitter == address(vault) && entry.topics[0] == VAULT_EVENT) {
                require(entry.topics.length == 2, "deposit event topics");
                require(entry.topics[1] == bytes32(uint256(uint160(address(factory)))), "deposit payer");
                require(abi.decode(entry.data, (uint256)) == FEE, "deposit event fee");
                ++native;
            }
        }
        require(deployed == 1 && fee == 1 && recorded == 1 && native == 1, "missing or duplicate economic event");
    }

    // This is a local release-admission assertion against independently established dependencies.
    // It is not an on-chain factory method or a substitute for TOKEN-AUDIT-4/8 deployment evidence.
    function verifyLocalBinding(
        TokenFactory420 candidate,
        bytes32 expectedVaultCodeHash
    ) external view {
        VaultRegistry420.Vault memory v = registry.getVault(ID);
        require(v.exists && v.state == VaultRegistry420.VaultState.ACTIVE, "inactive registration");
        require(v.vaultAddress == address(vault) && v.vaultType == VaultIds420.VAULT_COMMUNITY, "vault registration");
        require(registry.vaultIdForAddress(address(vault)) == ID && vault.vaultId() == ID, "vault identity");
        require(v.manifestHash == MANIFEST && v.metadataHash == METADATA, "vault manifest");
        require(v.authorizationPolicyId == AUTH && v.assetPolicyId == ASSET, "vault policies");
        require(v.releasePolicyId == RELEASE && v.accountingPolicyId == ACCOUNTING, "accounting policies");
        require(address(vault).codehash == expectedVaultCodeHash && address(vault).code.length != 0, "vault runtime");
        require(address(vault.registry()) == address(registry) && address(ledger.registry()) == address(registry), "registry binding");
        require(address(vault.accounting()) == address(ledger) && address(vault.authorization()) == address(auth), "vault dependencies");
        require(address(registry.authorization()) == address(auth) && address(registry.policies()) == address(policies), "registry dependencies");
        require(address(auth.capabilityRegistry()) == address(caps), "capability dependency");
        require(address(candidate.communityTreasuryVault()) == v.vaultAddress, "factory vault binding");
        require(address(candidate.templates()) == address(templates), "template binding");
    }

    function testAllEightTemplatesExactFeeLedgerProvenanceAndEvents() public {
        this.verifyLocalBinding(factory, address(vault).codehash);
        for (uint256 i; i < 8; ++i) {
            vm.recordLogs();
            address token = _create(factory, i);
            _events(i, token, vm.getRecordedLogs());
            _provenance(i, token);
            _economicState(i + 1, 0, START);
        }
    }

    function testAllEightRejectWrongFeeAndDisabledTemplate() public {
        for (uint256 i; i < 8; ++i) {
            _reject(factory, i, 0, TokenFactory420.IncorrectFee.selector);
            _reject(factory, i, FEE - 1, TokenFactory420.IncorrectFee.selector);
            _reject(factory, i, FEE + 1, TokenFactory420.IncorrectFee.selector);
            templates.setEnabled(_id(i), false);
            _reject(factory, i, FEE, TokenFactory420.TemplateDisabled.selector);
            templates.setEnabled(_id(i), true);
            _economicState(0, 0, START);
        }
    }

    function testFuzzNonExactFeeNeverChangesEconomics(
        uint8 rawTemplate,
        uint96 rawFee
    ) public {
        uint256 fee = rawFee == FEE ? FEE + 1 : uint256(rawFee);
        uint256 funds = fee + START;
        vm.deal(ALICE, funds);
        _reject(factory, rawTemplate % 8, fee, TokenFactory420.IncorrectFee.selector);
        _economicState(0, 0, funds);
    }

    function testFrozenDepositRollbackAndIdenticalCreate2RetryForEveryTemplate() public {
        for (uint256 i; i < 8; ++i) {
            // Determine the expected address for this exact creator nonce, then rewind.
            uint256 snapshot = vm.snapshotState();
            address expected = _create(factory, i);
            require(vm.revertToState(snapshot), "reference deployment snapshot");
            registry.setState(ID, VaultRegistry420.VaultState.FROZEN);
            _reject(factory, i, FEE, TokenFactory420.TreasuryDepositFailed.selector);
            require(
                expected.code.length == 0 && !factory.isFactoryDeployment(expected), "reverted creation survived"
            );
            _economicState(i, 0, START);
            registry.setState(ID, VaultRegistry420.VaultState.ACTIVE);
            address token = _create(factory, i);
            require(token == expected, "nonce or CREATE2 address changed");
            _provenance(i, token);
            _economicState(i + 1, 0, START);
        }
    }

    function testWindingDownAndClosedVaultRejectEveryTemplate() public {
        registry.setState(ID, VaultRegistry420.VaultState.WINDING_DOWN);
        for (uint256 i; i < 8; ++i) {
            _reject(factory, i, FEE, TokenFactory420.TreasuryDepositFailed.selector);
            _economicState(0, 0, START);
        }
        registry.setState(ID, VaultRegistry420.VaultState.CLOSED);
        for (uint256 i; i < 8; ++i) {
            _reject(factory, i, FEE, TokenFactory420.TreasuryDepositFailed.selector);
            _economicState(0, 0, START);
        }
    }

    function testUnregisteredSameIdAndWrongAccountingRegistryRollback() public {
        AssetVault420 unregistered = new AssetVault420(ID, address(registry), address(auth), address(ledger), address(this));
        TokenFactory420 first = new TokenFactory420(address(templates), address(unregistered));
        VaultRegistry420 foreignRegistry = new VaultRegistry420(address(auth), address(policies));
        AssetVault420 wrongAccounting =
            new AssetVault420(ID, address(foreignRegistry), address(auth), address(ledger), address(this));
        _register(foreignRegistry, wrongAccounting, ID);
        TokenFactory420 second = new TokenFactory420(address(templates), address(wrongAccounting));
        for (uint256 i; i < 8; ++i) {
            _reject(first, i, FEE, TokenFactory420.TreasuryDepositFailed.selector);
            _reject(second, i, FEE, TokenFactory420.TreasuryDepositFailed.selector);
            _economicState(0, 0, START);
        }
        require(first.deploymentCount() == 0 && first.creatorNonce(ALICE) == 0, "unregistered provenance");
        require(second.deploymentCount() == 0 && second.creatorNonce(ALICE) == 0, "wrong-accounting provenance");
        require(address(first).balance == 0 && address(second).balance == 0, "stranded factory funds");
        require(address(unregistered).balance == 0 && address(wrongAccounting).balance == 0, "failed vault funds");
    }

    function testWrongVaultIdAndDevCompRejectedAndSameIdSpoofNotAdmitted() public {
        vm.expectRevert(TokenFactory420.InvalidTreasuryVault.selector);
        new TokenFactory420(address(templates), address(otherVault));
        vm.expectRevert(DevelopmentCompensationVault420.DirectDepositDisabled.selector);
        new TokenFactory420(address(templates), address(devComp));
        HostileTokenFeeVault420 spoof = new HostileTokenFeeVault420();
        TokenFactory420 candidate = new TokenFactory420(address(templates), address(spoof));
        (bool ok,) = address(this).staticcall(abi.encodeCall(this.verifyLocalBinding, (candidate, address(vault).codehash)));
        require(!ok, "same-id spoof admitted");
        (ok,) = address(this).staticcall(abi.encodeCall(this.verifyLocalBinding, (factory, bytes32(uint256(1)))));
        require(!ok, "wrong code hash admitted");
        this.verifyLocalBinding(factory, address(vault).codehash);
        _economicState(0, 0, START);
    }

    function testUnauthorizedLedgerWithdrawalAndFeeRedirection() public {
        _create(factory, 0);
        vm.prank(ATTACKER);
        vm.expectRevert(VaultAccounting420.UnauthorizedVault.selector);
        ledger.recordDeposit(ID, address(0), FEE);
        vm.prank(ATTACKER);
        vm.expectRevert(VaultAccounting420.UnauthorizedVault.selector);
        ledger.recordWithdrawal(ID, address(0), 1);
        vm.prank(ATTACKER);
        vm.expectRevert(AssetVault420.Unauthorized.selector);
        vault.withdraw(bytes32("steal"), address(0), ATTACKER, FEE);
        vm.prank(ATTACKER);
        vm.expectRevert(VaultRegistry420.Unauthorized.selector);
        registry.setState(ID, VaultRegistry420.VaultState.FROZEN);
        // Even a real self-withdrawal capability does not permit a third-party destination.
        _grant(ALICE, VaultIds420.ACTION_WITHDRAW, auth.scopeForVault(ID), FEE);
        vm.prank(ALICE);
        vm.expectRevert(AssetVault420.Unauthorized.selector);
        vault.withdraw(bytes32("redirect"), address(0), ATTACKER, 1);
        vm.prank(ALICE);
        (bool ok,) = address(factory).call(abi.encodeWithSignature("setCommunityTreasuryVault(address)", address(otherVault)));
        require(!ok, "factory fee destination mutable");
        require(!vault.executedOperation(bytes32("steal")) && !vault.executedOperation(bytes32("redirect")), "failed operation consumed");
        _economicState(1, 0, START);
        // An expressly granted, recipient-bound use is permitted; subsequent creations still pay the original vault.
        bytes32 scope = auth.scopeForRoute(ID, address(0), BENEFICIARY, VaultIds420.ACTION_WITHDRAW);
        _grant(ALICE, VaultIds420.ACTION_WITHDRAW, scope, 1);
        vm.prank(ALICE);
        vault.withdraw(bytes32("authorized"), address(0), BENEFICIARY, 1);
        _create(factory, 1);
        VaultAccounting420.AssetAccounting memory a = ledger.getAccounting(ID, address(0));
        require(a.recordedBalance == 2 * FEE - 1 && a.released == 1, "authorized release and new fee ledger");
        require(address(vault).balance == 2 * FEE - 1 && BENEFICIARY.balance == 1, "authorized recipient");
        require(factory.deploymentCount() == 2 && factory.creatorNonce(ALICE) == 2, "provenance after withdrawal");
        require(ALICE.balance == START - 2 * FEE && address(factory).balance == 0, "payer reconciliation");
    }

    function testUnrecordedNativeBalanceDoesNotCreateAccountingCredit() public {
        // A balance-only credit models an EVM forced transfer, not a normal payable deposit.
        vm.deal(address(vault), 3 ether);
        _economicState(0, 3 ether, START);
        for (uint256 i; i < 8; ++i) {
            _create(factory, i);
            _economicState(i + 1, 3 ether, START);
        }
    }

    function testHostileVaultReentryRejectedAcrossAllCreatePathsAndAtomicRollback() public {
        HostileTokenFeeVault420 hostile = new HostileTokenFeeVault420();
        TokenFactory420 candidate = new TokenFactory420(address(templates), address(hostile));
        hostile.configure(candidate, true);
        for (uint256 i; i < 8; ++i) {
            _reject(candidate, i, FEE, TokenFactory420.TreasuryDepositFailed.selector);
            require(hostile.recorded() == 0 && hostile.attempts() == 0, "callback state survived revert");
            require(address(hostile).balance == 0 && address(candidate).balance == 0, "callback value survived revert");
            require(candidate.deploymentCount() == 0 && candidate.creatorNonce(ALICE) == 0, "outer provenance survived");
            require(candidate.creatorNonce(address(hostile)) == 0 && ALICE.balance == START, "nested state survived");
        }
        hostile.configure(candidate, false);
        for (uint256 i; i < 8; ++i) {
            address token = _create(candidate, i);
            require(candidate.isFactoryDeployment(token) && candidate.deploymentCount() == i + 1, "outer creation");
            require(candidate.creatorNonce(ALICE) == i + 1 && candidate.creatorNonce(address(hostile)) == 0, "nested nonce");
            require(hostile.attempts() == (i + 1) * 3 && hostile.recorded() == (i + 1) * FEE, "nested reentry");
            require(address(hostile).balance == (i + 1) * FEE && address(candidate).balance == 0, "callback fee");
        }
        require(ledger.getAccounting(ID, address(0)).recordedBalance == 0, "mock treated as real accounting");
        require(ALICE.balance == START - 8 * FEE, "hostile fixture payer");
    }
}
