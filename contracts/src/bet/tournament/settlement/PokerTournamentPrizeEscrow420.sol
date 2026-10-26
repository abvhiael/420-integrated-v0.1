// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../purchases/PokerTournamentPurchasePaymentFactory420.sol";
import "./PokerTournamentFinanceFactories420.sol";
/// @notice Versioned C7 custody, deterministic prizes and full-refund recovery; no upgrade endpoint.
contract PokerTournamentPrizeEscrow420 is PokerTournamentFinanceState420 {
    address public immutable paymentModule;bytes32 public immutable paymentCodeHash;
    address public immutable prizeModule;bytes32 public immutable prizeCodeHash;
    address public immutable refundModule;bytes32 public immutable refundCodeHash;
    constructor(address p,address i,bytes32 issuer_,bytes32 type_,address d,address f)PokerTournamentFinanceState420(p,i,issuer_,type_,d,f){
        paymentModule=PokerTournamentPurchasePaymentFactory420.deploy(p,i,issuer_,type_,d,address(this));paymentCodeHash=paymentModule.codehash;
        prizeModule=PokerTournamentPrizeFactory420.deploy(p,i,issuer_,type_,d,f,address(this));prizeCodeHash=prizeModule.codehash;
        refundModule=PokerTournamentRefundFactory420.deploy(p,i,issuer_,type_,d,f,address(this));refundCodeHash=refundModule.codehash;
    }
    function scope(bytes32 id)public view returns(bytes32){return _scope(id);}
    function eventOf(bytes32 id)external view returns(EventAccount memory){return _eventOf(id);}
    function entryOf(bytes32 id,uint64 index)external view returns(Entry memory){return _entryOf(id,index);}
    function configOf(bytes32 id)external view returns(PokerTournamentPolicy420.Config memory){return _configOf(id);}
    function quote(bytes32 id)public view returns(PokerTournamentPurchaseAccounting420.Quote memory){return _quote(id);}
    function personKey(bytes32 subject,bytes32 credential,address actor)public view returns(bytes32){return _personKey(subject,credential,actor);}
    function receiptOf(bytes32 id,uint64 index)external view returns(Receipt memory){return _receiptOf(id,index);}
    function create(bytes32 id,bytes32 policyId) external guarded {
        _cap(id,CREATE,0);bytes32 payoutDigest=_checkTerms(policyId);
        bytes32 plan=purchasePolicies.planForPolicy(policyId);PokerTournamentPurchasePolicies420.Record memory terms=purchasePolicies.get(plan);
        if(terms.status!=PokerTournamentPurchasePolicies420.Status.PUBLISHED||terms.basePolicy!=policyId)revert Invalid();purchasePlan[id]=plan;
        if(id==0||events_[id].state!=State.NONE||!policies.usableForNewEvent(policyId))revert Invalid();
        PokerTournamentPolicyRegistry420.Record memory r=policies.get(policyId);
        if(msg.sender!=r.publisher||block.timestamp>=r.config.registrationOpens)revert Unauthorized();
        _cap(id,CREATE,r.config.sponsoredPrize);
        EventAccount storage e=events_[id];e.state=State.REGISTRATION;e.policy=policyId;e.funder=msg.sender;
        e.manifest=keccak256(abi.encode(DOMAIN,block.chainid,address(this),id,policyId,r.digest,asset,developmentFund,address(identities),issuer,credentialType,plan,terms.digest,FINANCIAL_DOMAIN,address(prizePolicies),payoutDigest,gameplayHost,hostCodeHash));
        ++createdEvents;configs[id]=r.config;e.prize=r.config.sponsoredPrize;e.sponsored=r.config.sponsoredPrize;
        e.received=e.sponsored;heldPrizes+=e.sponsored;_receive(e.sponsored);
        emit Created(id,e.manifest,policyId,msg.sender,e.sponsored);
    }
    function purchase(bytes32 id,bytes32 subject,bytes32 credential,uint64 nonce,uint256 expectedTotal,bytes32 expectedManifest)
        external guarded returns(uint64 index)
    {
        _sync(id);EventAccount storage e=events_[id];PokerTournamentPolicy420.Config storage c=configs[id];
        if((e.state!=State.REGISTRATION&&e.state!=State.DELAYED)||block.timestamp<c.registrationOpens||
            expectedManifest!=e.manifest||e.reservedPlayers>=c.maxPlayers)revert Invalid();
        if(!policies.usableForNewEvent(e.policy))revert Unauthorized();_newMoney(id);
        bytes32 person=personKey(subject,credential,msg.sender);
        PokerTournamentPurchaseAccounting420.Quote memory q=quote(id);_cap(id,ENTER,q.total);
        if(activeReceipt[id][person]!=0||pendingReceipt[id][person]!=0||nonce!=nonceOf[id][person]+1||expectedTotal!=q.total)revert Invalid();
        _spendCapability(id,q.total,ENTER);
        nonceOf[id][person]=nonce;index=++e.receipts;
        entries[id][index]=Entry(person,subject,msg.sender,nonce,q.prize,q.fee,q.chips,false);receiptCredential[id][index]=credential;
        activeReceipt[id][person]=index;++e.reservedPlayers;e.prize+=q.prize;e.fees+=q.fee;e.received+=q.total;
        heldPrizes+=q.prize;heldFees+=q.fee;_sync(id);_receive(q.total);
        receipts_[id][index]=Receipt(Kind.INITIAL,ReceiptStatus.ACTIVATED,uint64(block.timestamp),0,0,1,0);
        _emitReceipt(id,index);emit Purchased(id,index,person,subject,msg.sender,nonce,q.prize,q.fee,q.chips);
    }
    function unregister(bytes32 id,uint64 index,uint64 expectedNonce) external guarded {
        _sync(id);State s=events_[id].state;Entry storage x=entries[id][index];
        if((s!=State.REGISTRATION&&s!=State.DELAYED)||x.payer!=msg.sender||x.nonce!=expectedNonce)revert Unauthorized();
        _refund(id,index);
    }
    function tick(bytes32 id) external guarded {_sync(id);}
    function _sync(bytes32 id) private {
        EventAccount storage e=events_[id];PokerTournamentPolicy420.Config storage c=configs[id];
        if(e.state==State.NONE)revert Invalid();
        if(e.state==State.REGISTRATION){
            bool sng=c.startKind==PokerTournamentPolicy420.StartKind.SIT_AND_GO;
            if(sng&&e.reservedPlayers>=c.startingTarget)_ready(id,uint64(block.timestamp));
            else if(block.timestamp>=c.startOrRegistrationDeadline){
                if(!sng&&e.reservedPlayers>=c.minimum)_ready(id,c.startOrRegistrationDeadline);
                else {e.state=State.DELAYED;emit StateChanged(id,e.state,0);}
            }
        }
        if(e.state==State.DELAYED){
            uint256 end=uint256(c.startOrRegistrationDeadline)+c.underfillGrace;
            if(block.timestamp>=end)_cancel(id);
            else if(e.reservedPlayers>=(c.startKind==PokerTournamentPolicy420.StartKind.SIT_AND_GO?c.startingTarget:c.minimum))_ready(id,uint64(block.timestamp));
        }
        // Only genuine host activation disables the original unstarted-event timeout.
        if(e.state==State.STARTING&&!started[id]&&block.timestamp>=uint256(e.readyAt)+c.technicalGrace)_cancel(id);
    }
    function _ready(bytes32 id,uint64 at_) private {EventAccount storage e=events_[id];e.state=State.STARTING;e.readyAt=at_;emit StateChanged(id,e.state,at_);}
    function _cancel(bytes32 id) private {
        EventAccount storage e=events_[id];e.state=State.CANCELLED;
        uint256 sponsor=e.sponsored;e.sponsored=0;e.prize-=sponsor;heldPrizes-=sponsor;_credit(id,e.funder,sponsor);
        emit StateChanged(id,e.state,e.readyAt);
    }
    function refundCancelled(bytes32 id,uint64 index) external guarded {
        _sync(id);if(started[id])revert GameplayIntegrationRequired();if(events_[id].state!=State.CANCELLED)revert Invalid();_refund(id,index);
    }
    function _refund(bytes32 id,uint64 index) private {
        Entry storage x=entries[id][index];EventAccount storage e=events_[id];
        if(x.payer==address(0)||x.refunded||activeReceipt[id][x.person]!=index)revert Invalid();
        if(receipts_[id][index].kind!=Kind.INITIAL||receipts_[id][index].status!=ReceiptStatus.ACTIVATED)revert Invalid();
        x.refunded=true;receipts_[id][index].status=ReceiptStatus.REFUNDED;delete activeReceipt[id][x.person];--e.reservedPlayers;
        e.prize-=x.buyIn;e.fees-=x.fee;heldPrizes-=x.buyIn;heldFees-=x.fee;
        _credit(id,x.payer,x.buyIn+x.fee);_emitReceipt(id,index);emit Refunded(id,index,x.payer,x.buyIn+x.fee);
    }
    function withdraw() external guarded {
        uint256 amount=credit[msg.sender];if(amount==0)revert Invalid();
        credit[msg.sender]=0;totalCredits-=amount;totalLiability-=amount;totalWithdrawn+=amount;
        ITournamentPurchaseAsset420 t=ITournamentPurchaseAsset420(asset);uint256 before_=t.balanceOf(address(this));uint256 recipient=t.balanceOf(msg.sender);
        if(!t.transfer(msg.sender,amount)||t.balanceOf(address(this))+amount!=before_||t.balanceOf(msg.sender)!=recipient+amount)revert TransferFailed();
        _solvent();emit Withdrawn(msg.sender,amount);
    }
    function solvent() external view returns(bool){_solvent();return true;}
    function bindHost(address host) external guarded {
        if(gameplayHost!=address(0)||createdEvents!=0||host.code.length==0||!authorization.isAuthorized(msg.sender,BIND_HOST,authorization.scopeGlobal(),0)||IPurchaseTournamentHost420(host).escrow()!=address(this))revert Unauthorized();
        gameplayHost=host;hostCodeHash=host.codehash;
    }
    function confirmStarted(bytes32 id,bytes32 hand) external guarded {
        _host();_sync(id);EventAccount storage e=events_[id];
        if(started[id]||e.state!=State.STARTING||block.timestamp>=uint256(e.readyAt)+configs[id].technicalGrace||!IPurchaseTournamentHost420(gameplayHost).genuineStartedHand(id,hand))revert Invalid();
        started[id]=true;
    }
    function gameplayPurchasesEnabled() external view returns(bool){return gameplayHost!=address(0);}
    function admittedUniquePlayers(bytes32 id)external view returns(uint32){return gameplayHost==address(0)?0:IPurchaseTournamentHost420(gameplayHost).admittedUniquePlayers(id);}
    function purchaseLate(bytes32 id,bytes32 subject,bytes32 credential,uint64 nonce,uint256 expectedTotal,bytes32 expectedManifest)external returns(uint64){_payment();}
    function purchaseExtra(bytes32 id,bytes32 subject,bytes32 credential,uint64 nonce,uint256 expectedTotal,bytes32 expectedManifest)external returns(uint64){_payment();}
    function purchaseAddOn(bytes32 id,bytes32 subject,bytes32 credential,uint64 nonce,uint256 expectedTotal,bytes32 expectedManifest)external returns(uint64){_payment();}
    function activateQueued(bytes32 id,uint64 index)external{_payment();}
    function refundUnseated(bytes32 id,uint64 index)external{_payment();}
    function _payment()private{
        address target=paymentModule;if(target.codehash!=paymentCodeHash)revert Invalid();
        assembly("memory-safe"){let p:=mload(0x40) calldatacopy(p,0,calldatasize()) let ok:=delegatecall(gas(),target,p,calldatasize(),0,0) returndatacopy(p,0,returndatasize()) if iszero(ok){revert(p,returndatasize())} return(p,returndatasize())}
    }    function beginPrizes(bytes32 id)external{_finance(prizeModule,prizeCodeHash);}
    function loadPrizes(bytes32 id,uint32 limit)external{_finance(prizeModule,prizeCodeHash);}
    function allocatePrizes(bytes32 id,uint32 limit)external{_finance(prizeModule,prizeCodeHash);}
    function claimPrize(bytes32 id,bytes32 person)external{_finance(prizeModule,prizeCodeHash);}
    function checkpointRecovery(bytes32 id)external{_finance(refundModule,refundCodeHash);}
    function beginFullRefund(bytes32 id)external{_finance(refundModule,refundCodeHash);}
    function processRefunds(bytes32 id,uint32 limit)external{_finance(refundModule,refundCodeHash);}
    function financialState(bytes32 id)external view returns(Mode mode,uint32 unique,uint32 loaded,uint32 allocated,uint32 claims,uint64 refundCursor,uint64 receiptEnd,uint64 recoveryDeadline,bytes32 root){Financial storage f=_financial().events[id];return(f.mode,f.unique,f.loaded,f.allocated,f.positiveClaims,f.refundCursor,f.receiptEnd,f.recoveryDeadline,f.financialRoot);}
    function prizeRow(bytes32 id,bytes32 person)external view returns(PokerTournamentPrizeMath420.Row memory){Financial storage f=_financial().events[id];uint32 index=f.index[person];if(index==0)revert Invalid();return f.rows[index-1];}
    function _finance(address target,bytes32 codeHash)private{if(target.codehash!=codeHash)revert Invalid();assembly("memory-safe"){let p:=mload(0x40) calldatacopy(p,0,calldatasize()) let ok:=delegatecall(gas(),target,p,calldatasize(),0,0) returndatacopy(p,0,returndatasize()) if iszero(ok){revert(p,returndatasize())}return(p,returndatasize())}}

}
