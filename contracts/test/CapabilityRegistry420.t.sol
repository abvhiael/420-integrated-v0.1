// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/system/CapabilityRegistry420.sol";
import "../src/accounts/SmartAccount420.sol";

interface VmCapability420 {
    function prank(address msgSender) external;
    function warp(uint256 newTimestamp) external;
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
}

contract CapabilityEntryPoint420 {
    function getNonce(address, uint192) external pure returns (uint256) { return 0; }
    function validate(SmartAccount420 account, PackedUserOperation420 calldata op, bytes32 hash) external returns (uint256) {
        return account.validateUserOp(op, hash, 0);
    }
}
contract CapabilityTarget420 { function act() external payable {} }

contract CapabilityRegistry420Test {
    VmCapability420 internal constant vm = VmCapability420(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 internal constant SESSION_PK = 0x2420;

    CapabilityRegistry420 internal registry;
    CapabilityEntryPoint420 internal entryPoint;
    CapabilityTarget420 internal target;
    SmartAccount420 internal account;
    address internal session;

    constructor() {
        registry = new CapabilityRegistry420();
        entryPoint = new CapabilityEntryPoint420();
        target = new CapabilityTarget420();
        session = vm.addr(SESSION_PK);
        account = new SmartAccount420(address(entryPoint), address(registry), address(this), address(0));
        account.enableSessionKey(session);
    }

    function testAccountOwnsOnlyItsDeterministicCapabilityComponent() public view {
        require(registry.componentAuthority(account.accountComponentId()) == address(account), "account authority");
        require(registry.smartAccountComponentId(address(account)) == account.accountComponentId(), "component derivation");
    }

    function testNewGrantForSameAuthorizationRevokesPreviousGrant() public {
        bytes32 first = account.createSessionGrant(session, address(target), CapabilityTarget420.act.selector, 1 ether, 2 ether, 1 days, 0, 0);
        bytes32 second = account.createSessionGrant(session, address(target), CapabilityTarget420.act.selector, 0.5 ether, 1 ether, 1 days, 0, 0);
        ICapabilityRegistry420.CapabilityGrant memory g1 = registry.grant(first);
        ICapabilityRegistry420.CapabilityGrant memory g2 = registry.grant(second);
        require(g1.revoked, "old grant revoked");
        require(!g2.revoked, "new grant active");
        require(
            registry.activeGrantId(session, account.accountComponentId(), g2.capabilityId, account.sessionScope(address(target), CapabilityTarget420.act.selector)) == second,
            "active grant"
        );
    }

    function testUnauthorizedAddressCannotCreateGrantForAccountComponent() public {
        bytes32 fake = keccak256("fake-grant");
        vm.prank(address(0xBAD));
        (bool ok,) = address(registry).call(abi.encodeWithSelector(
            CapabilityRegistry420.createGrant.selector,
            fake,
            session,
            account.accountComponentId(),
            keccak256("420/APP/CAP/SESSION_EXECUTE"),
            keccak256("fake-scope"),
            0, 0, 0, 0, 0
        ));
        require(!ok, "forged grant");
    }

    function testRevocationFailsClosed() public {
        bytes32 grantId = account.createSessionGrant(session, address(target), CapabilityTarget420.act.selector, 1 ether, 1 ether, 1 days, 0, 0);
        account.revokeCapabilityGrant(grantId);
        ICapabilityRegistry420.CapabilityGrant memory g = registry.grant(grantId);
        require(g.revoked, "revoked");
        require(!registry.isAuthorized(session, account.accountComponentId(), g.capabilityId, g.scopeHash, 1), "must fail closed");
    }

    function testPeriodUsageResetsAtNextWindow() public {
        bytes32 grantId = account.createSessionGrant(session, address(target), CapabilityTarget420.act.selector, 1 ether, 1 ether, 1 days, 0, 0);
        bytes32 hash = keccak256("period-one");
        require(entryPoint.validate(account, _op(0.75 ether, hash), hash) == 0, "first period");
        ICapabilityRegistryExtended420.UsageView memory first = registry.usage(grantId);
        require(first.used == 0.75 ether, "usage first");
        vm.warp(block.timestamp + 1 days);
        ICapabilityRegistryExtended420.UsageView memory rolled = registry.usage(grantId);
        require(rolled.used == 0, "rolled usage");
    }

    function testEpochRotationMakesOldRegistryGrantUnreachable() public {
        bytes32 oldGrant = account.createSessionGrant(session, address(target), CapabilityTarget420.act.selector, 1 ether, 1 ether, 1 days, 0, 0);
        ICapabilityRegistry420.CapabilityGrant memory g = registry.grant(oldGrant);
        bytes32 oldScope = g.scopeHash;
        account.revokeAllAuthorizations();
        account.enableSessionKey(session);
        bytes32 newScope = account.sessionScope(address(target), CapabilityTarget420.act.selector);
        require(newScope != oldScope, "epoch scoped");
        bytes32 hash = keccak256("old-grant-after-epoch");
        require(entryPoint.validate(account, _op(0.1 ether, hash), hash) == 1, "old grant unreachable");
    }

    function _op(uint256 amount, bytes32 hash) internal returns (PackedUserOperation420 memory) {
        bytes memory callData = abi.encodeWithSelector(SmartAccount420.execute.selector, address(target), amount, abi.encodeWithSelector(CapabilityTarget420.act.selector));
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SESSION_PK, digest);
        return PackedUserOperation420({
            sender: address(account), nonce: uint256(uint192(uint160(session))) << 64, initCode: bytes(""), callData: callData,
            accountGasLimits: bytes32(0), preVerificationGas: 0, gasFees: bytes32(0), paymasterAndData: bytes(""), signature: abi.encodePacked(r, s, v)
        });
    }
}
