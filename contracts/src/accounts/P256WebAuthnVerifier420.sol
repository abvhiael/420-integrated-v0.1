// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./IPasskeyVerifier420.sol";

/// @notice Strict WebAuthn assertion verifier used by SmartAccount420 passkey mode.
/// @dev The assertion envelope is abi.encode(
///        bytes credentialId,
///        bytes authenticatorData,
///        bytes clientDataJSON,
///        string origin,
///        uint256 r,
///        uint256 s
///      ).
///      P-256 verification itself is delegated to an audited/chain-native backend.
contract P256WebAuthnVerifier420 is IPasskeyVerifier420 {
    uint256 private constant _P256_N =
        0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551;

    IP256Verifier420 public immutable p256Verifier;

    error InvalidP256Verifier();

    constructor(address p256Verifier_) {
        if (p256Verifier_ == address(0) || p256Verifier_.code.length == 0) revert InvalidP256Verifier();
        p256Verifier = IP256Verifier420(p256Verifier_);
    }

    function verifyPasskeyAssertion(
        bytes32 userOpHash,
        bytes calldata assertionEnvelope,
        bytes32 expectedCredentialIdHash,
        bytes32 expectedRpIdHash,
        bytes32 expectedOriginHash,
        uint256 publicKeyX,
        uint256 publicKeyY
    ) external view returns (bool) {
        if (
            expectedCredentialIdHash == bytes32(0) || expectedRpIdHash == bytes32(0)
                || expectedOriginHash == bytes32(0) || publicKeyX == 0 || publicKeyY == 0
        ) return false;

        (
            bytes memory credentialId,
            bytes memory authenticatorData,
            bytes memory clientDataJSON,
            string memory origin,
            uint256 r,
            uint256 s
        ) = abi.decode(assertionEnvelope, (bytes, bytes, bytes, string, uint256, uint256));

        if (credentialId.length == 0 || keccak256(credentialId) != expectedCredentialIdHash) return false;
        if (authenticatorData.length < 37) return false;
        if (_readBytes32(authenticatorData, 0) != expectedRpIdHash) return false;

        uint8 flags = uint8(authenticatorData[32]);
        if ((flags & 0x01) == 0 || (flags & 0x04) == 0) return false;

        bytes memory originBytes = bytes(origin);
        if (originBytes.length == 0 || keccak256(originBytes) != expectedOriginHash) return false;
        if (!_validP256Scalar(r) || !_validP256Scalar(s)) return false;

        bytes memory expectedChallenge = bytes.concat(
            bytes('"challenge":"'), _base64url32(userOpHash), bytes('"')
        );
        bytes memory expectedOrigin = bytes.concat(bytes('"origin":"'), originBytes, bytes('"'));
        if (!_contains(clientDataJSON, bytes('"type":"webauthn.get"'))) return false;
        if (!_contains(clientDataJSON, expectedChallenge)) return false;
        if (!_contains(clientDataJSON, expectedOrigin)) return false;
        if (_contains(clientDataJSON, bytes('"crossOrigin":true'))) return false;

        bytes32 clientDataHash = sha256(clientDataJSON);
        bytes32 signedDigest = sha256(abi.encodePacked(authenticatorData, clientDataHash));

        try p256Verifier.verifyP256(signedDigest, r, s, publicKeyX, publicKeyY) returns (bool ok) {
            return ok;
        } catch {
            return false;
        }
    }

    function _validP256Scalar(uint256 value) private pure returns (bool) {
        return value != 0 && value < _P256_N;
    }

    function _readBytes32(bytes memory data, uint256 offset) private pure returns (bytes32 word) {
        if (data.length < offset + 32) return bytes32(0);
        assembly {
            word := mload(add(add(data, 32), offset))
        }
    }

    function _contains(bytes memory haystack, bytes memory needle) private pure returns (bool) {
        if (needle.length == 0 || needle.length > haystack.length) return false;
        uint256 last = haystack.length - needle.length;
        for (uint256 i = 0; i <= last; ++i) {
            bool match_ = true;
            for (uint256 j = 0; j < needle.length; ++j) {
                if (haystack[i + j] != needle[j]) {
                    match_ = false;
                    break;
                }
            }
            if (match_) return true;
        }
        return false;
    }

    function _base64url32(bytes32 input) private pure returns (bytes memory result) {
        bytes memory alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
        bytes memory data = abi.encodePacked(input);
        result = new bytes(43);
        uint256 o;
        uint256 i;
        while (i + 3 <= data.length) {
            uint24 n = (uint24(uint8(data[i])) << 16) | (uint24(uint8(data[i + 1])) << 8) | uint24(uint8(data[i + 2]));
            result[o++] = alphabet[(n >> 18) & 63];
            result[o++] = alphabet[(n >> 12) & 63];
            result[o++] = alphabet[(n >> 6) & 63];
            result[o++] = alphabet[n & 63];
            i += 3;
        }
        uint24 tail = uint24(uint8(data[i])) << 16;
        if (i + 1 < data.length) tail |= uint24(uint8(data[i + 1])) << 8;
        result[o++] = alphabet[(tail >> 18) & 63];
        result[o++] = alphabet[(tail >> 12) & 63];
        if (i + 1 < data.length) result[o++] = alphabet[(tail >> 6) & 63];
    }
}
