// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/accounts/IPasskeyVerifier420.sol";
import "../src/accounts/P256WebAuthnVerifier420.sol";

contract MockP256Verifier420 is IP256Verifier420 {
    bool public result = true;

    function setResult(bool result_) external {
        result = result_;
    }

    function verifyP256(bytes32, uint256, uint256, uint256, uint256) external view returns (bool) {
        return result;
    }
}

contract P256WebAuthnVerifier420Test {
    bytes32 private constant USER_OP_HASH =
        0x1111111111111111111111111111111111111111111111111111111111111111;
    bytes32 private constant RP_ID_HASH =
        0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa;
    bytes32 private constant ORIGIN_HASH = keccak256("https://wallet.420.example");

    MockP256Verifier420 private backend;
    P256WebAuthnVerifier420 private verifier;

    function setUp() public {
        backend = new MockP256Verifier420();
        verifier = new P256WebAuthnVerifier420(address(backend));
    }

    function testValidWebAuthnAssertionReachesP256Boundary() public view {
        bytes memory credentialId = hex"01020304";
        bytes memory authenticatorData = _authenticatorData(RP_ID_HASH, 0x05);
        bytes memory clientDataJSON = bytes(
            '{"type":"webauthn.get","challenge":"ERERERERERERERERERERERERERERERERERERERERERE","origin":"https://wallet.420.example","crossOrigin":false}'
        );
        bytes memory envelope = abi.encode(
            credentialId,
            authenticatorData,
            clientDataJSON,
            "https://wallet.420.example",
            uint256(1),
            uint256(2)
        );

        bool ok = verifier.verifyPasskeyAssertion(
            USER_OP_HASH,
            envelope,
            keccak256(credentialId),
            RP_ID_HASH,
            ORIGIN_HASH,
            3,
            4
        );
        require(ok, "valid passkey assertion rejected");
    }

    function testRejectsChallengeOriginRpIdAndUvDrift() public view {
        bytes memory credentialId = hex"01020304";
        bytes memory badChallenge = abi.encode(
            credentialId,
            _authenticatorData(RP_ID_HASH, 0x05),
            bytes('{"type":"webauthn.get","challenge":"wrong","origin":"https://wallet.420.example","crossOrigin":false}'),
            "https://wallet.420.example",
            uint256(1),
            uint256(2)
        );
        require(!_verify(credentialId, badChallenge), "bad challenge accepted");

        bytes memory badOrigin = abi.encode(
            credentialId,
            _authenticatorData(RP_ID_HASH, 0x05),
            bytes('{"type":"webauthn.get","challenge":"ERERERERERERERERERERERERERERERERERERERERERE","origin":"https://evil.example","crossOrigin":false}'),
            "https://evil.example",
            uint256(1),
            uint256(2)
        );
        require(!_verify(credentialId, badOrigin), "bad origin accepted");

        bytes memory badRp = abi.encode(
            credentialId,
            _authenticatorData(bytes32(uint256(9)), 0x05),
            bytes('{"type":"webauthn.get","challenge":"ERERERERERERERERERERERERERERERERERERERERERE","origin":"https://wallet.420.example","crossOrigin":false}'),
            "https://wallet.420.example",
            uint256(1),
            uint256(2)
        );
        require(!_verify(credentialId, badRp), "bad RP ID hash accepted");

        bytes memory missingUv = abi.encode(
            credentialId,
            _authenticatorData(RP_ID_HASH, 0x01),
            bytes('{"type":"webauthn.get","challenge":"ERERERERERERERERERERERERERERERERERERERERERE","origin":"https://wallet.420.example","crossOrigin":false}'),
            "https://wallet.420.example",
            uint256(1),
            uint256(2)
        );
        require(!_verify(credentialId, missingUv), "missing UV accepted");
    }

    function testRejectsCrossOriginCredentialDriftBadScalarsAndBackendFailure() public {
        bytes memory credentialId = hex"01020304";
        bytes memory crossOrigin = abi.encode(
            credentialId,
            _authenticatorData(RP_ID_HASH, 0x05),
            bytes('{"type":"webauthn.get","challenge":"ERERERERERERERERERERERERERERERERERERERERERE","origin":"https://wallet.420.example","crossOrigin":true}'),
            "https://wallet.420.example",
            uint256(1),
            uint256(2)
        );
        require(!_verify(credentialId, crossOrigin), "cross-origin assertion accepted");

        bytes memory wrongCredential = abi.encode(
            hex"090909",
            _authenticatorData(RP_ID_HASH, 0x05),
            bytes('{"type":"webauthn.get","challenge":"ERERERERERERERERERERERERERERERERERERERERERE","origin":"https://wallet.420.example","crossOrigin":false}'),
            "https://wallet.420.example",
            uint256(1),
            uint256(2)
        );
        require(!_verify(credentialId, wrongCredential), "credential drift accepted");

        bytes memory zeroR = abi.encode(
            credentialId,
            _authenticatorData(RP_ID_HASH, 0x05),
            bytes('{"type":"webauthn.get","challenge":"ERERERERERERERERERERERERERERERERERERERERERE","origin":"https://wallet.420.example","crossOrigin":false}'),
            "https://wallet.420.example",
            uint256(0),
            uint256(2)
        );
        require(!_verify(credentialId, zeroR), "zero scalar accepted");

        backend.setResult(false);
        bytes memory validEnvelope = abi.encode(
            credentialId,
            _authenticatorData(RP_ID_HASH, 0x05),
            bytes('{"type":"webauthn.get","challenge":"ERERERERERERERERERERERERERERERERERERERERERE","origin":"https://wallet.420.example","crossOrigin":false}'),
            "https://wallet.420.example",
            uint256(1),
            uint256(2)
        );
        require(!_verify(credentialId, validEnvelope), "backend failure accepted");
    }

    function _verify(bytes memory credentialId, bytes memory envelope) private view returns (bool) {
        return verifier.verifyPasskeyAssertion(
            USER_OP_HASH,
            envelope,
            keccak256(credentialId),
            RP_ID_HASH,
            ORIGIN_HASH,
            3,
            4
        );
    }

    function _authenticatorData(bytes32 rpIdHash, uint8 flags) private pure returns (bytes memory data) {
        data = new bytes(37);
        assembly {
            mstore(add(data, 32), rpIdHash)
        }
        data[32] = bytes1(flags);
    }
}
