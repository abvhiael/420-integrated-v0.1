// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/governance/GovernanceTimelock.sol";
import "../src/governance/CivicMerkleElectorateSource420.sol";

interface VmCivicSource {
    function roll(uint256) external;
    function prank(address) external;
}

contract CivicMerkleElectorateSource420Test {
    VmCivicSource private constant vm =
        VmCivicSource(address(uint160(uint256(keccak256("hevm cheat code")))));

    function _leaf(address voter) private pure returns (bytes32) {
        return keccak256(abi.encode(voter));
    }

    function _root(bytes32 a, bytes32 b) private pure returns (bytes32) {
        return a <= b ? keccak256(abi.encodePacked(a,b)) : keccak256(abi.encodePacked(b,a));
    }

    function testEqualWeightCheckpointAndHistoricalSnapshot() public {
        GovernanceTimelock timelock = new GovernanceTimelock(address(this));
        CivicMerkleElectorateSource420 source = new CivicMerkleElectorateSource420(
            address(timelock), keccak256("420CIVIC_COMMUNITY_EQUAL_WEIGHT_MERKLE_V1")
        );

        address alice = address(0xA11CE);
        address bob = address(0xB0B);
        bytes32 aliceLeaf = _leaf(alice);
        bytes32 bobLeaf = _leaf(bob);
        bytes32 root = _root(aliceLeaf, bobLeaf);

        bytes32 id = keccak256("checkpoint");
        timelock.schedule(
            id,
            address(source),
            0,
            abi.encodeCall(CivicMerkleElectorateSource420.publishCheckpoint, (uint64(block.number + 10), root, uint256(2))),
            GovernanceTimelock.Class.G1
        );
        // This test targets source semantics; execute after the Timelock floor and before the future checkpoint block.
        vm.roll(block.number + 1);
        // block.timestamp is independent of roll; use a second source call path through an already-authorized Timelock
        // operation after delay is covered in GovernanceAudit6Deployment420.
        vm.prank(address(timelock));
        source.publishCheckpoint(uint64(block.number + 10), root, 2);

        vm.roll(block.number + 10);
        (bytes32 snapRoot, uint256 total) = source.snapshotAt(uint64(block.number));
        require(snapRoot == root && total == 2, "snapshot mismatch");

        bytes32[] memory aliceProof = new bytes32[](1);
        aliceProof[0] = bobLeaf;
        require(source.votingWeight(root, alice, abi.encode(aliceProof)) == 1, "alice weight");

        bytes32[] memory badProof = new bytes32[](1);
        badProof[0] = bytes32(uint256(7));
        (bool ok,) = address(source).staticcall(
            abi.encodeCall(CivicMerkleElectorateSource420.votingWeight, (root, alice, abi.encode(badProof)))
        );
        require(!ok, "invalid proof accepted");
    }

    function testRejectsUnknownSourceTypeAndNonProspectiveCheckpoint() public {
        GovernanceTimelock timelock = new GovernanceTimelock(address(this));
        try new CivicMerkleElectorateSource420(address(timelock), keccak256("UNKNOWN")) returns (
            CivicMerkleElectorateSource420
        ) {
            revert("unknown type accepted");
        } catch {}

        CivicMerkleElectorateSource420 source = new CivicMerkleElectorateSource420(
            address(timelock), keccak256("420CIVIC_VALIDATOR_EQUAL_WEIGHT_MERKLE_V1")
        );
        vm.prank(address(timelock));
        (bool ok,) = address(source).call(
            abi.encodeCall(
                CivicMerkleElectorateSource420.publishCheckpoint,
                (uint64(block.number), keccak256("root"), uint256(1))
            )
        );
        require(!ok, "non-prospective checkpoint accepted");
    }
}
