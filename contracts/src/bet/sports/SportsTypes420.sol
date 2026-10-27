// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library SportsTypes420 {
    enum Competition {
        NONE,
        NHL,
        PWHL,
        NFL,
        NCAA_FBS,
        MLB,
        NBA,
        WNBA,
        NCAA_MEN_D1,
        NCAA_WOMEN_D1,
        UEFA_CHAMPIONS,
        UEFA_EUROPA,
        MLS,
        CENTRAL_AMERICAN_CUP,
        BRAZIL_SERIE_A,
        LIBERTADORES
    }
    enum Sport {
        NONE,
        HOCKEY,
        FOOTBALL,
        BASEBALL,
        BASKETBALL,
        SOCCER
    }
    enum CompetitionStatus {
        NONE,
        REGISTERED,
        APPROVED,
        SUSPENDED,
        RETIRED
    }
    enum EventStatus {
        NONE,
        SCHEDULED,
        POSTPONED,
        STARTED,
        COMPLETED,
        CANCELLED,
        ABANDONED
    }
    enum MarketStatus {
        NONE,
        DRAFT,
        APPROVED,
        OPEN,
        SUSPENDED,
        CLOSED
    }
    enum Kind {
        NONE,
        MONEYLINE_TWO,
        MONEYLINE_THREE,
        SPREAD,
        TOTAL
    }
    enum Coverage {
        NONE,
        REGULATION,
        INCLUDING_OVERTIME
    }

    struct CompetitionConfig {
        Competition catalog;
        bytes32 sourcePolicy;
        bytes32 provider;
        bytes32 feed;
        uint32 maxSourceAge;
        bytes32 manifest;
    }

    struct EventConfig {
        bytes32 season;
        bytes32 stage;
        bytes32 home;
        bytes32 away;
        bytes32 fixture; // canonical discriminator for doubleheaders/repeat fixtures
        uint64 start;
        bytes32 venue;
        bool neutral;
        bytes32 evidence;
    }

    struct Template {
        bytes32 competition;
        Kind kind;
        Coverage coverage;
        bool shootout;
        bytes32 rules;
        bytes32 completionPolicy;
        bytes32 postponementPolicy;
        bytes32 disputePolicy;
        bytes32 sourcePolicy;
        uint32 challengeSeconds;
        uint32 refundSeconds;
    }

    struct MarketConfig {
        bytes32 eventId;
        bytes32 templateId;
        bytes32 operatorId;
        bytes32 gameVersion;
        bytes32 riskProfile;
        bytes32 vaultId;
        address asset;
        int32 lineTwice;
        uint64 cutoff;
    }

    function sport(Competition c) internal pure returns (Sport) {
        if (c == Competition.NHL || c == Competition.PWHL) return Sport.HOCKEY;
        if (c == Competition.NFL || c == Competition.NCAA_FBS) return Sport.FOOTBALL;
        if (c == Competition.MLB) return Sport.BASEBALL;
        if (c >= Competition.NBA && c <= Competition.NCAA_WOMEN_D1) return Sport.BASKETBALL;
        if (c >= Competition.UEFA_CHAMPIONS && c <= Competition.LIBERTADORES) return Sport.SOCCER;
        return Sport.NONE;
    }

    function category(Competition c) internal pure returns (uint8) {
        return c == Competition.PWHL || c == Competition.WNBA || c == Competition.NCAA_WOMEN_D1 ? 2 : 1;
    }
}
