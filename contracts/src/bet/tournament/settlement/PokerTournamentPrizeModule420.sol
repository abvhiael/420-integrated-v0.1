// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerTournamentFinanceState420.sol";
contract PokerTournamentPrizeModule420 is PokerTournamentFinanceModule420 {
    constructor(address p,address i,bytes32 issuer_,bytes32 type_,address d,address f,address b)PokerTournamentFinanceModule420(p,i,issuer_,type_,d,f,b){}
    function beginPrizes(bytes32 id)external onlyBank guarded{
        Financial storage f=_financial().events[id];if(f.mode!=Mode.NONE)revert Invalid();(bytes32 context,bytes32 root,uint32 unique)=_complete(id);EventAccount storage e=events_[id];
        prizePolicies.select(configs[id].payoutPolicy,unique);f.mode=Mode.LOADING;f.unique=unique;f.prize=e.prize;f.fees=e.fees;f.standingsRoot=root;f.receiptEnd=e.receipts;
        f.financialRoot=keccak256(abi.encode(FINANCIAL_DOMAIN,block.chainid,address(this),id,e.manifest,context,root,_checkTerms(e.policy),unique,e.prize,e.fees,developmentFund));emit C7FinancialState(id,uint8(f.mode),f.financialRoot,f.prize,f.fees);
    }
    function loadPrizes(bytes32 id,uint32 limit)external onlyBank guarded{
        Financial storage f=_financial().events[id];if(f.mode!=Mode.LOADING||limit==0||limit>16)revert Invalid();(,bytes32 root,uint32 unique)=_complete(id);if(root!=f.standingsRoot||unique!=f.unique)revert Invalid();PokerTournamentPrizeHost420 h=_hostView();
        for(uint32 n;n<limit&&f.loaded<f.unique;n++){
            bytes32 person=h.standingsPersonAt(id,f.loaded);(PokerTournamentStandings420.Person memory p,uint32 first,uint32 last)=h.standing(id,person);Entry storage x=entries[id][p.receipt];
            if(person==0||f.index[person]!=0||first==0||last<first||last>unique||x.person!=person||x.payer==address(0)||x.refunded||receipts_[id][p.receipt].status!=ReceiptStatus.ACTIVATED||activeReceipt[id][person]!=p.receipt||(p.status!=PokerTournamentStandings420.Status.CHAMPION&&p.status!=PokerTournamentStandings420.Status.ELIMINATED))revert Invalid();
            f.rows.push(PokerTournamentPrizeMath420.Row(person,x.payer,p.receipt,first,last,keccak256(abi.encode(FINANCIAL_DOMAIN,id,events_[id].manifest,person)),0,false));f.index[person]=++f.loaded;
        }
        if(f.loaded==f.unique)f.mode=Mode.ALLOCATING;
    }
    function allocatePrizes(bytes32 id,uint32 limit)external onlyBank guarded{
        Financial storage f=_financial().events[id];if(f.mode!=Mode.ALLOCATING||limit==0||limit>8)revert Invalid();uint16[] memory weights=prizePolicies.select(configs[id].payoutPolicy,f.unique);uint256 remainder=PokerTournamentPrizeMath420.dust(f.prize,weights);PokerTournamentPrizeMath420.Rank[] memory snapshot=PokerTournamentPrizeMath420.snapshot(f.rows);
        for(uint32 n;n<limit&&f.allocated<f.unique;n++){
            uint32 index=f.allocated++;PokerTournamentPrizeMath420.Row storage r=f.rows[index];r.amount=PokerTournamentPrizeMath420.assign(snapshot,index,f.prize,weights,remainder);f.allocatedSum+=r.amount;if(r.amount!=0)f.positiveClaims++;
            f.financialRoot=keccak256(abi.encode(f.financialRoot,r.person,r.payee,r.receipt,r.first,r.last,r.amount));emit C7PrizeRow(id,r.person,r.payee,r.receipt,r.first,r.last,r.amount,f.financialRoot);
        }
        if(f.allocated==f.unique){EventAccount storage e=events_[id];if(f.allocatedSum!=f.prize||e.prize!=f.prize||e.fees!=f.fees)revert Invalid();e.fees=0;e.sponsored=0;heldFees-=f.fees;_credit(id,developmentFund,f.fees);emit C7FinancialCredit(id,1,0,0,developmentFund,0,f.fees);f.mode=f.prize==0?Mode.PAID:Mode.CLAIMABLE;_solvent();emit C7FinancialState(id,uint8(f.mode),f.financialRoot,f.prize,f.fees);}
    }
    function claimPrize(bytes32 id,bytes32 person)external onlyBank guarded{
        Financial storage f=_financial().events[id];uint32 index=f.index[person];if((f.mode!=Mode.CLAIMABLE&&f.mode!=Mode.PAID)||index==0)revert Invalid();PokerTournamentPrizeMath420.Row storage r=f.rows[index-1];if(r.claimed)revert Invalid();r.claimed=true;
        if(r.amount!=0){events_[id].prize-=r.amount;heldPrizes-=r.amount;_credit(id,r.payee,r.amount);--f.positiveClaims;}
        emit C7FinancialCredit(id,0,r.person,r.receipt,r.payee,r.amount,0);if(events_[id].prize==0){if(f.positiveClaims!=0)revert Invalid();f.mode=Mode.PAID;}_solvent();
    }
}
