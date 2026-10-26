// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerTournamentPrizeEscrow420.sol";
/// @notice Stateless bounded orchestration; no custody, amount vectors or privileged authority.
contract PokerTournamentFinancialKeeper420 {
    error Invalid();
    PokerTournamentPrizeEscrow420 public immutable bank;PokerTournamentPrizeHost420 public immutable host;
    constructor(address b){bank=PokerTournamentPrizeEscrow420(b);host=PokerTournamentPrizeHost420(bank.gameplayHost());if(address(host)==address(0)||address(host.escrow())!=b)revert Invalid();}
    function drainRecoveryQueue(bytes32 id,uint32 limit)external{if(limit==0||limit>16)revert Invalid();(PokerTournamentHostState420.Phase phase,,,,,,)=host.eventState(id);if(phase!=PokerTournamentHostState420.Phase.RECOVERY_REQUIRED)revert Invalid();for(uint32 i;i<limit;i++){uint64 head=host.queuedHead(id);if(head==0)break;bank.refundUnseated(id,head);}}
    function expireRecoveryChoices(bytes32 id,uint32 cursor,uint32 limit)external returns(uint32){if(limit==0||limit>16)revert Invalid();(PokerTournamentHostState420.Phase phase,,,,,,)=host.eventState(id);if(phase!=PokerTournamentHostState420.Phase.RECOVERY_REQUIRED)revert Invalid();(,,,,,,,,uint32 unique)=host.standingsState(id);for(uint32 n;n<limit&&cursor<unique;n++){bytes32 person=host.standingsPersonAt(id,cursor++);(PokerTournamentStandings420.Person memory p,,)=host.standing(id,person);if(p.status==PokerTournamentStandings420.Status.REBUY_PENDING&&block.timestamp>=p.rebuyUntil)host.expireRebuy(id,person);}return cursor;}
}
