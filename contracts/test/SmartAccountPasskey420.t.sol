// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/accounts/EntryPoint420.sol";
import "../src/accounts/IPasskeyVerifier420.sol";
import "../src/accounts/SmartAccount420.sol";
import "../src/system/CapabilityRegistry420.sol";

contract MockPasskeyVerifier420 is IPasskeyVerifier420 {
    bool public result = true;
    bytes32 public expectedUserOpHash;
    bytes32 public expectedCredentialIdHash;
    bytes32 public expectedRpIdHash;
    bytes32 public expectedOriginHash;
    uint256 public expectedPublicKeyX;
    uint256 public expectedPublicKeyY;
    bytes32 public expectedAssertionHash;

    function configure(
        bytes32 userOpHash,
        bytes32 credentialIdHash,
        bytes32 rpIdHash,
        bytes32 originHash,
        uint256 publicKeyX,
        uint256 publicKeyY,
        bytes calldata assertionEnvelope
    ) external {
        expectedUserOpHash = userOpHash;
        expectedCredentialIdHash = credentialIdHash;
        expectedRpIdHash = rpIdHash;
        expectedOriginHash = originHash;
        expectedPublicKeyX = publicKeyX;
        expectedPublicKeyY = publicKeyY;
        expectedAssertionHash = keccak256(assertionEnvelope);
    }

    function setResult(bool result_) external {
        result = result_;
    }

    function verifyPasskeyAssertion(
        bytes32 userOpHash,
        bytes calldata assertionEnvelope,
        bytes32 credentialIdHash,
        bytes32 rpIdHash,
        bytes32 originHash,
        uint256 publicKeyX,
        uint256 publicKeyY
    ) external view returns (bool) {
        return result
            && userOpHash == expectedUserOpHash
            && credentialIdHash == expectedCredentialIdHash
            && rpIdHash == expectedRpIdHash
            && originHash == expectedOriginHash
            && publicKeyX == expectedPublicKeyX
            && publicKeyY == expectedPublicKeyY
            && keccak256(assertionEnvelope) == expectedAssertionHash;
    }
}

contract PasskeyCallTarget420 {
    uint256 public value;

    function setValue(uint256 value_) external returns (uint256) {
        value = value_;
        return value_;
    }
}

contract SmartAccountPasskey420Test {
    bytes32 private constant CREDENTIAL_ID_HASH = keccak256("credential-420");
    bytes32 private constant RP_ID_HASH = sha256("wallet.420.example");
    bytes32 private constant ORIGIN_HASH = keccak256("https://wallet.420.example");
    uint256 private constant PUBLIC_KEY_X = 3;
    uint256 private constant PUBLIC_KEY_Y = 4;

    EntryPoint420 private entryPoint;
    CapabilityRegistry420 private capabilities;
    SmartAccount420 private account;
    MockPasskeyVerifier420 private verifier;
    PasskeyCallTarget420 private target;

    constructor() {
        entryPoint = new EntryPoint420();
        capabilities = new CapabilityRegistry420();
        account = new SmartAccount420(address(entryPoint), address(capabilities), address(this), address(0xBEEF));
        verifier = new MockPasskeyVerifier420();
        target = new PasskeyCallTarget420();
        account.setPasskeyVerifier(address(verifier));
    }

    function testEnrolledPasskeyRoutesThroughEntryPointOwnerNonceLane() public {
        account.enrollPasskey(CREDENTIAL_ID_HASH, RP_ID_HASH, ORIGIN_HASH, PUBLIC_KEY_X, PUBLIC_KEY_Y);
        require(account.isPasskeyActive(CREDENTIAL_ID_HASH), "passkey inactive");

        bytes memory assertionEnvelope = bytes("strict-webauthn-assertion");
        PackedUserOperation420 memory op = _operation(420);
        bytes32 userOpHash = entryPoint.getUserOpHash(op);
        verifier.configure(
            userOpHash,
            CREDENTIAL_ID_HASH,
            RP_ID_HASH,
            ORIGIN_HASH,
            PUBLIC_KEY_X,
            PUBLIC_KEY_Y,
            assertionEnvelope
        );
        op.signature = _passkeySignature(CREDENTIAL_ID_HASH, assertionEnvelope);

        (bool success,) = entryPoint.handleOp(op);
        require(success, "passkey execution failed");
        require(target.value() == 420, "target state");
        require(entryPoint.getNonce(address(account), 0) == 1, "owner nonce not consumed");
    }

    function testRevocationAndAuthorizationEpochInvalidatePasskeyOnChain() public {
        account.enrollPasskey(CREDENTIAL_ID_HASH, RP_ID_HASH, ORIGIN_HASH, PUBLIC_KEY_X, PUBLIC_KEY_Y);
        require(account.isPasskeyActive(CREDENTIAL_ID_HASH), "passkey inactive");
        account.revokePasskey(CREDENTIAL_ID_HASH);
        require(!account.isPasskeyActive(CREDENTIAL_ID_HASH), "revoked passkey active");
        require(!_attemptPasskeyOperation(1), "revoked passkey accepted");

        account.enrollPasskey(CREDENTIAL_ID_HASH, RP_ID_HASH, ORIGIN_HASH, PUBLIC_KEY_X, PUBLIC_KEY_Y);
        require(account.isPasskeyActive(CREDENTIAL_ID_HASH), "reenrolled passkey inactive");
        account.revokeAllAuthorizations();
        require(!account.isPasskeyActive(CREDENTIAL_ID_HASH), "epoch-stale passkey active");
        require(!_attemptPasskeyOperation(2), "epoch-stale passkey accepted");
    }

    function testVerifierReplacementInvalidatesExistingPasskeys() public {
        account.enrollPasskey(CREDENTIAL_ID_HASH, RP_ID_HASH, ORIGIN_HASH, PUBLIC_KEY_X, PUBLIC_KEY_Y);
        uint64 previousEpoch = account.authorizationEpoch();
        MockPasskeyVerifier420 replacement = new MockPasskeyVerifier420();
        account.setPasskeyVerifier(address(replacement));
        require(account.authorizationEpoch() != previousEpoch, "verifier change did not advance epoch");
        require(!account.isPasskeyActive(CREDENTIAL_ID_HASH), "old passkey survived verifier replacement");
    }

    function testMalformedUnknownAndRejectedPasskeyEnvelopesFailClosed() public {
        account.enrollPasskey(CREDENTIAL_ID_HASH, RP_ID_HASH, ORIGIN_HASH, PUBLIC_KEY_X, PUBLIC_KEY_Y);

        PackedUserOperation420 memory malformed = _operation(3);
        malformed.signature = abi.encodePacked(account.PASSKEY_SIGNATURE_MAGIC(), hex"01");
        require(!_handle(malformed), "malformed passkey envelope accepted");

        bytes memory assertionEnvelope = bytes("assertion");
        PackedUserOperation420 memory unknown = _operation(4);
        unknown.signature = _passkeySignature(keccak256("unknown"), assertionEnvelope);
        require(!_handle(unknown), "unknown passkey accepted");

        PackedUserOperation420 memory rejected = _operation(5);
        bytes32 rejectedHash = entryPoint.getUserOpHash(rejected);
        verifier.configure(
            rejectedHash,
            CREDENTIAL_ID_HASH,
            RP_ID_HASH,
            ORIGIN_HASH,
            PUBLIC_KEY_X,
            PUBLIC_KEY_Y,
            assertionEnvelope
        );
        verifier.setResult(false);
        rejected.signature = _passkeySignature(CREDENTIAL_ID_HASH, assertionEnvelope);
        require(!_handle(rejected), "verifier rejection ignored");
    }

    function testPasskeyCannotUseSessionNonceLane() public {
        account.enrollPasskey(CREDENTIAL_ID_HASH, RP_ID_HASH, ORIGIN_HASH, PUBLIC_KEY_X, PUBLIC_KEY_Y);
        bytes memory assertionEnvelope = bytes("assertion");
        PackedUserOperation420 memory op = _operation(6);
        op.nonce = entryPoint.getNonce(address(account), 7);
        bytes32 userOpHash = entryPoint.getUserOpHash(op);
        verifier.configure(
            userOpHash,
            CREDENTIAL_ID_HASH,
            RP_ID_HASH,
            ORIGIN_HASH,
            PUBLIC_KEY_X,
            PUBLIC_KEY_Y,
            assertionEnvelope
        );
        op.signature = _passkeySignature(CREDENTIAL_ID_HASH, assertionEnvelope);
        require(!_handle(op), "passkey accepted on non-owner nonce lane");
    }

    function _attemptPasskeyOperation(uint256 value_) private returns (bool) {
        bytes memory assertionEnvelope = bytes("assertion");
        PackedUserOperation420 memory op = _operation(value_);
        bytes32 userOpHash = entryPoint.getUserOpHash(op);
        verifier.configure(
            userOpHash,
            CREDENTIAL_ID_HASH,
            RP_ID_HASH,
            ORIGIN_HASH,
            PUBLIC_KEY_X,
            PUBLIC_KEY_Y,
            assertionEnvelope
        );
        op.signature = _passkeySignature(CREDENTIAL_ID_HASH, assertionEnvelope);
        return _handle(op);
    }

    function _operation(uint256 value_) private view returns (PackedUserOperation420 memory op) {
        op = PackedUserOperation420({
            sender: address(account),
            nonce: entryPoint.getNonce(address(account), 0),
            initCode: bytes(""),
            callData: abi.encodeWithSelector(
                SmartAccount420.execute.selector,
                address(target),
                0,
                abi.encodeWithSelector(PasskeyCallTarget420.setValue.selector, value_)
            ),
            accountGasLimits: bytes32(0),
            preVerificationGas: 0,
            gasFees: bytes32(0),
            paymasterAndData: bytes(""),
            signature: bytes("")
        });
    }

    function _passkeySignature(bytes32 credentialIdHash, bytes memory assertionEnvelope)
        private
        view
        returns (bytes memory)
    {
        return abi.encodePacked(account.PASSKEY_SIGNATURE_MAGIC(), abi.encode(credentialIdHash, assertionEnvelope));
    }

    function _handle(PackedUserOperation420 memory op) private returns (bool) {
        (bool ok,) = address(entryPoint).call(abi.encodeWithSelector(EntryPoint420.handleOp.selector, op));
        return ok;
    }
}