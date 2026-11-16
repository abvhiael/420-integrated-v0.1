// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./TronProto420.sol";

/// @notice Native java-tron header and TransferContract decoding, not caller-supplied JSON metadata.
library TronWire420 {
    using TronProto420 for bytes;
    struct Header { uint64 number; uint64 timestamp; bytes32 parent; bytes32 root; bytes20 witness; uint32 version; }
    struct Transfer { bytes32 id; bytes20 owner; bytes20 gateway; uint64 amount; bytes memo; }
    error Unsupported();

    function header(bytes memory b) internal pure returns (Header memory h) {
        if (b.length == 0 || b.length > 512) revert Unsupported();
        uint256 p; uint256 last;
        while (p < b.length) {
            (uint256 f, uint256 w, uint256 v, uint256 n, uint256 e) = b.field(p);
            if (f <= last) revert Unsupported(); last = f; p = e;
            if (f == 1 && w == 0 && v <= uint64(type(int64).max)) h.timestamp = uint64(v);
            else if (f == 2 && w == 2) h.root = b.hash32(v, n);
            else if (f == 3 && w == 2) h.parent = b.hash32(v, n);
            else if (f == 7 && w == 0 && v <= uint64(type(int64).max)) h.number = uint64(v);
            else if (f == 8 && w == 0 && v == 0) { /* unused witness_id */ }
            else if (f == 9 && w == 2) h.witness = b.account(v, n);
            else if (f == 10 && w == 0 && v <= uint32(type(int32).max)) h.version = uint32(v);
            else if (f == 11 && w == 2 && n == 32) { /* committed account root; no state-proof claim */ }
            else revert Unsupported();
        }
        if (h.number == 0 || h.timestamp == 0 || h.parent == 0 || h.witness == 0) revert Unsupported();
    }

    function blockId(bytes memory raw, uint64 number) internal pure returns (bytes32) {
        return bytes32((uint256(number) << 192) | (uint256(sha256(raw)) & type(uint192).max));
    }

    function signer(bytes32 digest, bytes memory sig) internal pure returns (address out) {
        if (sig.length != 65) revert Unsupported();
        bytes32 r; bytes32 s; uint8 v;
        assembly { r := mload(add(sig, 32)) s := mload(add(sig, 64)) v := byte(0, mload(add(sig, 96))) }
        // Native TRON uses recoverable r||s||recovery-id. High-s is accepted by java-tron;
        // replay identity is the raw transaction hash, never these signature bytes.
        if (v > 1 || r == 0 || s == 0) revert Unsupported();
        out = ecrecover(digest, v + 27, r, s);
        if (out == address(0)) revert Unsupported();
    }

    function transfer(bytes memory b) internal pure returns (Transfer memory t) {
        if (b.length < 80 || b.length > 65536) revert Unsupported();
        uint256 p; uint256 last; uint256 signatures; uint256 results; bytes memory raw;
        while (p < b.length) {
            (uint256 f, uint256 w, uint256 v, uint256 n, uint256 e) = b.field(p);
            if (f < last || (f == last && f != 2)) revert Unsupported(); last = f; p = e;
            if (f == 1 && w == 2) raw = b.cut(v, n);
            else if (f == 2 && w == 2 && n == 65) { if (++signatures > 32) revert Unsupported(); }
            else if (f == 5 && w == 2) { ++results; result(b.cut(v, n)); }
            else revert Unsupported();
        }
        if (raw.length == 0 || signatures == 0 || results > 1) revert Unsupported();
        t = rawTransfer(raw);
        t.id = sha256(raw);
        // A native TransferContract is validated and executed atomically by java-tron.
        // Unlike TVM calls it cannot commit a failed transfer. Early blocks omit ret;
        // when present, the result is inside the authenticated full-transaction leaf.
    }

    function rawTransfer(bytes memory raw) private pure returns (Transfer memory t) {
        uint256 p; uint256 last; bool hasContract;
        while (p < raw.length) {
            (uint256 f, uint256 w, uint256 v, uint256 n, uint256 e) = raw.field(p);
            if (f <= last) revert Unsupported(); last = f; p = e;
            if (f == 1 && w == 2 && n == 2) { }
            else if (f == 3 && w == 0 && v <= uint64(type(int64).max)) { }
            else if (f == 4 && w == 2 && n == 8) { }
            else if ((f == 8 || f == 14 || f == 18) && w == 0 && v <= uint64(type(int64).max)) { }
            else if (f == 10 && w == 2 && n <= 256) t.memo = raw.cut(v, n);
            else if (f == 11 && w == 2) { (t.owner, t.gateway, t.amount) = contractTransfer(raw.cut(v, n)); hasContract = true; }
            else revert Unsupported();
        }
        if (!hasContract) revert Unsupported();
    }

    function contractTransfer(bytes memory b) private pure returns (bytes20 owner, bytes20 gateway, uint64 amount) {
        uint256 p; uint256 last; bool nativeType; bytes memory parameter;
        while (p < b.length) {
            (uint256 f, uint256 w, uint256 v, uint256 n, uint256 e) = b.field(p);
            if (f <= last) revert Unsupported(); last = f; p = e;
            if (f == 1 && w == 0 && v == 1) nativeType = true;
            else if (f == 2 && w == 2) parameter = b.cut(v, n);
            else if (f == 5 && w == 0 && v <= uint32(type(int32).max)) { /* native permissions authenticated by block validation */ }
            else revert Unsupported();
        }
        if (!nativeType) revert Unsupported();
        bytes memory value; p = 0; last = 0;
        while (p < parameter.length) {
            (uint256 f, uint256 w, uint256 v, uint256 n, uint256 e) = parameter.field(p);
            if (f <= last) revert Unsupported(); last = f; p = e;
            if (f == 1 && w == 2 && keccak256(parameter.cut(v, n)) == keccak256("type.googleapis.com/protocol.TransferContract")) { }
            else if (f == 2 && w == 2 && last == 2) value = parameter.cut(v, n);
            else revert Unsupported();
        }
        // Require the type URL as well as the payload; an omitted URL is unsupported.
        (uint256 first, uint256 wire,,,) = parameter.field(0);
        if (first != 1 || wire != 2) revert Unsupported();
        p = 0; last = 0;
        while (p < value.length) {
            (uint256 f, uint256 w, uint256 v, uint256 n, uint256 e) = value.field(p);
            if (f <= last) revert Unsupported(); last = f; p = e;
            if (f == 1 && w == 2) owner = value.account(v, n);
            else if (f == 2 && w == 2) gateway = value.account(v, n);
            else if (f == 3 && w == 0 && v > 0 && v <= uint64(type(int64).max)) amount = uint64(v);
            else revert Unsupported();
        }
        if (owner == 0 || gateway == 0 || owner == gateway || amount == 0) revert Unsupported();
    }

    function result(bytes memory b) private pure {
        uint256 p; uint256 last;
        while (p < b.length) {
            (uint256 f, uint256 w, uint256 v,,uint256 e) = b.field(p);
            if (f <= last || w != 0) revert Unsupported(); last = f; p = e;
            if (f == 1 && v <= uint64(type(int64).max)) { }
            else if (f == 2 && v == 0) { }
            else if (f == 3 && v <= 1) { }
            else revert Unsupported();
        }
    }

    function inclusion(bytes32 leaf, uint32 index, uint32 count, bytes32[] memory siblings, bytes32 root) internal pure {
        if (count == 0 || count > 65535 || index >= count || siblings.length > 16) revert Unsupported();
        uint256 p; uint256 i = index; uint256 width = count;
        while (width > 1) {
            if ((i ^ 1) < width) {
                if (p >= siblings.length) revert Unsupported();
                leaf = i & 1 == 0 ? sha256(abi.encodePacked(leaf, siblings[p])) : sha256(abi.encodePacked(siblings[p], leaf));
                ++p;
            } // java-tron promotes an odd final node unchanged, rather than duplicating it.
            i >>= 1; width = (width + 1) >> 1;
        }
        if (p != siblings.length || leaf != root) revert Unsupported();
    }
}
