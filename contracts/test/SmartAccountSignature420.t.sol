// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/accounts/SmartAccount420.sol";
import "../src/system/CapabilityRegistry420.sol";

interface Vm420 {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function prank(address msgSender) external;
}

contract SignatureEntryPointMock420 {
    mapping(address => mapping(uint192 => uint256)) public nonces;
    function getNonce(address sender, uint192 key) external view returns (uint256) { return nonces[sender][key]; }
    function validate(SmartAccount420 account, PackedUserOperation420 calldata op, bytes32 userOpHash) external returns (uint256) {
        return account.validateUserOp(op, userOpHash, 0);
    }
}

contract SignatureTarget420 { uint256 public stored; function set(uint256 value) external { stored = value; } }

contract SmartAccountSignature420Test {
    Vm420 internal constant vm = Vm420(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 internal constant OWNER_PK = 0xA420;
    uint256 internal constant SESSION_PK = 0xB420;

    SignatureEntryPointMock420 internal entryPoint;
    CapabilityRegistry420 internal capabilities;
    SignatureTarget420 internal target;
    SmartAccount420 internal account;
    address internal owner;
    address internal session;

    constructor() {
        owner = vm.addr(OWNER_PK);
        session = vm.addr(SESSION_PK);
        entryPoint = new SignatureEntryPointMock420();
        capabilities = new CapabilityRegistry420();
        target = new SignatureTarget420();
        account = new SmartAccount420(address(entryPoint), address(capabilities), owner, address(0));
    }

    function testOwnerRealSignatureValidates() public {
        bytes memory callData = abi.encodeWithSelector(SmartAccount420.execute.selector, address(target), 0, abi.encodeWithSelector(SignatureTarget420.set.selector, 420));
        bytes32 userOpHash = keccak256("owner-user-op");
        require(entryPoint.validate(account, _op(0, callData, _sign(OWNER_PK, userOpHash)), userOpHash) == 0, "owner validation");
    }

    function testWrongOwnerSignatureFails() public {
        bytes memory callData = abi.encodeWithSelector(SmartAccount420.execute.selector, address(target), 0, abi.encodeWithSelector(SignatureTarget420.set.selector, 1));
        bytes32 userOpHash = keccak256("wrong-owner-user-op");
        require(entryPoint.validate(account, _op(0, callData, _sign(SESSION_PK, userOpHash)), userOpHash) == 1, "unconfigured signer");
    }

    function testSessionRealSignatureRequiresRegistryGrant() public {
        vm.prank(owner); account.enableSessionKey(session);
        bytes memory callData = abi.encodeWithSelector(SmartAccount420.execute.selector, address(target), 0, abi.encodeWithSelector(SignatureTarget420.set.selector, 42));
        uint256 nonceValue = uint256(uint192(uint160(session))) << 64;
        bytes32 deniedHash = keccak256("session-denied");
        require(entryPoint.validate(account, _op(nonceValue, callData, _sign(SESSION_PK, deniedHash)), deniedHash) == 1, "grant required");

        vm.prank(owner); account.createSessionGrant(session, address(target), SignatureTarget420.set.selector, 0, 0, 0, 0, 0);
        bytes32 allowedHash = keccak256("session-allowed");
        require(entryPoint.validate(account, _op(nonceValue, callData, _sign(SESSION_PK, allowedHash)), allowedHash) == 0, "registry grant");
    }

    function testSessionCannotUseOwnerNonceLane() public {
        vm.prank(owner); account.enableSessionKey(session);
        vm.prank(owner); account.createSessionGrant(session, address(target), SignatureTarget420.set.selector, 0, 0, 0, 0, 0);
        bytes memory callData = abi.encodeWithSelector(SmartAccount420.execute.selector, address(target), 0, abi.encodeWithSelector(SignatureTarget420.set.selector, 7));
        bytes32 userOpHash = keccak256("bad-lane");
        require(entryPoint.validate(account, _op(0, callData, _sign(SESSION_PK, userOpHash)), userOpHash) == 1, "nonce lane isolation");
    }

    function testERC1271OwnerSignature() public {
        bytes32 hash = keccak256("420-contract-signature");
        require(account.isValidSignature(hash, _sign(OWNER_PK, hash)) == account.ERC1271_MAGICVALUE(), "1271 owner");
    }

    function _op(uint256 nonceValue, bytes memory callData, bytes memory signature) internal view returns (PackedUserOperation420 memory) {
        return PackedUserOperation420({sender: address(account), nonce: nonceValue, initCode: bytes(""), callData: callData, accountGasLimits: bytes32(0), preVerificationGas: 0, gasFees: bytes32(0), paymasterAndData: bytes(""), signature: signature});
    }

    function _sign(uint256 privateKey, bytes32 hash) internal returns (bytes memory) {
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }
}
