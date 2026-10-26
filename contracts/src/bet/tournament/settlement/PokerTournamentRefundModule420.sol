// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerTournamentFinanceState420.sol";
import "../PokerTournamentRoundEntropy420.sol";
contract PokerTournamentRefundModule420 is PokerTournamentFinanceModule420 {
    constructor(address p,address i,bytes32 issuer_,bytes32 type_,address d,address f,address b)PokerTournamentFinanceModule420(p,i,issuer_,type_,d,f,b){}
    function checkpointRecovery(bytes32 id)external onlyBank guarded{_checkpoint(id);}
    function _checkpoint(bytes32 id)private{
        Financial storage f=_financial().events[id];PokerTournamentPrizeHost420 h=_hostView();(PokerTournamentHostState420.Phase phase,,,,,,)=h.eventState(id);(,,,,bool finished,,,,)=h.standingsState(id);
        if(f.mode!=Mode.NONE||!started[id]||finished||phase!=PokerTournamentHostState420.Phase.RECOVERY_REQUIRED||configs[id].recoveryPolicy!=prizePolicies.FULL_REFUND())revert Invalid();
        uint64 anchor=_canonicalAnchor(id,h);uint256 end=uint256(anchor)+configs[id].recoveryGrace;if(end>type(uint64).max)revert Invalid();
        // Earlier authenticated failure evidence may shorten the bound; no caller can extend it.
        if(f.recoveryDeadline==0||anchor<f.recoveryAnchor){f.recoveryAnchor=anchor;f.recoveryDeadline=uint64(end);emit C7RecoveryCheckpoint(id,anchor,f.recoveryDeadline);}

    }
    function _minimum(uint64 current,uint256 candidate)private view returns(uint64){if(candidate==0||candidate>block.timestamp||candidate>type(uint64).max)return current;return current==0||candidate<current?uint64(candidate):current;}
    function _canonicalAnchor(bytes32 id,PokerTournamentPrizeHost420 h)private view returns(uint64 anchor){
        (,,,anchor)=h.financialFacts(id);PokerTournamentRoundEntropy420 entropy=PokerTournamentRoundEntropy420(h.roundEntropy());bytes32 purpose=h.eventPurpose(id);PokerTournamentRoundEntropy420.Round memory round=entropy.roundOf(purpose);
        if(entropy.preparationExpired(purpose))anchor=_minimum(anchor,uint256(round.preparedAt)+3600);
        if(round.requestId!=0&&entropy.expired(round.requestId))anchor=_minimum(anchor,entropy.router().request(round.requestId).deadline);
        uint16 tables=configs[id].maxTables;if(tables==0||tables>64)revert Invalid();PokerTournamentNLHE420 engine=PokerTournamentNLHE420(h.nativeEngine());
        for(uint32 table=1;table<=tables;table++){bytes32 hand=h.financialHand(id,table);if(hand==0)continue;PokerTournamentHostState420.Frozen memory f=h.frozenHand(hand);if(!f.aborted)continue;
            if(f.eventId!=id||!f.reserved||!h.handConsumed(hand)||!engine.handAborted(hand))revert Invalid();(,uint64 finalizableAt,,,)=engine.evidenceRecovery(hand);anchor=_minimum(anchor,finalizableAt!=0?finalizableAt:engine.fundedEvidenceDeadline(hand));
        }
        if(anchor==0||anchor>block.timestamp)revert Invalid();
    }
    function beginFullRefund(bytes32 id)external onlyBank guarded{
        _checkpoint(id);Financial storage f=_financial().events[id];(uint32 hands,uint32 pending,uint32 queued,)=_hostView().financialFacts(id);if(block.timestamp<f.recoveryDeadline||hands!=0||pending!=0||queued!=0)revert Invalid();EventAccount storage e=events_[id];if(e.state!=State.STARTING)revert Invalid();
        f.mode=Mode.REFUNDING;f.receiptEnd=e.receipts;f.refundCursor=0;f.prize=e.prize;f.fees=e.fees;f.financialRoot=keccak256(abi.encode(FINANCIAL_DOMAIN,id,e.manifest,prizePolicies.FULL_REFUND(),f.recoveryAnchor,f.recoveryDeadline,f.receiptEnd,e.prize,e.fees));e.state=State.CANCELLED;
        uint256 sponsor=e.sponsored;e.sponsored=0;e.prize-=sponsor;heldPrizes-=sponsor;_credit(id,e.funder,sponsor);emit C7FinancialCredit(id,3,0,0,e.funder,sponsor,0);_solvent();emit C7FinancialState(id,uint8(f.mode),f.financialRoot,f.prize,f.fees);
    }
    function processRefunds(bytes32 id,uint32 limit)external onlyBank guarded{
        Financial storage f=_financial().events[id];if(f.mode!=Mode.REFUNDING||limit==0||limit>32)revert Invalid();EventAccount storage e=events_[id];
        for(uint32 n;n<limit&&f.refundCursor<f.receiptEnd;n++){
            uint64 index=++f.refundCursor;Entry storage x=entries[id][index];if(x.payer==address(0))revert Invalid();if(x.refunded)continue;Receipt storage r=receipts_[id][index];if(r.status!=ReceiptStatus.ACTIVATED)revert Invalid();
            x.refunded=true;r.status=ReceiptStatus.REFUNDED;if(activeReceipt[id][x.person]==index){delete activeReceipt[id][x.person];--e.reservedPlayers;}
            e.prize-=x.buyIn;e.fees-=x.fee;heldPrizes-=x.buyIn;heldFees-=x.fee;_credit(id,x.payer,x.buyIn+x.fee);_emitReceipt(id,index);emit C7FinancialCredit(id,2,x.person,index,x.payer,x.buyIn,x.fee);
        }
        if(f.refundCursor==f.receiptEnd){if(e.prize!=0||e.fees!=0||e.reservedPlayers!=0)revert Invalid();f.mode=Mode.REFUNDED;emit C7FinancialState(id,uint8(f.mode),f.financialRoot,0,0);}_solvent();
    }
}
