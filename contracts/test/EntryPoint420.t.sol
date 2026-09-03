// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/accounts/EntryPoint420.sol";
import "../src/accounts/SmartAccount420.sol";
import "../src/system/CapabilityRegistry420.sol";

interface VmProductionEntryPoint420 {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function prank(address msgSender) external;
    function deal(address who, uint256 newBalance) external;
    function warp(uint256 timestamp) external;
}

contract EntryPointTarget420 {
    uint256 public stored;
    function set(uint256 value) external { stored = value; }
    function fail() external pure { revert("target failure"); }
}

contract EntryPoint420Test {
    VmProductionEntryPoint420 internal constant vm = VmProductionEntryPoint420(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 internal constant OWNER_PK = 0xF420;
    uint256 internal constant SESSION_PK = 0x1420;

    EntryPoint420 internal entryPoint;
    CapabilityRegistry420 internal capabilities;
    EntryPointTarget420 internal target;
    SmartAccount420 internal account;
    address internal owner;
    address internal session;

    constructor() {
        owner = vm.addr(OWNER_PK);
        session = vm.addr(SESSION_PK);
        entryPoint = new EntryPoint420();
        capabilities = new CapabilityRegistry420();
        target = new EntryPointTarget420();
        account = new SmartAccount420(address(entryPoint), address(capabilities), owner, address(0));
    }

    function testOwnerOperationExecutesAndAdvancesOwnerNonce() public {
        PackedUserOperation420 memory op = _unsignedOp(
            0,
            abi.encodeWithSelector(SmartAccount420.execute.selector, address(target), 0, abi.encodeWithSelector(EntryPointTarget420.set.selector, 420))
        );
        op = _sign(op, OWNER_PK);

        (bool success,) = entryPoint.handleOp(op);
        require(success, "owner execution failed");
        require(target.stored() == 420, "target state");
        require(entryPoint.getNonce(address(account), 0) == 1, "owner nonce");
    }

    function testReplayRejectedAfterSuccessfulValidation() public {
        PackedUserOperation420 memory op = _sign(
            _unsignedOp(0, abi.encodeWithSelector(SmartAccount420.execute.selector, address(target), 0, abi.encodeWithSelector(EntryPointTarget420.set.selector, 1))),
            OWNER_PK
        );
        entryPoint.handleOp(op);
        (bool ok,) = address(entryPoint).call(abi.encodeWithSelector(EntryPoint420.handleOp.selector, op));
        require(!ok, "replay accepted");
    }

    function testFailedExecutionStillConsumesValidatedNonce() public {
        PackedUserOperation420 memory op = _sign(
            _unsignedOp(0, abi.encodeWithSelector(SmartAccount420.execute.selector, address(target), 0, abi.encodeWithSelector(EntryPointTarget420.fail.selector))),
            OWNER_PK
        );
        (bool success,) = entryPoint.handleOp(op);
        require(!success, "target failure hidden");
        require(entryPoint.getNonce(address(account), 0) == 1, "failed execution nonce not consumed");
        (bool replayOk,) = address(entryPoint).call(abi.encodeWithSelector(EntryPoint420.handleOp.selector, op));
        require(!replayOk, "failed operation replay accepted");
    }

    function testSessionUsesSignerDerivedIndependentNonceLane() public {
        vm.prank(owner); account.enableSessionKey(session);
        vm.prank(owner); account.createSessionGrant(session, address(target), EntryPointTarget420.set.selector, 0, 0, 0, 0, 0);

        uint192 key = uint192(uint160(session));
        uint256 nonceValue = uint256(key) << 64;
        SmartAccount420.Call[] memory calls = new SmartAccount420.Call[](1);
        calls[0] = SmartAccount420.Call({target: address(target), value: 0, data: abi.encodeWithSelector(EntryPointTarget420.set.selector, 421)});
        PackedUserOperation420 memory op = _sign(
            _unsignedOp(nonceValue, abi.encodeWithSelector(SmartAccount420.executeSession.selector, session, calls)),
            SESSION_PK
        );

        (bool success,) = entryPoint.handleOp(op);
        require(success, "session execution failed");
        require(target.stored() == 421, "session target state");
        require(entryPoint.getNonce(address(account), key) == nonceValue + 1, "session nonce");
        require(entryPoint.getNonce(address(account), 0) == 0, "owner lane touched");
    }

    function testValidationWindowEnforcedBeforeNonceConsumption() public {
        vm.warp(1000);
        vm.prank(owner); account.enableSessionKey(session);
        vm.prank(owner); account.createSessionGrant(session, address(target), EntryPointTarget420.set.selector, 0, 0, 0, 1100, 1200);

        uint192 key = uint192(uint160(session));
        uint256 nonceValue = uint256(key) << 64;
        SmartAccount420.Call[] memory calls = new SmartAccount420.Call[](1);
        calls[0] = SmartAccount420.Call({target: address(target), value: 0, data: abi.encodeWithSelector(EntryPointTarget420.set.selector, 422)});
        PackedUserOperation420 memory op = _sign(
            _unsignedOp(nonceValue, abi.encodeWithSelector(SmartAccount420.executeSession.selector, session, calls)),
            SESSION_PK
        );

        (bool earlyOk,) = address(entryPoint).call(abi.encodeWithSelector(EntryPoint420.handleOp.selector, op));
        require(!earlyOk, "operation valid too early");
        require(entryPoint.getNonce(address(account), key) == nonceValue, "early failure consumed nonce");

        vm.warp(1100);
        (bool success,) = entryPoint.handleOp(op);
        require(success, "operation not valid in window");
    }

    function testInvalidSignatureRejectedWithoutNonceConsumption() public {
        PackedUserOperation420 memory op = _sign(
            _unsignedOp(0, abi.encodeWithSelector(SmartAccount420.execute.selector, address(target), 0, abi.encodeWithSelector(EntryPointTarget420.set.selector, 9))),
            SESSION_PK
        );
        (bool ok,) = address(entryPoint).call(abi.encodeWithSelector(EntryPoint420.handleOp.selector, op));
        require(!ok, "invalid signature accepted");
        require(entryPoint.getNonce(address(account), 0) == 0, "invalid validation consumed nonce");
    }

    function testHashBindsEntryPointAndExcludesSignature() public {
        PackedUserOperation420 memory op = _unsignedOp(0, hex"12345678");
        bytes32 first = entryPoint.getUserOpHash(op);
        op.signature = hex"deadbeef";
        require(entryPoint.getUserOpHash(op) == first, "signature changed hash");
        EntryPoint420 other = new EntryPoint420();
        require(other.getUserOpHash(op) != first, "entrypoint not domain bound");
    }

    function testUnsupportedInitCodeAndPaymasterFailClosed() public {
        PackedUserOperation420 memory initOp = _unsignedOp(0, hex"12345678");
        initOp.initCode = hex"01";
        (bool initOk,) = address(entryPoint).call(abi.encodeWithSelector(EntryPoint420.handleOp.selector, initOp));
        require(!initOk, "initCode accepted");

        PackedUserOperation420 memory paymasterOp = _unsignedOp(0, hex"12345678");
        paymasterOp.paymasterAndData = hex"01";
        (bool paymasterOk,) = address(entryPoint).call(abi.encodeWithSelector(EntryPoint420.handleOp.selector, paymasterOp));
        require(!paymasterOk, "paymaster accepted");
    }

    function _unsignedOp(uint256 nonceValue, bytes memory callData) internal view returns (PackedUserOperation420 memory) {
        return PackedUserOperation420({
            sender: address(account),
            nonce: nonceValue,
            initCode: bytes(""),
            callData: callData,
            accountGasLimits: bytes32(0),
            preVerificationGas: 0,
            gasFees: bytes32(0),
            paymasterAndData: bytes(""),
            signature: bytes("")
        });
    }

    function _sign(PackedUserOperation420 memory op, uint256 privateKey) internal returns (PackedUserOperation420 memory) {
        bytes32 hash = entryPoint.getUserOpHash(op);
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        op.signature = abi.encodePacked(r, s, v);
        return op;
    }
}
