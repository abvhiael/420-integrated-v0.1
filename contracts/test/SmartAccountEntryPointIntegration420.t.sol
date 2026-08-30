// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/accounts/SmartAccount420.sol";
import "../src/system/CapabilityRegistry420.sol";

interface VmEntryPoint420 {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function prank(address msgSender) external;
}

contract EntryPointHarness420 {
    mapping(address => mapping(uint192 => uint64)) public sequence;
    function getNonce(address sender, uint192 key) external view returns (uint256) { return (uint256(key) << 64) | sequence[sender][key]; }
    function handleOp(SmartAccount420 account, PackedUserOperation420 calldata op, bytes32 userOpHash) external returns (bytes memory result) {
        uint192 key = uint192(op.nonce >> 64);
        uint64 seq = uint64(op.nonce);
        require(seq == sequence[address(account)][key], "nonce sequence");
        require(account.validateUserOp(op, userOpHash, 0) == 0, "validation");
        sequence[address(account)][key] = seq + 1;
        (bool ok, bytes memory returnData) = address(account).call(op.callData);
        require(ok, "execution");
        return returnData;
    }
    function handleOpAllowFailure(SmartAccount420 account, PackedUserOperation420 calldata op, bytes32 userOpHash) external returns (bool ok) {
        uint192 key = uint192(op.nonce >> 64);
        uint64 seq = uint64(op.nonce);
        require(seq == sequence[address(account)][key], "nonce sequence");
        require(account.validateUserOp(op, userOpHash, 0) == 0, "validation");
        sequence[address(account)][key] = seq + 1;
        (ok,) = address(account).call(op.callData);
    }
}
contract EntryPointExecutionTarget420 {
    uint256 public stored;
    function set(uint256 value) external { stored = value; }
    function fail() external pure { revert("target failure"); }
}

contract SmartAccountEntryPointIntegration420Test {
    VmEntryPoint420 internal constant vm = VmEntryPoint420(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 internal constant OWNER_PK = 0xF420;
    uint256 internal constant SESSION_PK = 0x1420;

    EntryPointHarness420 internal entryPoint;
    CapabilityRegistry420 internal capabilities;
    EntryPointExecutionTarget420 internal target;
    SmartAccount420 internal account;
    address internal owner;
    address internal session;

    constructor() {
        owner = vm.addr(OWNER_PK);
        session = vm.addr(SESSION_PK);
        entryPoint = new EntryPointHarness420();
        capabilities = new CapabilityRegistry420();
        target = new EntryPointExecutionTarget420();
        account = new SmartAccount420(address(entryPoint), address(capabilities), owner, address(0));
    }

    function testOwnerUserOpValidatesExecutesAndAdvancesNonce() public {
        bytes memory callData = abi.encodeWithSelector(SmartAccount420.execute.selector, address(target), 0, abi.encodeWithSelector(EntryPointExecutionTarget420.set.selector, 420));
        bytes32 hash = keccak256("owner-handle-op");
        entryPoint.handleOp(account, _signedOp(OWNER_PK, 0, callData, hash), hash);
        require(target.stored() == 420, "executed");
        require(entryPoint.getNonce(address(account), 0) == 1, "owner nonce");
    }

    function testSessionUserOpUsesIndependentNonceLaneAndConsumesOnExecution() public {
        vm.prank(owner); account.enableSessionKey(session);
        vm.prank(owner); bytes32 grantId = account.createSessionGrant(session, address(target), EntryPointExecutionTarget420.set.selector, 0, 10, 1 days, 0, 0);
        uint192 key = uint192(uint160(session));
        uint256 nonceValue = uint256(key) << 64;
        bytes memory callData = _sessionCall(address(target), 0, abi.encodeWithSelector(EntryPointExecutionTarget420.set.selector, 421));
        bytes32 hash = keccak256("session-handle-op");
        PackedUserOperation420 memory op = _signedOp(SESSION_PK, nonceValue, callData, hash);

        vm.prank(address(entryPoint));
        require(account.validateUserOp(op, hash, 0) == 0, "session validates");
        require(capabilities.usage(grantId).used == 0, "validation must not consume");

        entryPoint.handleOp(account, op, hash);
        require(target.stored() == 421, "session executed");
        require(capabilities.usage(grantId).used == 0, "zero-value call consumes zero");
        require(entryPoint.getNonce(address(account), key) == nonceValue + 1, "session nonce");
        require(entryPoint.getNonce(address(account), 0) == 0, "owner lane untouched");
    }

    function testFailedSessionExecutionDoesNotBurnAllowance() public {
        vm.prank(owner); account.enableSessionKey(session);
        vm.prank(owner); bytes32 grantId = account.createSessionGrant(session, address(target), EntryPointExecutionTarget420.fail.selector, 1 ether, 1 ether, 1 days, 0, 0);
        uint192 key = uint192(uint160(session));
        uint256 nonceValue = uint256(key) << 64;
        bytes memory callData = _sessionCall(address(target), 0.4 ether, abi.encodeWithSelector(EntryPointExecutionTarget420.fail.selector));
        bytes32 hash = keccak256("session-execution-failure");
        bool ok = entryPoint.handleOpAllowFailure(account, _signedOp(SESSION_PK, nonceValue, callData, hash), hash);
        require(!ok, "target must fail");
        require(capabilities.usage(grantId).used == 0, "failed execution burned allowance");
        require(entryPoint.getNonce(address(account), key) == nonceValue + 1, "validated op nonce advances");
    }

    function testReplayIsRejectedByEntryPointNonce() public {
        bytes memory callData = abi.encodeWithSelector(SmartAccount420.execute.selector, address(target), 0, abi.encodeWithSelector(EntryPointExecutionTarget420.set.selector, 1));
        bytes32 hash = keccak256("replay");
        PackedUserOperation420 memory op = _signedOp(OWNER_PK, 0, callData, hash);
        entryPoint.handleOp(account, op, hash);
        (bool ok,) = address(entryPoint).call(abi.encodeWithSelector(EntryPointHarness420.handleOp.selector, account, op, hash));
        require(!ok, "replay must fail");
    }

    function _sessionCall(address target_, uint256 value_, bytes memory data_) internal view returns (bytes memory) {
        SmartAccount420.Call[] memory calls = new SmartAccount420.Call[](1);
        calls[0] = SmartAccount420.Call({target: target_, value: value_, data: data_});
        return abi.encodeWithSelector(SmartAccount420.executeSession.selector, session, calls);
    }

    function _signedOp(uint256 privateKey, uint256 nonceValue, bytes memory callData, bytes32 hash) internal returns (PackedUserOperation420 memory) {
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return PackedUserOperation420({sender: address(account), nonce: nonceValue, initCode: bytes(""), callData: callData, accountGasLimits: bytes32(0), preVerificationGas: 0, gasFees: bytes32(0), paymasterAndData: bytes(""), signature: abi.encodePacked(r, s, v)});
    }
}
