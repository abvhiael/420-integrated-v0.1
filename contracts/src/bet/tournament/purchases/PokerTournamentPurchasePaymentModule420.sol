// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerTournamentPurchaseEscrowState420.sol";
contract PokerTournamentPurchasePaymentModule420 is PokerTournamentPurchaseEscrowState420 {
    address public immutable bank;
    constructor(address p,address i,bytes32 issuer_,bytes32 type_,address d,address b)PokerTournamentPurchaseEscrowState420(p,i,issuer_,type_,d){if(b==address(0))revert Invalid();bank=b;}
    modifier onlyBank(){if(address(this)!=bank)revert Unauthorized();_;}
    function purchaseLate(bytes32 id,bytes32 subject,bytes32 credential,uint64 nonce,uint256 expectedTotal,bytes32 expectedManifest)external onlyBank guarded returns(uint64){return _post(id,subject,credential,nonce,expectedTotal,expectedManifest,Kind.LATE);}
    function purchaseExtra(bytes32 id,bytes32 subject,bytes32 credential,uint64 nonce,uint256 expectedTotal,bytes32 expectedManifest)external onlyBank guarded returns(uint64){
        PokerTournamentPolicy420.PurchaseKind mode=configs[id].purchaseKind;
        if(mode==PokerTournamentPolicy420.PurchaseKind.FREEZEOUT)revert Invalid();return _post(id,subject,credential,nonce,expectedTotal,expectedManifest,mode==PokerTournamentPolicy420.PurchaseKind.REBUY?Kind.REBUY:Kind.RE_ENTRY);
    }
    function purchaseAddOn(bytes32 id,bytes32 subject,bytes32 credential,uint64 nonce,uint256 expectedTotal,bytes32 expectedManifest)external onlyBank guarded returns(uint64){return _post(id,subject,credential,nonce,expectedTotal,expectedManifest,Kind.ADD_ON);}
    function _post(bytes32 id,bytes32 subject,bytes32 credential,uint64 nonce,uint256 expectedTotal,bytes32 expectedManifest,Kind kind)private returns(uint64 index){
        EventAccount storage e=events_[id];if(!started[id]||e.state!=State.STARTING||expectedManifest!=e.manifest||gameplayHost==address(0)||gameplayHost.codehash!=hostCodeHash)revert Invalid();
        bytes32 person=_personKey(subject,credential,msg.sender);PokerTournamentPurchaseAccounting420.Quote memory q=_quote(id);
        bytes32 action=kind==Kind.LATE?ENTER:kind==Kind.ADD_ON?ADD_ON:EXTRA;_cap(id,action,q.total);
        if(pendingReceipt[id][person]!=0||nonce!=nonceOf[id][person]+1||expectedTotal!=q.total)revert Invalid();
        if(kind==Kind.LATE&&(activeReceipt[id][person]!=0||e.reservedPlayers>=configs[id].maxPlayers))revert Invalid();
        if(kind==Kind.ADD_ON&&addOnReceipt[id][person]!=0)revert Invalid();
        (bool allowed,uint32 generation,uint16 level)=IPurchaseTournamentHost420(gameplayHost).purchaseEligibility(id,person,uint8(kind));if(!allowed)revert Invalid();
        uint256 until=block.timestamp+configs[id].purchaseReadiness;if(until>type(uint64).max)revert Invalid();
        _spendCapability(id,q.total,action);nonceOf[id][person]=nonce;index=++e.receipts;
        bool queued=kind==Kind.LATE||kind==Kind.RE_ENTRY;receipts_[id][index]=Receipt(kind,queued?ReceiptStatus.QUEUED:ReceiptStatus.ACTIVATED,uint64(block.timestamp),queued?uint64(until):0,activeReceipt[id][person],generation,level);
        entries[id][index]=Entry(person,subject,msg.sender,nonce,q.prize,q.fee,q.chips,false);receiptCredential[id][index]=credential;
        if(queued)pendingReceipt[id][person]=index;else activeReceipt[id][person]=index;
        if(kind==Kind.LATE)++e.reservedPlayers;if(kind==Kind.ADD_ON)addOnReceipt[id][person]=index;
        e.prize+=q.prize;e.fees+=q.fee;e.received+=q.total;heldPrizes+=q.prize;heldFees+=q.fee;_receive(q.total);
        if(queued)IPurchaseTournamentHost420(gameplayHost).acceptPaidRequest(id,index);
        else if(kind==Kind.REBUY)IPurchaseTournamentHost420(gameplayHost).acceptRebuy(id,index);
        else IPurchaseTournamentHost420(gameplayHost).acceptAddOn(id,index);
        _emitReceipt(id,index);emit Purchased(id,index,person,subject,msg.sender,nonce,q.prize,q.fee,q.chips);
    }
    function activateQueued(bytes32 id,uint64 index)external onlyBank guarded{
        _host();Receipt storage r=receipts_[id][index];Entry storage x=entries[id][index];
        if(r.status!=ReceiptStatus.QUEUED||block.timestamp>=r.readyUntil||pendingReceipt[id][x.person]!=index||x.refunded)revert Invalid();
        r.status=ReceiptStatus.ACTIVATED;delete pendingReceipt[id][x.person];activeReceipt[id][x.person]=index;
        IPurchaseTournamentHost420(gameplayHost).discardPaidRequest(id,index);_emitReceipt(id,index);
    }
    function refundUnseated(bytes32 id,uint64 index)external onlyBank guarded{
        Receipt storage r=receipts_[id][index];Entry storage x=entries[id][index];EventAccount storage e=events_[id];
        if(r.status!=ReceiptStatus.QUEUED||pendingReceipt[id][x.person]!=index||x.refunded||gameplayHost.codehash!=hostCodeHash)revert Invalid();
        if(block.timestamp<r.readyUntil&&!IPurchaseTournamentHost420(gameplayHost).canRefundRequest(id,index))revert Invalid();
        r.status=ReceiptStatus.REFUNDED;x.refunded=true;delete pendingReceipt[id][x.person];if(r.kind==Kind.LATE)--e.reservedPlayers;
        e.prize-=x.buyIn;e.fees-=x.fee;heldPrizes-=x.buyIn;heldFees-=x.fee;_credit(id,x.payer,x.buyIn+x.fee);
        IPurchaseTournamentHost420(gameplayHost).discardPaidRequest(id,index);_emitReceipt(id,index);_solvent();emit Refunded(id,index,x.payer,x.buyIn+x.fee);
    }
}
