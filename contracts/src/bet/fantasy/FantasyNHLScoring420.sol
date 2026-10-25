// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./FantasyTypes420.sol";
import "./FantasySlateBook420.sol";

contract FantasyNHLScoring420 {
    bytes32 public constant DOMAIN = keccak256("420.FANTASY.NHL.STAT_LEAF.V1");
    error InvalidStats();
    error InvalidProof();

    function leaf(bytes32 slate, uint64 revision, uint32 athlete, bytes32 game, FantasyTypes420.Stats calldata s)
        public
        pure
        returns (bytes32)
    {
        return keccak256(bytes.concat(keccak256(abi.encode(DOMAIN, slate, revision, athlete, game, s))));
    }

    function verify(bytes32 root, bytes32 value, bytes32[] calldata proof) external pure {
        _verify(root, value, proof);
    }

    function _verify(bytes32 root, bytes32 value, bytes32[] memory proof) private pure {
        if (proof.length > 32) revert InvalidProof();
        for (uint256 i; i < proof.length; i++) {
            value = value < proof[i]
                ? keccak256(abi.encodePacked(value, proof[i]))
                : keccak256(abi.encodePacked(proof[i], value));
        }
        if (value != root || root == 0) revert InvalidProof();
    }

    /// Tenths of a fantasy point. No rounding, implicit special-teams duplication or unsigned scores.
    function score(FantasyTypes420.Stats memory s, bool goalie) public pure returns (int256 points) {
        if (
            !s.complete || s.goals > s.shots || uint256(s.shorthanded) > uint256(s.goals) + s.assists
                || (s.win && s.overtimeLoss) || (s.shutout && s.goalsAgainst != 0)
        ) revert InvalidStats();
        if (
            !goalie
                && (s.saves != 0
                    || s.goalsAgainst != 0
                    || s.win
                    || s.shutout
                    || s.overtimeLoss
                    || s.entireGame
                    || s.soleGoalie)
        ) revert InvalidStats();
        if (s.shutout != (goalie && s.played && s.entireGame && s.soleGoalie && s.goalsAgainst == 0)) revert InvalidStats();
        if (!s.played) {
            if (
                s.goals != 0 || s.assists != 0 || s.shots != 0 || s.blocks != 0 || s.shorthanded != 0 || s.shootout != 0
                    || s.saves != 0 || s.goalsAgainst != 0 || s.win || s.shutout || s.overtimeLoss || s.entireGame
                    || s.soleGoalie
            ) revert InvalidStats();
            return 0;
        }
        points = int256(
            uint256(s.goals) * 85 + uint256(s.assists) * 50 + uint256(s.shots) * 15 + uint256(s.blocks) * 13
                + uint256(s.shorthanded) * 20 + uint256(s.shootout) * 15
        );
        if (s.goals >= 3) points += 30;
        if (s.shots >= 5) points += 30;
        if (s.blocks >= 3) points += 30;
        if (uint256(s.goals) + s.assists >= 3) points += 30;
        if (goalie) {
            points += int256(uint256(s.saves) * 7) - int256(uint256(s.goalsAgainst) * 35);
            if (s.win) points += 60;
            if (s.shutout) points += 40;
            if (s.overtimeLoss) points += 20;
            if (s.saves >= 35) points += 30;
        }
    }

    function calculate(
        address slateBook,
        bytes32 slate,
        uint64 revision,
        bytes32 root,
        uint32[7] calldata lineup,
        bytes calldata witnesses
    ) external view returns (int256 total) {
        if (witnesses.length > 16384) revert InvalidProof();
        (FantasyTypes420.Stats[7] memory stats, bytes32[][7] memory proofs) =
            abi.decode(witnesses, (FantasyTypes420.Stats[7], bytes32[][7]));
        FantasySlateBook420 book = FantasySlateBook420(slateBook);
        for (uint256 i; i < 7; i++) {
            FantasyTypes420.Athlete memory a = book.athleteOf(slate, lineup[i]);
            if (!book.resultOf(slate, a.game).eligible) continue;
            bytes32 value = keccak256(
                bytes.concat(keccak256(abi.encode(DOMAIN, slate, revision, a.id, a.game, stats[i])))
            );
            _verify(root, value, proofs[i]);
            total += score(stats[i], a.positions == 16);
        }
    }
}
