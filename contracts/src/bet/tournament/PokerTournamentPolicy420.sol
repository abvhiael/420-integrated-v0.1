// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Frozen 5C.1 configuration and exact arithmetic; no custody or gameplay authority.
library PokerTournamentPolicy420 {
    bytes32 internal constant RULESET=keccak256("420.BET.POKER.NLHE.TOURNAMENT.V1");
    enum StartKind{SCHEDULED,SIT_AND_GO}
    enum PurchaseKind{FREEZEOUT,RE_ENTRY,REBUY}
    struct Config{
        bytes32 gameVersion;bytes32 operatorId;bytes32 payoutPolicy;bytes32 recoveryPolicy;bytes32 blindSchedule;bytes32 seatingPolicy;
        StartKind startKind;PurchaseKind purchaseKind;bool multiTable;
        uint8 seatsPerTable;uint16 maxTables;uint32 minimum;uint32 startingTarget;uint32 maxPlayers;
        uint128 buyIn;uint128 startingStack;uint128 sponsoredPrize;
        uint64 registrationOpens;uint64 startOrRegistrationDeadline;
        uint32 underfillGrace;uint32 technicalGrace;uint32 purchaseReadiness;uint32 rebuyChoice;uint32 recoveryGrace;
        uint32 lateDuration;uint32 extraDuration;uint16 lateLevel;uint16 extraLevel;uint16 extraCap;
    }
    error InvalidPolicy();
    function validate(Config memory c,uint256 now_) internal pure{
        if(c.gameVersion==0||c.operatorId==0||c.payoutPolicy==0||c.recoveryPolicy==0||c.blindSchedule==0||c.seatingPolicy==0||c.startingStack==0)revert InvalidPolicy();
        if(c.seatsPerTable<2||c.seatsPerTable>9||c.maxTables==0||(!c.multiTable&&c.maxTables!=1)||(c.multiTable&&c.maxTables<2))revert InvalidPolicy();
        uint256 capacity=uint256(c.seatsPerTable)*c.maxTables;
        if(c.minimum<2||c.startingTarget<c.minimum||c.maxPlayers<c.startingTarget||c.maxPlayers>capacity)revert InvalidPolicy();
        if(c.registrationOpens<=now_||c.startOrRegistrationDeadline<=c.registrationOpens)revert InvalidPolicy();
        if(c.underfillGrace==0||c.technicalGrace==0||c.purchaseReadiness==0||c.rebuyChoice==0||c.recoveryGrace==0)revert InvalidPolicy();
        if(c.lateDuration==0&&c.lateLevel!=0)revert InvalidPolicy();
        if(c.purchaseKind==PurchaseKind.FREEZEOUT){if(c.extraCap!=0||c.extraDuration!=0||c.extraLevel!=0)revert InvalidPolicy();}
        else if(c.extraCap==0||c.extraDuration==0)revert InvalidPolicy();
        // All published pre-start arithmetic must be representable without truncation.
        if(uint256(c.startOrRegistrationDeadline)+c.underfillGrace+c.technicalGrace>type(uint64).max)revert InvalidPolicy();
    }
    /// Floor once when quoting the immutable per-purchase fee; every purchase is identical.
    function fee(uint256 buyIn) internal pure returns(uint256){return(buyIn/100)*3+(buyIn%100)*3/100;}
    function closeAt(uint64 started,uint32 duration) internal pure returns(uint64){
        uint256 end=uint256(started)+duration;if(started==0||duration==0||end>type(uint64).max)revert InvalidPolicy();return uint64(end);
    }
    /// Pure preview over authenticated host observations; not proof verification or admission.
    function windowOpen(uint64 started,uint32 duration,uint16 levelLimit,uint16 observedLevel,uint256 now_) internal pure returns(bool){
        if(started==0||duration==0||now_<started||uint256(started)+duration>type(uint64).max)return false;
        return now_<uint256(started)+duration&&(levelLimit==0||observedLevel<levelLimit);
    }
}
