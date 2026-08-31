// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/accounts/SmartAccount420.sol";
import "../src/accounts/SmartAccountFactory420.sol";
import "../src/system/CapabilityRegistry420.sol";

contract EntryPointMock420 {
    mapping(address => mapping(uint192 => uint256)) public nonces;
    function getNonce(address sender, uint192 key) external view returns (uint256) { return nonces[sender][key]; }
    function validate(SmartAccount420 account, PackedUserOperation420 calldata op, bytes32 opHash, uint256 missingFunds)
        external returns (uint256)
    { return account.validateUserOp(op, opHash, missingFunds); }
    receive() external payable {}
}

contract CallTarget420 {
    uint256 public value;
    function setValue(uint256 newValue) external payable returns (uint256) { value = newValue; return newValue; }
}

contract SmartAccount420Test {
    EntryPointMock420 internal entryPoint;
    CapabilityRegistry420 internal capabilities;
    SmartAccount420 internal account;
    CallTarget420 internal target;

    constructor() payable {
        entryPoint = new EntryPointMock420();
        capabilities = new CapabilityRegistry420();
        account = new SmartAccount420(address(entryPoint), address(capabilities), address(this), address(0xBEEF));
        target = new CallTarget420();
    }

    function testOwnerCanExecute() public {
        bytes memory result = account.execute(address(target), 0, abi.encodeWithSelector(CallTarget420.setValue.selector, 420));
        require(abi.decode(result, (uint256)) == 420, "return value");
        require(target.value() == 420, "target state");
    }

    function testFactoryAddressIsDeterministic() public {
        SmartAccountFactory420 factory = new SmartAccountFactory420(address(entryPoint), address(capabilities));
        bytes32 salt = keccak256("420-account");
        address predicted = factory.getAddress(address(this), address(0xCAFE), salt);
        SmartAccount420 created = factory.createAccount(address(this), address(0xCAFE), salt);
        require(address(created) == predicted, "create2 address");
        require(capabilities.componentAuthority(created.accountComponentId()) == address(created), "component authority");
        SmartAccount420 again = factory.createAccount(address(this), address(0xCAFE), salt);
        require(address(again) == predicted, "idempotent create");
    }

    function testRevokeAllInvalidatesExistingSessionEpoch() public {
        address key = address(0x1234);
        account.enableSessionKey(key);
        require(account.sessionEpoch(key) == account.authorizationEpoch(), "initial epoch");
        account.revokeAllAuthorizations();
        require(account.sessionEpoch(key) != account.authorizationEpoch(), "epoch invalidated");
    }

    function testPolicyVersionAdvanceInvalidatesExistingKeys() public {
        address key = address(0x5678);
        account.enableSessionKey(key);
        uint64 oldEpoch = account.authorizationEpoch();
        account.setAuthorizationPolicyVersion(2);
        require(account.authorizationPolicyVersion() == 2, "version");
        require(account.authorizationEpoch() != oldEpoch, "epoch advanced");
        require(account.sessionEpoch(key) != account.authorizationEpoch(), "session invalidated");
    }

    function testMalformedUserOpSignatureFailsValidation() public {
        PackedUserOperation420 memory op = PackedUserOperation420({
            sender: address(account), nonce: 0, initCode: bytes(""),
            callData: abi.encodeWithSelector(SmartAccount420.execute.selector, address(target), 0, abi.encodeWithSelector(CallTarget420.setValue.selector, 1)),
            accountGasLimits: bytes32(0), preVerificationGas: 0, gasFees: bytes32(0), paymasterAndData: bytes(""), signature: hex"01"
        });
        require(entryPoint.validate(account, op, keccak256("bad-op"), 0) == 1, "must reject");
    }

    function testSessionGrantCannotTargetAccountItself() public {
        address key = address(0x9999);
        account.enableSessionKey(key);
        (bool ok,) = address(account).call(
            abi.encodeWithSelector(
                SmartAccount420.createSessionGrant.selector,
                key,
                address(account),
                SmartAccount420.revokeAllAuthorizations.selector,
                0, 0, 0, 0, 0
            )
        );
        require(!ok, "self grant forbidden");
    }
}
