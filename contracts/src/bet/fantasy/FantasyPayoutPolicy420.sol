// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./FantasyTypes420.sol";

contract FantasyPayoutPolicy420 {
    address public immutable engine;
    mapping(bytes32 => FantasyTypes420.Band[]) private bands;
    mapping(bytes32 => bytes32) public policyHash;
    error Unauthorized();
    error InvalidInput();

    constructor(address engine_) {
        engine = engine_;
    }

    function register(bytes32 id, uint64 cap, bytes calldata encoded) external {
        if (msg.sender != engine) revert Unauthorized();
        if (policyHash[id] != 0 || encoded.length > 65536) revert InvalidInput();
        FantasyTypes420.Band[] memory rows = abi.decode(encoded, (FantasyTypes420.Band[]));
        if (cap == 2) {
            if (rows.length != 0) revert InvalidInput();
            policyHash[id] = keccak256(encoded);
            return;
        }
        if (rows.length == 0 || rows.length > 32) revert InvalidInput();
        uint64 expected = 3;
        uint256 totalWeights = 0;
        for (uint256 i; i < rows.length; i++) {
            FantasyTypes420.Band memory b = rows[i];
            totalWeights += b.weights.length;
            if (totalWeights > 512) revert InvalidInput();
            if (
                b.minimum != expected || b.maximum < b.minimum || b.weights.length == 0 || b.weights.length > b.minimum
                    || b.weights.length > 256
            ) revert InvalidInput();
            uint256 sum = 0;
            bands[id].push();
            FantasyTypes420.Band storage target = bands[id][i];
            target.minimum = b.minimum;
            target.maximum = b.maximum;
            for (uint256 j; j < b.weights.length; j++) {
                sum += b.weights[j];
                target.weights.push(b.weights[j]);
            }
            if (sum != 10000 || (i + 1 < rows.length && b.maximum == type(uint64).max)) revert InvalidInput();
            if (i + 1 < rows.length) expected = b.maximum + 1;
        }
        if (rows[rows.length - 1].maximum != (cap == 0 ? type(uint64).max : cap)) revert InvalidInput();
        policyHash[id] = keccak256(encoded);
    }

    function bandAt(bytes32 id, uint256 index) external view returns (FantasyTypes420.Band memory) {
        return bands[id][index];
    }

    function weightsFor(bytes32 id, uint64 count) external view returns (uint16[] memory chosen) {
        if (policyHash[id] == 0 || count < 2) revert InvalidInput();
        if (count == 2) {
            chosen = new uint16[](1);
            chosen[0] = 10000;
            return chosen;
        }
        for (uint256 i; i < bands[id].length; i++) {
            if (count >= bands[id][i].minimum && count <= bands[id][i].maximum) return bands[id][i].weights;
        }
        revert InvalidInput();
    }
}
