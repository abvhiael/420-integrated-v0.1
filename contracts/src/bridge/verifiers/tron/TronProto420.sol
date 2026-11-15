// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Bounded, canonical protobuf wire reader. Unsupported wire types fail closed.
library TronProto420 {
    error Malformed();

    function varint(bytes memory b, uint256 p) internal pure returns (uint256 v, uint256 end) {
        uint256 start = p;
        for (uint256 i; i < 10; ++i) {
            if (p >= b.length) revert Malformed();
            uint8 c = uint8(b[p++]);
            if (i == 9 && c > 1) revert Malformed();
            v |= uint256(c & 127) << (7 * i);
            if (c < 128) {
                if (p - start > 1 && c == 0) revert Malformed();
                return (v, p);
            }
        }
        revert Malformed();
    }

    function field(bytes memory b, uint256 p)
        internal pure returns (uint256 number, uint256 wire, uint256 value, uint256 size, uint256 end)
    {
        uint256 key;
        (key, p) = varint(b, p);
        number = key >> 3;
        wire = key & 7;
        if (number == 0 || number >= (1 << 29)) revert Malformed();
        if (wire == 0) {
            (value, end) = varint(b, p);
        } else if (wire == 2) {
            (size, p) = varint(b, p);
            if (size > b.length - p) revert Malformed();
            value = p;
            end = p + size;
        } else revert Malformed();
    }

    function cut(bytes memory b, uint256 p, uint256 n) internal pure returns (bytes memory out) {
        if (p > b.length || n > b.length - p) revert Malformed();
        out = new bytes(n);
        for (uint256 i; i < n; ++i) out[i] = b[p + i];
    }

    function hash32(bytes memory b, uint256 p, uint256 n) internal pure returns (bytes32 out) {
        if (n != 32 || p > b.length || n > b.length - p) revert Malformed();
        assembly { out := mload(add(add(b, 32), p)) }
    }

    function account(bytes memory b, uint256 p, uint256 n) internal pure returns (bytes20 out) {
        if (n != 21 || p > b.length || n > b.length - p || b[p] != 0x41) revert Malformed();
        assembly { out := mload(add(add(b, 33), p)) }
        if (out == bytes20(0)) revert Malformed();
    }
}
