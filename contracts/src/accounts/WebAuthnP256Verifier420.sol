// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice RIP-7212-backed WebAuthn verifier and credential registry for SmartAccount420.
/// @dev Credentials are registered by the smart account itself. Verification fails closed
///      when the secp256r1 precompile is unavailable or returns a non-success result.
contract WebAuthnP256Verifier420 {
    address internal constant P256_PRECOMPILE = address(0x100);
    bytes private constant CHALLENGE_KEY = '"challenge":"';
    bytes private constant ORIGIN_KEY = '"origin":"';
    bytes private constant TYPE_NEEDLE = '"type":"webauthn.get"';
    bytes private constant CROSS_ORIGIN_FALSE = '"crossOrigin":false';
    bytes private constant BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

    struct Credential {
        bytes32 credentialIdHash;
        uint256 publicKeyX;
        uint256 publicKeyY;
        bytes32 rpIdHash;
        bytes32 originHash;
        bool enabled;
    }

    mapping(address => Credential) private _credentials;

    event CredentialRegistered(
        address indexed account,
        bytes32 indexed credentialIdHash,
        uint256 publicKeyX,
        uint256 publicKeyY,
        bytes32 rpIdHash,
        bytes32 originHash
    );
    event CredentialRevoked(address indexed account, bytes32 indexed credentialIdHash);

    error InvalidCredential();

    function registerCredential(
        bytes32 credentialIdHash,
        uint256 publicKeyX,
        uint256 publicKeyY,
        bytes32 rpIdHash,
        bytes32 originHash
    ) external {
        if (
            credentialIdHash == bytes32(0) || publicKeyX == 0 || publicKeyY == 0 || rpIdHash == bytes32(0)
                || originHash == bytes32(0)
        ) revert InvalidCredential();
        _credentials[msg.sender] = Credential(
            credentialIdHash,
            publicKeyX,
            publicKeyY,
            rpIdHash,
            originHash,
            true
        );
        emit CredentialRegistered(msg.sender, credentialIdHash, publicKeyX, publicKeyY, rpIdHash, originHash);
    }

    function revokeCredential() external {
        Credential storage credential = _credentials[msg.sender];
        if (!credential.enabled) revert InvalidCredential();
        bytes32 credentialIdHash = credential.credentialIdHash;
        delete _credentials[msg.sender];
        emit CredentialRevoked(msg.sender, credentialIdHash);
    }

    function credential(address account) external view returns (Credential memory) {
        return _credentials[account];
    }

    /// @notice Verify a WebAuthn assertion for a caller-supplied challenge.
    /// @param account SmartAccount whose registered credential is authoritative.
    /// @param expectedChallenge Raw 32-byte challenge supplied to navigator.credentials.get().
    /// @param assertion ABI encoding of (bytes32 credentialIdHash, bytes authenticatorData,
    ///        bytes clientDataJSON, uint256 r, uint256 s).
    function verifyAssertion(address account, bytes32 expectedChallenge, bytes calldata assertion)
        external view returns (bool)
    {
        Credential memory c = _credentials[account];
        if (!c.enabled || expectedChallenge == bytes32(0)) return false;

        bytes32 credentialIdHash;
        bytes memory authenticatorData;
        bytes memory clientDataJSON;
        uint256 r;
        uint256 s;
        try this.decodeAssertion(assertion) returns (
            bytes32 idHash,
            bytes memory authData,
            bytes memory clientData,
            uint256 r_,
            uint256 s_
        ) {
            credentialIdHash = idHash;
            authenticatorData = authData;
            clientDataJSON = clientData;
            r = r_;
            s = s_;
        } catch {
            return false;
        }

        if (credentialIdHash != c.credentialIdHash || authenticatorData.length < 37 || clientDataJSON.length == 0) {
            return false;
        }
        if (_readBytes32(authenticatorData, 0) != c.rpIdHash) return false;

        uint8 flags = uint8(authenticatorData[32]);
        if ((flags & 0x01) == 0 || (flags & 0x04) == 0) return false; // UP + UV required.

        if (!_contains(clientDataJSON, TYPE_NEEDLE) || !_contains(clientDataJSON, CROSS_ORIGIN_FALSE)) return false;
        bytes memory challengeText = _extractJsonString(clientDataJSON, CHALLENGE_KEY);
        if (keccak256(challengeText) != keccak256(_base64Url32(expectedChallenge))) return false;
        bytes memory originText = _extractJsonString(clientDataJSON, ORIGIN_KEY);
        if (originText.length == 0 || sha256(originText) != c.originHash) return false;

        bytes32 clientDataHash = sha256(clientDataJSON);
        bytes32 messageHash = sha256(abi.encodePacked(authenticatorData, clientDataHash));
        return _verifyP256(messageHash, r, s, c.publicKeyX, c.publicKeyY);
    }

    function decodeAssertion(bytes calldata assertion)
        external pure returns (bytes32, bytes memory, bytes memory, uint256, uint256)
    {
        return abi.decode(assertion, (bytes32, bytes, bytes, uint256, uint256));
    }

    function _verifyP256(bytes32 messageHash, uint256 r, uint256 s, uint256 x, uint256 y)
        internal view returns (bool)
    {
        if (r == 0 || s == 0 || x == 0 || y == 0) return false;
        bytes memory input = abi.encodePacked(messageHash, bytes32(r), bytes32(s), bytes32(x), bytes32(y));
        (bool ok, bytes memory output) = P256_PRECOMPILE.staticcall(input);
        return ok && output.length == 32 && abi.decode(output, (uint256)) == 1;
    }

    function _readBytes32(bytes memory data, uint256 offset) private pure returns (bytes32 value) {
        if (data.length < offset + 32) return bytes32(0);
        assembly { value := mload(add(add(data, 32), offset)) }
    }

    function _contains(bytes memory haystack, bytes memory needle) private pure returns (bool) {
        if (needle.length == 0 || haystack.length < needle.length) return false;
        for (uint256 i = 0; i <= haystack.length - needle.length; ++i) {
            bool match_ = true;
            for (uint256 j = 0; j < needle.length; ++j) {
                if (haystack[i + j] != needle[j]) { match_ = false; break; }
            }
            if (match_) return true;
        }
        return false;
    }

    function _extractJsonString(bytes memory json, bytes memory key) private pure returns (bytes memory value) {
        if (json.length < key.length) return bytes("");
        for (uint256 i = 0; i <= json.length - key.length; ++i) {
            bool match_ = true;
            for (uint256 j = 0; j < key.length; ++j) {
                if (json[i + j] != key[j]) { match_ = false; break; }
            }
            if (!match_) continue;
            uint256 start = i + key.length;
            uint256 end = start;
            while (end < json.length && json[end] != bytes1('"')) ++end;
            if (end == json.length) return bytes("");
            value = new bytes(end - start);
            for (uint256 k = 0; k < value.length; ++k) value[k] = json[start + k];
            return value;
        }
        return bytes("");
    }

    function _base64Url32(bytes32 input) private pure returns (bytes memory out) {
        bytes memory source = abi.encodePacked(input);
        out = new bytes(43);
        uint256 o;
        for (uint256 i = 0; i < 30; i += 3) {
            uint24 n = (uint24(uint8(source[i])) << 16) | (uint24(uint8(source[i + 1])) << 8) | uint24(uint8(source[i + 2]));
            out[o++] = BASE64URL[(n >> 18) & 63];
            out[o++] = BASE64URL[(n >> 12) & 63];
            out[o++] = BASE64URL[(n >> 6) & 63];
            out[o++] = BASE64URL[n & 63];
        }
        uint16 tail = (uint16(uint8(source[30])) << 8) | uint16(uint8(source[31]));
        out[o++] = BASE64URL[(tail >> 10) & 63];
        out[o++] = BASE64URL[(tail >> 4) & 63];
        out[o] = BASE64URL[(tail << 2) & 63];
    }
}
