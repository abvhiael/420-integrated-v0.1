// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/accounts/EntryPoint420.sol";
import "../src/accounts/SmartAccount420.sol";
import "../src/accounts/SmartAccountFactory420.sol";
import "../src/system/CapabilityRegistry420.sol";
import "../src/apps/Names420.sol";
import "../src/apps/Identity420.sol";
import "../src/apps/ProtocolRegistry.sol";

interface VmWalletBoundary420 {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8, bytes32, bytes32);
    function prank(address caller) external;
    function warp(uint256 timestamp) external;
    function chainId(uint256 newChainId) external;
}

contract WalletBoundaryTarget420 {
    uint256 public stored;
    function set(uint256 newValue) external { stored = newValue; }
}

contract WalletAuthorizationBoundaries420Test {
    VmWalletBoundary420 internal constant vm =
        VmWalletBoundary420(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 internal constant OWNER_PK = 0xA420A;
    uint256 internal constant SESSION_PK = 0xB420B;
    address internal constant ATTACKER = address(0xBADD1E);
    address internal constant RECOVERY = address(0x420F00);

    EntryPoint420 internal entryPoint;
    CapabilityRegistry420 internal capabilities;
    SmartAccountFactory420 internal factory;
    WalletBoundaryTarget420 internal target;
    SmartAccount420 internal a;
    SmartAccount420 internal b;
    address internal owner;
    address internal session;

    function setUp() public {
        vm.chainId(420);
        vm.warp(100_000);
        owner = vm.addr(OWNER_PK);
        session = vm.addr(SESSION_PK);
        entryPoint = new EntryPoint420();
        capabilities = new CapabilityRegistry420();
        factory = new SmartAccountFactory420(address(entryPoint), address(capabilities));
        target = new WalletBoundaryTarget420();
        a = factory.createAccount(owner, RECOVERY, keccak256("account-a"));
        b = factory.createAccount(owner, RECOVERY, keccak256("account-b"));
    }

    function testFactoryBindsOwnerRecoveryAndSaltAndRegistryAuthority() public {
        bytes32 salt = keccak256("account-a");
        require(factory.getAddress(owner, RECOVERY, salt) == address(a), "prediction mismatch");
        require(address(factory.createAccount(owner, RECOVERY, salt)) == address(a), "non-idempotent deployment");
        require(factory.getAddress(owner, ATTACKER, salt) != address(a), "recovery binding missing");
        require(factory.getAddress(ATTACKER, RECOVERY, salt) != address(a), "owner binding missing");
        require(factory.getAddress(owner, RECOVERY, keccak256("different")) != address(a), "salt binding missing");
        require(capabilities.componentAuthority(a.accountComponentId()) == address(a), "account A authority");
        require(capabilities.componentAuthority(b.accountComponentId()) == address(b), "account B authority");
        require(a.accountComponentId() != b.accountComponentId(), "component collision");
    }

    function testNonOwnerCannotExecuteOrManageGrantsOrRecovery() public {
        bytes memory data = abi.encodeWithSelector(WalletBoundaryTarget420.set.selector, 1);
        vm.prank(ATTACKER);
        (bool ok,) = address(a).call(abi.encodeWithSelector(SmartAccount420.execute.selector, address(target), 0, data));
        require(!ok, "non-owner executed");

        vm.prank(ATTACKER);
        (ok,) = address(a).call(abi.encodeWithSelector(SmartAccount420.enableSessionKey.selector, session));
        require(!ok, "non-owner enabled session");

        vm.prank(ATTACKER);
        (ok,) = address(a).call(abi.encodeWithSelector(
            SmartAccount420.createSessionGrant.selector,
            session, address(target), WalletBoundaryTarget420.set.selector, 10, 10, uint64(60), uint64(0), uint64(0)
        ));
        require(!ok, "non-owner issued grant");

        vm.prank(ATTACKER);
        (ok,) = address(a).call(abi.encodeWithSelector(SmartAccount420.proposeRecovery.selector, ATTACKER));
        require(!ok, "non-recovery authority proposed recovery");
        require(target.stored() == 0 && a.pendingRecoveryOwner() == address(0), "unauthorized state mutation");
    }

    function testRegistryGrantAndSessionSignatureCannotCrossAccountBoundary() public {
        vm.prank(owner); a.enableSessionKey(session);
        vm.prank(owner); b.enableSessionKey(session);
        vm.prank(owner); a.createSessionGrant(session, address(target), WalletBoundaryTarget420.set.selector, 0, 0, 0, 0, 0);

        bytes memory callData = _sessionCall(77);
        uint192 lane = uint192(uint160(session));
        PackedUserOperation420 memory forA = _op(address(a), entryPoint.getNonce(address(a), lane), callData);
        forA.signature = _sign(SESSION_PK, entryPoint.getUserOpHash(forA));
        (bool success,) = entryPoint.handleOp(forA);
        require(success && target.stored() == 77, "authorized account failed");

        PackedUserOperation420 memory forB = _op(address(b), entryPoint.getNonce(address(b), lane), callData);
        forB.signature = _sign(SESSION_PK, entryPoint.getUserOpHash(forB));
        (bool ok,) = address(entryPoint).call(abi.encodeWithSelector(EntryPoint420.handleOp.selector, forB));
        require(!ok, "account B inherited account A grant");
        require(entryPoint.getNonce(address(b), lane) == uint256(lane) << 64, "rejected op spent nonce");
        require(capabilities.componentAuthority(a.accountComponentId()) == address(a), "authority drift");
    }

    function testAccountSignatureCannotReplayAcrossAccountOrChain() public {
        bytes memory execute = abi.encodeWithSelector(SmartAccount420.execute.selector, address(target), 0,
            abi.encodeWithSelector(WalletBoundaryTarget420.set.selector, 100));
        PackedUserOperation420 memory op = _op(address(a), entryPoint.getNonce(address(a), 0), execute);
        bytes32 digest = entryPoint.getUserOpHash(op);
        op.signature = _sign(OWNER_PK, digest);

        PackedUserOperation420 memory swapped = _op(address(b), entryPoint.getNonce(address(b), 0), execute);
        swapped.signature = op.signature;
        (bool ok,) = address(entryPoint).call(abi.encodeWithSelector(EntryPoint420.handleOp.selector, swapped));
        require(!ok, "cross-account signature replay accepted");

        vm.chainId(421);
        (ok,) = address(entryPoint).call(abi.encodeWithSelector(EntryPoint420.handleOp.selector, op));
        require(!ok, "cross-chain signature replay accepted");
        vm.chainId(420);

        (bool success,) = entryPoint.handleOp(op);
        require(success && target.stored() == 100, "original signed operation invalid");
    }

    function testRecoveryAuthorityDelayCancellationAndOwnerEpochIsolation() public {
        vm.prank(owner); a.enableSessionKey(session);
        vm.prank(RECOVERY); a.proposeRecovery(ATTACKER);
        vm.prank(RECOVERY);
        (bool ok,) = address(a).call(abi.encodeWithSelector(SmartAccount420.finalizeRecovery.selector));
        require(!ok && a.owner() == owner, "early recovery finalized");

        vm.prank(owner); a.cancelRecovery();
        vm.warp(block.timestamp + a.RECOVERY_DELAY());
        vm.prank(RECOVERY);
        (ok,) = address(a).call(abi.encodeWithSelector(SmartAccount420.finalizeRecovery.selector));
        require(!ok, "cancelled recovery finalized");

        vm.prank(RECOVERY); a.proposeRecovery(ATTACKER);
        vm.warp(a.recoveryExecutableAt());
        vm.prank(RECOVERY); a.finalizeRecovery();
        require(a.owner() == ATTACKER, "new owner not installed");
        require(a.sessionEpoch(session) != a.authorizationEpoch(), "old session survived owner recovery");
        vm.prank(owner);
        (ok,) = address(a).call(abi.encodeWithSelector(SmartAccount420.revokeAllAuthorizations.selector));
        require(!ok, "old owner retained privileges");
    }

    function testNamesIdentityAndProtocolDiscoveryAreNotWalletExecutionAuthority() public {
        Names420 names = new Names420(address(this));
        Identity420 identity = new Identity420(address(this));
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        bytes32 profile = keccak256("attacker-profile");
        bytes32 label = keccak256("attacker-name");
        bytes32 salt = keccak256("commit");
        vm.prank(ATTACKER); identity.createProfile(profile, bytes32(0));
        bytes32 commitment = names.makeCommitment(label, 8, ATTACKER, 30 days, salt, ATTACKER);
        vm.prank(ATTACKER); names.commit(commitment);
        vm.warp(block.timestamp + names.MIN_COMMITMENT_AGE());
        vm.prank(ATTACKER); names.register(label, 8, ATTACKER, 30 days, salt);
        vm.prank(ATTACKER); names.setResolution(label, address(a), profile, bytes32(0));
        vm.prank(ATTACKER); identity.setPrimaryName(profile, label);
        Names420.Record memory resolvedName = names.resolve(label);
        require(resolvedName.resolvedAddress == address(a), "name record not resolved");
        require(names.nameClaimsProfile(label, profile), "identity binding absent");
        bytes32 serviceId = keccak256("420/service/names/v1");
        registry.publishService(serviceId, address(a), keccak256("code"), keccak256("meta"), 1, true);
        (address discovered,) = registry.resolveActive(serviceId);
        require(discovered == address(a), "discovery record absent");

        vm.prank(ATTACKER);
        (bool ok,) = address(a).call(abi.encodeWithSelector(SmartAccount420.execute.selector, address(target), 0,
            abi.encodeWithSelector(WalletBoundaryTarget420.set.selector, 99)));
        require(!ok, "names/identity/registry record became signing authority");
        require(target.stored() == 0 && a.owner() == owner, "discovery changed account authority");
    }

    function _sessionCall(uint256 value) internal view returns (bytes memory) {
        SmartAccount420.Call[] memory calls = new SmartAccount420.Call[](1);
        calls[0] = SmartAccount420.Call({
            target: address(target), value: 0,
            data: abi.encodeWithSelector(WalletBoundaryTarget420.set.selector, value)
        });
        return abi.encodeWithSelector(SmartAccount420.executeSession.selector, session, calls);
    }

    function _op(address sender, uint256 nonce_, bytes memory callData)
        internal pure returns (PackedUserOperation420 memory op)
    {
        op = PackedUserOperation420({
            sender: sender, nonce: nonce_, initCode: bytes(""), callData: callData,
            accountGasLimits: bytes32(0), preVerificationGas: 0, gasFees: bytes32(0),
            paymasterAndData: bytes(""), signature: bytes("")
        });
    }

    function _sign(uint256 pk, bytes32 userOpHash) internal returns (bytes memory) {
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", userOpHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }
}
