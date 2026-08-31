// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/accounts/SmartAccount420.sol";
import "../src/system/CapabilityRegistry420.sol";

interface VmPolicy420 {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function prank(address msgSender) external;
    function deal(address who, uint256 newBalance) external;
}

contract PolicyEntryPointMock420 {
    function getNonce(address, uint192) external pure returns (uint256) { return 0; }
    function validate(SmartAccount420 account, PackedUserOperation420 calldata op, bytes32 userOpHash) external returns (uint256) {
        return account.validateUserOp(op, userOpHash, 0);
    }
    function execute(SmartAccount420 account, bytes calldata callData) external returns (bool ok) {
        (ok,) = address(account).call(callData);
    }
}
contract PolicyTarget420 { function sink() external payable {} }
contract MockERC20Policy420 { function transfer(address, uint256) external pure returns (bool) { return true; } }

contract SmartAccountPolicyFuzz420Test {
    VmPolicy420 internal constant vm = VmPolicy420(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 internal constant OWNER_PK = 0xC420;
    uint256 internal constant SESSION_PK = 0xD420;

    PolicyEntryPointMock420 internal entryPoint;
    CapabilityRegistry420 internal capabilities;
    PolicyTarget420 internal target;
    MockERC20Policy420 internal token;
    SmartAccount420 internal account;
    address internal owner;
    address internal session;

    constructor() {
        owner = vm.addr(OWNER_PK);
        session = vm.addr(SESSION_PK);
        entryPoint = new PolicyEntryPointMock420();
        capabilities = new CapabilityRegistry420();
        target = new PolicyTarget420();
        token = new MockERC20Policy420();
        account = new SmartAccount420(address(entryPoint), address(capabilities), owner, address(0));
    }

    function testFuzzNativePerCallLimit(uint96 rawAmount) public {
        uint256 amount = uint256(rawAmount) % 2 ether;
        _enable();
        _grant(address(target), PolicyTarget420.sink.selector, 0.5 ether, 1 ether, 1 days);
        bytes32 hash = keccak256(abi.encode("native-limit", amount));
        uint256 result = entryPoint.validate(account, _nativeOp(amount, hash), hash);
        require((result == 0) == (amount <= 0.5 ether), "per-call boundary");
    }

    function testValidationDoesNotConsumeAllowance() public {
        _enable();
        bytes32 grantId = _grant(address(target), PolicyTarget420.sink.selector, 1 ether, 1 ether, 1 days);
        bytes32 hash = keccak256("validation-read-only");
        PackedUserOperation420 memory op = _nativeOp(0.6 ether, hash);
        require(entryPoint.validate(account, op, hash) == 0, "validation");
        require(capabilities.usage(grantId).used == 0, "validation consumed allowance");
    }

    function testPeriodLimitUsesExecutionConsumption() public {
        _enable();
        bytes32 grantId = _grant(address(target), PolicyTarget420.sink.selector, 1 ether, 1 ether, 1 days);
        bytes32 firstHash = keccak256("period-first");
        PackedUserOperation420 memory firstOp = _nativeOp(0.6 ether, firstHash);
        require(entryPoint.validate(account, firstOp, firstHash) == 0, "first validation");
        require(capabilities.usage(grantId).used == 0, "validation must be read-only");
        vm.deal(address(account), 1 ether);
        require(entryPoint.execute(account, firstOp.callData), "first execution");
        require(capabilities.usage(grantId).used == 0.6 ether, "execution usage");

        bytes32 secondHash = keccak256("period-second");
        require(entryPoint.validate(account, _nativeOp(0.5 ether, secondHash), secondHash) == 1, "second reject");
        require(capabilities.usage(grantId).used == 0.6 ether, "reject must not consume");
    }

    function testRejectedBatchDoesNotPartiallyConsumeAllowance() public {
        _enable();
        bytes32 grantId = _grant(address(target), PolicyTarget420.sink.selector, 1 ether, 1 ether, 1 days);
        SmartAccount420.Call[] memory calls = new SmartAccount420.Call[](2);
        calls[0] = SmartAccount420.Call({target: address(target), value: 0.4 ether, data: abi.encodeWithSelector(PolicyTarget420.sink.selector)});
        calls[1] = SmartAccount420.Call({target: address(0xBAD), value: 0.1 ether, data: abi.encodeWithSelector(PolicyTarget420.sink.selector)});
        bytes memory callData = abi.encodeWithSelector(SmartAccount420.executeSession.selector, session, calls);
        bytes32 hash = keccak256("batch-partial-consumption");
        require(entryPoint.validate(account, _op(callData, hash), hash) == 1, "batch reject");
        require(capabilities.usage(grantId).used == 0, "no partial consumption");
    }

    function testTokenBatchAggregatesSameGrantBeforeCommit() public {
        _enable();
        bytes32 grantId = _grant(address(token), MockERC20Policy420.transfer.selector, 100, 100, 1 days);
        SmartAccount420.Call[] memory calls = new SmartAccount420.Call[](2);
        calls[0] = SmartAccount420.Call({target: address(token), value: 0, data: abi.encodeWithSelector(MockERC20Policy420.transfer.selector, address(1), 60)});
        calls[1] = SmartAccount420.Call({target: address(token), value: 0, data: abi.encodeWithSelector(MockERC20Policy420.transfer.selector, address(2), 50)});
        bytes memory callData = abi.encodeWithSelector(SmartAccount420.executeSession.selector, session, calls);
        bytes32 hash = keccak256("token-aggregate");
        require(entryPoint.validate(account, _op(callData, hash), hash) == 1, "aggregate limit");
        require(capabilities.usage(grantId).used == 0, "token reject must not consume");
    }

    function testFuzzTokenPeriodLimit(uint128 rawAmount) public {
        uint256 amount = uint256(rawAmount) % 200;
        _enable();
        _grant(address(token), MockERC20Policy420.transfer.selector, 100, 100, 1 days);
        SmartAccount420.Call[] memory calls = new SmartAccount420.Call[](1);
        calls[0] = SmartAccount420.Call({
            target: address(token),
            value: 0,
            data: abi.encodeWithSelector(MockERC20Policy420.transfer.selector, address(0x420), amount)
        });
        bytes memory callData = abi.encodeWithSelector(SmartAccount420.executeSession.selector, session, calls);
        bytes32 hash = keccak256(abi.encode("token-limit", amount));
        uint256 result = entryPoint.validate(account, _op(callData, hash), hash);
        require((result == 0) == (amount <= 100), "token boundary");
    }

    function _enable() internal { vm.prank(owner); account.enableSessionKey(session); }

    function _grant(address target_, bytes4 selector_, uint256 perCall, uint256 period, uint64 seconds_)
        internal returns (bytes32 grantId)
    {
        vm.prank(owner);
        grantId = account.createSessionGrant(session, target_, selector_, perCall, period, seconds_, 0, 0);
    }

    function _nativeOp(uint256 amount, bytes32 hash) internal returns (PackedUserOperation420 memory) {
        SmartAccount420.Call[] memory calls = new SmartAccount420.Call[](1);
        calls[0] = SmartAccount420.Call({target: address(target), value: amount, data: abi.encodeWithSelector(PolicyTarget420.sink.selector)});
        return _op(abi.encodeWithSelector(SmartAccount420.executeSession.selector, session, calls), hash);
    }

    function _op(bytes memory callData, bytes32 hash) internal returns (PackedUserOperation420 memory) {
        uint256 nonceValue = uint256(uint192(uint160(session))) << 64;
        return PackedUserOperation420({sender: address(account), nonce: nonceValue, initCode: bytes(""), callData: callData, accountGasLimits: bytes32(0), preVerificationGas: 0, gasFees: bytes32(0), paymasterAndData: bytes(""), signature: _sign(hash)});
    }

    function _sign(bytes32 hash) internal returns (bytes memory) {
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SESSION_PK, digest);
        return abi.encodePacked(r, s, v);
    }
}
