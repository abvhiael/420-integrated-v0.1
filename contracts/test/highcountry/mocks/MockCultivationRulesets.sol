// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

contract MockCultivationRulesets {
    address public immutable authorization;
    mapping(bytes32 => bytes32) public content;

    constructor(
        address auth
    ) {
        authorization = auth;
    }

    function register(
        bytes32 id
    ) external {
        content[id] = keccak256(abi.encode(id));
    }

    function exists(
        bytes32 id
    ) external view returns (bool) {
        return content[id] != bytes32(0);
    }

    function getRuleset(
        bytes32 id
    ) external view returns (bytes32, uint64, bool) {
        return (content[id], 1, content[id] != bytes32(0));
    }

    function deriveRulesetId(
        bytes32 hash
    ) external view returns (bytes32) {
        return _find(hash);
    }
    mapping(bytes32 => bytes32) private hashToId;

    function registerReal(
        bytes32 id,
        bytes32 hash
    ) external {
        content[id] = hash;
        hashToId[hash] = id;
    }

    function _find(
        bytes32 hash
    ) internal view returns (bytes32) {
        return hashToId[hash];
    }
}
