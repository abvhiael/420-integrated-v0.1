// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/accounts/SmartAccount420.sol";
import "../src/system/CapabilityRegistry420.sol";
import "./helpers/InvariantTarget420.sol";

interface VmInvariant420 {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
}

contract InvariantEntryPoint420 {
    function getNonce(address, uint192) external pure returns (uint256) { return 0; }
    function validate(SmartAccount420 account, PackedUserOperation420 calldata op, bytes32 userOpHash) external returns (uint256) {
        return account.validateUserOp(op, userOpHash, 0);
    }
    function execute(SmartAccount420 account, bytes calldata callData) external returns (bool ok) {
        (ok,) = address(account).call(callData);
    }
}
contract InvariantSink420 { function sink() external payable {} }

contract SmartAccountInvariantHandler420 {
    VmInvariant420 internal constant vm = VmInvariant420(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 internal constant SESSION_PK = 0xE420;

    InvariantEntryPoint420 public entryPoint;
    CapabilityRegistry420 public capabilities;
    InvariantSink420 public sink;
    SmartAccount420 public account;
    address public session;
    bytes32 public grantId;
    uint256 public attempts;
    uint256 public accepted;
    uint256 public executed;

    constructor() {
        session = vm.addr(SESSION_PK);
        entryPoint = new InvariantEntryPoint420();
        capabilities = new CapabilityRegistry420();
        sink = new InvariantSink420();
        account = new SmartAccount420(address(entryPoint), address(capabilities), address(this), address(0));
        account.enableSessionKey(session);
        grantId = account.createSessionGrant(session, address(sink), InvariantSink420.sink.selector, 0.5 ether, 1 ether, 1 days, 0, 0);
    }

    function step(uint96 rawAmount) external {
        uint256 amount = uint256(rawAmount) % 2 ether;
        SmartAccount420.Call[] memory calls = new SmartAccount420.Call[](1);
        calls[0] = SmartAccount420.Call({target: address(sink), value: amount, data: abi.encodeWithSelector(InvariantSink420.sink.selector)});
        bytes memory callData = abi.encodeWithSelector(SmartAccount420.executeSession.selector, session, calls);
        bytes32 hash = keccak256(abi.encode(attempts, amount, block.number));
        PackedUserOperation420 memory op = PackedUserOperation420({
            sender: address(account), nonce: uint256(uint192(uint160(session))) << 64, initCode: bytes(""), callData: callData,
            accountGasLimits: bytes32(0), preVerificationGas: 0, gasFees: bytes32(0), paymasterAndData: bytes(""), signature: _sign(hash)
        });
        ++attempts;
        if (entryPoint.validate(account, op, hash) == 0) {
            ++accepted;
            if (entryPoint.execute(account, callData)) ++executed;
        }
    }

    function rotateEpoch() external { account.revokeAllAuthorizations(); }

    function _sign(bytes32 hash) internal returns (bytes memory) {
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SESSION_PK, digest);
        return abi.encodePacked(r, s, v);
    }
}

contract SmartAccountInvariant420Test is InvariantTarget420 {
    SmartAccountInvariantHandler420 internal handler;

    function setUp() public { handler = new SmartAccountInvariantHandler420(); targetContract(address(handler)); }

    function invariant_PeriodUsageNeverExceedsRegistryGrant() public view {
        ICapabilityRegistryExtended420.UsageView memory u = handler.capabilities().usage(handler.grantId());
        require(u.used <= 1 ether, "capability period limit exceeded");
    }

    function invariant_AuthorizationEpochNeverZero() public view {
        require(handler.account().authorizationEpoch() != 0, "zero epoch");
    }

    function invariant_AcceptedNeverExceedsAttempts() public view {
        require(handler.accepted() <= handler.attempts(), "accept accounting");
    }

    function invariant_ExecutedNeverExceedsAccepted() public view {
        require(handler.executed() <= handler.accepted(), "execution accounting");
    }
}
