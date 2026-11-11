// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Bounded, fail-closed extraction of the signed WebAuthn clientDataJSON fields.
/// @dev Matches *top-level JSON values*, never substrings. Browser-generated WebAuthn
///      security fields are ASCII without JSON escapes. Escapes are rejected everywhere
///      (including otherwise-unknown keys) rather than risking aliases such as
///      "chall\\u0065nge". Unknown valid JSON values are accepted with bounded nesting.
library WebAuthnClientData420 {
    uint256 private constant MAX_BYTES = 8192;
    uint256 private constant MAX_DEPTH = 8;

    bytes32 private constant TYPE_KEY = keccak256("type");
    bytes32 private constant CHALLENGE_KEY = keccak256("challenge");
    bytes32 private constant ORIGIN_KEY = keccak256("origin");
    bytes32 private constant CROSS_ORIGIN_KEY = keccak256("crossOrigin");
    bytes32 private constant GET_TYPE = keccak256("webauthn.get");

    function verify(bytes memory data, bytes memory challenge, bytes memory origin) internal pure returns (bool) {
        if (data.length == 0 || data.length > MAX_BYTES) return false;
        uint256 pos = _ws(data, 0);
        if (pos >= data.length || data[pos] != "{") return false;
        pos = _ws(data, pos + 1);
        uint8 seen;
        if (pos < data.length && data[pos] == "}") return false;

        while (pos < data.length) {
            (uint256 keyEnd, bytes32 key, bool keyOk) = _stringHash(data, pos);
            if (!keyOk) return false;
            pos = _ws(data, keyEnd);
            if (pos >= data.length || data[pos] != ":") return false;
            pos = _ws(data, pos + 1);
            if (pos >= data.length) return false;

            if (key == TYPE_KEY || key == CHALLENGE_KEY || key == ORIGIN_KEY) {
                uint8 bit = key == TYPE_KEY ? 1 : key == CHALLENGE_KEY ? 2 : 4;
                if ((seen & bit) != 0) return false;
                seen |= bit;
                (uint256 end, bytes32 value, bool ok) = _stringHash(data, pos);
                if (!ok) return false;
                if (key == TYPE_KEY && value != GET_TYPE) return false;
                if (key == CHALLENGE_KEY && value != keccak256(challenge)) return false;
                if (key == ORIGIN_KEY && value != keccak256(origin)) return false;
                pos = end;
            } else if (key == CROSS_ORIGIN_KEY) {
                if ((seen & 8) != 0) return false;
                seen |= 8;
                if (!_literal(data, pos, "false")) return false;
                pos += 5;
            } else {
                (pos, bool ok) = _value(data, pos, 0);
                if (!ok) return false;
            }

            pos = _ws(data, pos);
            if (pos >= data.length) return false;
            if (data[pos] == "}") return (seen & 7) == 7 && _ws(data, pos + 1) == data.length;
            if (data[pos] != ",") return false;
            pos = _ws(data, pos + 1);
            if (pos >= data.length || data[pos] == "}") return false;
        }
        return false;
    }

    function _stringHash(bytes memory data, uint256 pos)
        private pure returns (uint256 next, bytes32 hash, bool ok)
    {
        if (pos >= data.length || data[pos] != '"') return (pos, 0, false);
        uint256 start = ++pos;
        while (pos < data.length) {
            bytes1 c = data[pos];
            if (c == '"') {
                uint256 length = pos - start;
                assembly { hash := keccak256(add(add(data, 32), start), length) }
                return (pos + 1, hash, true);
            }
            // Never interpret raw escapes as equivalent to canonical security keys/values.
            if (c == '\\' || uint8(c) < 0x20) return (pos, 0, false);
            ++pos;
        }
        return (pos, 0, false);
    }

    function _value(bytes memory data, uint256 pos, uint256 depth)
        private pure returns (uint256 next, bool ok)
    {
        if (pos >= data.length || depth > MAX_DEPTH) return (pos, false);
        bytes1 c = data[pos];
        if (c == '"') {
            (next,, ok) = _stringHash(data, pos);
            return (next, ok);
        }
        if (c == "{") return _object(data, pos + 1, depth + 1);
        if (c == "[") return _array(data, pos + 1, depth + 1);
        if (_literal(data, pos, "true")) return (pos + 4, true);
        if (_literal(data, pos, "false")) return (pos + 5, true);
        if (_literal(data, pos, "null")) return (pos + 4, true);
        return _number(data, pos);
    }

    function _object(bytes memory data, uint256 pos, uint256 depth)
        private pure returns (uint256 next, bool ok)
    {
        pos = _ws(data, pos);
        if (pos < data.length && data[pos] == "}") return (pos + 1, true);
        while (pos < data.length) {
            (uint256 afterKey,, bool keyOk) = _stringHash(data, pos);
            if (!keyOk) return (pos, false);
            pos = _ws(data, afterKey);
            if (pos >= data.length || data[pos] != ":") return (pos, false);
            (pos, ok) = _value(data, _ws(data, pos + 1), depth);
            if (!ok) return (pos, false);
            pos = _ws(data, pos);
            if (pos >= data.length) return (pos, false);
            if (data[pos] == "}") return (pos + 1, true);
            if (data[pos] != ",") return (pos, false);
            pos = _ws(data, pos + 1);
            if (pos >= data.length || data[pos] == "}") return (pos, false);
        }
        return (pos, false);
    }

    function _array(bytes memory data, uint256 pos, uint256 depth)
        private pure returns (uint256 next, bool ok)
    {
        pos = _ws(data, pos);
        if (pos < data.length && data[pos] == "]") return (pos + 1, true);
        while (pos < data.length) {
            (pos, ok) = _value(data, pos, depth);
            if (!ok) return (pos, false);
            pos = _ws(data, pos);
            if (pos >= data.length) return (pos, false);
            if (data[pos] == "]") return (pos + 1, true);
            if (data[pos] != ",") return (pos, false);
            pos = _ws(data, pos + 1);
            if (pos >= data.length || data[pos] == "]") return (pos, false);
        }
        return (pos, false);
    }

    function _number(bytes memory data, uint256 pos) private pure returns (uint256 next, bool ok) {
        uint256 n = data.length;
        if (pos < n && data[pos] == "-") ++pos;
        if (pos >= n) return (pos, false);
        if (data[pos] == "0") {
            ++pos;
            if (pos < n && _digit(data[pos])) return (pos, false);
        } else {
            if (data[pos] < "1" || data[pos] > "9") return (pos, false);
            do { ++pos; } while (pos < n && _digit(data[pos]));
        }
        if (pos < n && data[pos] == ".") {
            ++pos;
            if (pos >= n || !_digit(data[pos])) return (pos, false);
            do { ++pos; } while (pos < n && _digit(data[pos]));
        }
        if (pos < n && (data[pos] == "e" || data[pos] == "E")) {
            ++pos;
            if (pos < n && (data[pos] == "+" || data[pos] == "-")) ++pos;
            if (pos >= n || !_digit(data[pos])) return (pos, false);
            do { ++pos; } while (pos < n && _digit(data[pos]));
        }
        return (pos, true);
    }

    function _digit(bytes1 c) private pure returns (bool) { return c >= "0" && c <= "9"; }

    function _ws(bytes memory data, uint256 pos) private pure returns (uint256) {
        while (pos < data.length) {
            bytes1 c = data[pos];
            if (c != " " && c != 0x09 && c != 0x0a && c != 0x0d) break;
            ++pos;
        }
        return pos;
    }

    function _literal(bytes memory data, uint256 pos, bytes memory literal) private pure returns (bool) {
        if (data.length - pos < literal.length) return false;
        for (uint256 i; i < literal.length; ++i) {
            if (data[pos + i] != literal[i]) return false;
        }
        return true;
    }
}
