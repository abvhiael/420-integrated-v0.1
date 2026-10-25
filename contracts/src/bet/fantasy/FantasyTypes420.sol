// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library FantasyTypes420 {
    uint8 internal constant C = 1;
    uint8 internal constant LW = 2;
    uint8 internal constant RW = 4;
    uint8 internal constant D = 8;
    uint8 internal constant G = 16;
    bytes32 internal constant SCORING = keccak256("420.FANTASY.NHL.DAILY.PICK6_INSPIRED.V1");
    bytes32 internal constant DATA_POLICY = keccak256("420.FANTASY.NHL.OFFICIAL_SPORTRADAR_SPORTSDATAIO.CUTOFF.V1");

    struct Athlete {
        uint32 id;
        bytes32 game;
        uint8 positions;
    }

    struct Game {
        bytes32 id;
        uint64 scheduled;
    }

    struct GameResult {
        bytes32 game;
        uint64 actualStart;
        uint64 finalAt;
        uint64 decidedAt;
        bool eligible;
        bool timingVerified;
        bool definitiveCancellation;
    }

    struct Stats {
        uint16 goals;
        uint16 assists;
        uint16 shots;
        uint16 blocks;
        uint16 shorthanded;
        uint16 shootout;
        uint16 saves;
        uint16 goalsAgainst;
        bool win;
        bool shutout;
        bool overtimeLoss;
        bool played;
        bool complete;
        bool entireGame;
        bool soleGoalie;
    }

    struct Band {
        uint64 minimum;
        uint64 maximum;
        uint16[] weights;
    }

    struct StatReport {
        bytes32 root;
        bytes32 evidence;
        uint64 revision;
        uint64 asOf;
    }
}
