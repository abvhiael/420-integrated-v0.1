// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./FantasySeasonScores420.sol";
import "./FantasySeasonActions420.sol";
import "./FantasyAdmission420.sol";
import "./FantasyDisputeController420.sol";
import "./FantasyRankingBook420.sol";
import "./FantasyPayoutPolicy420.sol";
import "../../interfaces/IRandomnessRouter420.sol";
import "../../revenue/DevelopmentCompensationVault420.sol";

/// @notice Canonical season escrow; weekly dispute finality is required for season payout.
contract FantasySeasonEscrow420 is IFantasyDisputeHost420,IFantasySeasonCorrection420{
    bytes32 public constant DOMAIN=keccak256("420.FANTASY.SEASON.ESCROW.V1");
    bytes32 public constant CREATE=keccak256("BET_FANTASY_CREATE_SEASON.V1");
    FantasySeasonData420 public immutable data;
    FantasySeasonRoster420 public immutable roster;
    FantasySeasonScores420 public immutable scores;
    FantasyDisputeController420 public immutable disputes;
    FantasyAdmission420 public immutable admission;
    IRandomnessRouter420 public immutable randomness;
    FantasyRankingBook420 public immutable rankings;
    FantasyPayoutPolicy420 public immutable payouts;
    FantasySeasonActions420 public immutable actions;
    FantasySeasonTransactions420 public immutable transactions;
    address public immutable asset;address public immutable devFund;
    enum State{NONE,FUNDING,ACTIVE,REVIEW,SETTLED,CANCELED}
    struct Pool{State state;bytes32 manifest;bytes32 launcher;address launcherAccount;uint256 entryFee;uint256 prize;uint256 gross;uint256 fee;bytes32 request;uint64 rankRevision;bytes32 candidate;}
    mapping(bytes32=>Pool) private pools;
    mapping(bytes32=>mapping(bytes32=>uint8)) public memberForSubject;
    mapping(bytes32=>mapping(bytes32=>uint8)) public memberForUser;
    mapping(bytes32=>bytes32) public parentPool;
    mapping(bytes32=>uint16) public childWeek;
    mapping(bytes32=>mapping(uint16=>bytes32)) public publishedWeek;
    mapping(bytes32=>mapping(uint16=>uint64)) public weekRevision;
    mapping(bytes32=>mapping(uint8=>bool)) public claimed;
    mapping(address=>uint256) public credit;
    uint256 public totalLiability;uint256 private entered;
    error Invalid();
    event Created(bytes32 indexed id,bytes32 manifest);
    event Funded(bytes32 indexed id,uint8 indexed member,bytes32 subject,address beneficiary);
    event RandomDraft(bytes32 indexed id,bytes32 indexed request,bytes32 purpose);
    event Closed(bytes32 indexed id,bool canceled);
    constructor(address data_,address roster_,address scores_,address disputes_,address admission_,address random_,address dev_,address actions_){
        data=FantasySeasonData420(data_);roster=FantasySeasonRoster420(roster_);scores=FantasySeasonScores420(scores_);disputes=FantasyDisputeController420(disputes_);admission=FantasyAdmission420(admission_);randomness=IRandomnessRouter420(random_);
        if(address(roster.data())!=data_||address(scores.data())!=data_||address(scores.roster())!=roster_||address(data.authorization())!=address(disputes.authorization())||address(data.oracle())!=address(disputes.oracle())||address(admission.identities())!=address(disputes.identities())||random_.code.length==0)revert Invalid();
        asset=disputes.asset();if(asset==address(0))revert Invalid();
        DevelopmentCompensationVault420 vault=DevelopmentCompensationVault420(payable(dev_));if(address(vault.capabilityRegistry())!=address(disputes.authorization().capabilityRegistry()))revert Invalid();devFund=vault.beneficiary();
        if(devFund==address(0)||devFund==address(this))revert Invalid();rankings=new FantasyRankingBook420(address(this));payouts=new FantasyPayoutPolicy420(address(this));actions=FantasySeasonActions420(actions_);transactions=actions.transactions();if(address(actions.data())!=data_||address(actions.roster())!=roster_||address(actions.admission())!=admission_)revert Invalid();
    }
    modifier guarded(){if(entered!=0)revert Invalid();entered=1;_;entered=0;}
    function poolOf(bytes32 id) external view returns(Pool memory){return pools[id];}
    function stateOf(bytes32 id) external view returns(uint8){return uint8(pools[id].state);}
    function manifestOf(bytes32 id) external view returns(bytes32){return pools[id].manifest;}
    function launcherOf(bytes32 id) external view returns(bytes32){return pools[id].launcher;}
    function weekDisputeId(bytes32 id,uint16 week) public view returns(bytes32){return keccak256(abi.encode(DOMAIN,block.chainid,address(this),id,week));}
    function _receive(uint256 amount) private{
        uint256 before_=IFantasyBondToken420(asset).balanceOf(address(this));if(amount!=0&&!IFantasyBondToken420(asset).transferFrom(msg.sender,address(this),amount))revert Invalid();
        if(IFantasyBondToken420(asset).balanceOf(address(this))!=before_+amount)revert Invalid();totalLiability+=amount;
    }
    function _register(bytes32 id,bytes32 parent,bytes32 feed) private{
        Pool storage p=pools[parent];disputes.registerPool(id,FantasyDisputeController420.Config(address(this),p.manifest,FantasyTypes420.DATA_POLICY,data.manifest(parent),feed,p.entryFee,p.prize,p.entryFee!=0));
    }
    function create(bytes32 id,bytes32 launcher,uint256 fee,uint256 prize,bytes calldata bands) external guarded{
        BetAuthorization420 auth=disputes.authorization();admission.requireController(launcher,msg.sender);
        if(!auth.isAuthorized(msg.sender,CREATE,auth.scopeGlobal(),0)||admission.currentUserKey(launcher)==0||pools[id].state!=State.NONE||!data.isSealed(id)||!roster.leagueOf(id).configured||roster.host()!=address(this)||data.host()!=address(this)||(fee!=0&&prize!=0)||block.timestamp>=data.configOf(id).fundingEnd)revert Invalid();
        Pool storage p=pools[id];p.state=State.FUNDING;p.launcher=launcher;p.launcherAccount=msg.sender;p.entryFee=fee;p.prize=prize;p.gross=prize;
        p.manifest=keccak256(abi.encode(DOMAIN,block.chainid,address(this),id,data.manifest(id),launcher,fee,prize,bands,address(randomness),devFund));
        payouts.register(id,data.configOf(id).teams,bands);
        for(uint16 w=1;w<=data.configOf(id).periodCount;w++){
            bytes32 child=weekDisputeId(id,w);parentPool[child]=id;childWeek[child]=w;_register(child,id,data.periodOf(id,w).candidateFeed);
        }
        _receive(prize);emit Created(id,p.manifest);
    }
    function join(bytes32 id,bytes32 subject,bytes32 credential) external guarded returns(uint8 m){
        Pool storage p=pools[id];FantasySeasonData420.Config memory c=data.configOf(id);bytes32 key=admission.requireUser(subject,credential,msg.sender,id,p.entryFee);
        if(p.state!=State.FUNDING||block.timestamp>=c.fundingEnd||memberForSubject[id][subject]!=0||memberForUser[id][key]!=0||key==c.custodianUserKey)revert Invalid();
        admission.registerIdentity(subject,credential);m=roster.join(id,subject,key,msg.sender);memberForSubject[id][subject]=m;memberForUser[id][key]=m;p.gross+=p.entryFee;_receive(p.entryFee);emit Funded(id,m,subject,msg.sender);
    }
    function draftPurpose(bytes32 id) public view returns(bytes32 purpose){
        purpose=keccak256(abi.encode(DOMAIN,id,pools[id].manifest));for(uint8 m=1;m<=roster.leagueOf(id).count;m++){
            FantasySeasonRoster420.Member memory member=roster.memberOf(id,m);purpose=keccak256(abi.encode(purpose,m,member.subject,member.userKey,member.controller));
        }
    }
    function requestDraft(bytes32 id) external guarded{
        Pool storage p=pools[id];FantasySeasonData420.Config memory c=data.configOf(id);
        if(p.state!=State.FUNDING||p.request!=0||roster.leagueOf(id).count!=c.teams||block.timestamp<c.fundingEnd||block.timestamp>=c.draftStart)revert Invalid();
        bytes32 purpose=draftPurpose(id);p.request=randomness.requestRandomness(c.randomnessProfile,keccak256("420.RANDOM.DOMAIN.BET.V1"),purpose,c.draftStart-1);emit RandomDraft(id,p.request,purpose);
    }
    function startDraft(bytes32 id) external guarded{
        Pool storage p=pools[id];if(p.state!=State.FUNDING||p.request==0||randomness.status(p.request)!=IRandomnessRouter420.Status.FULFILLED)revert Invalid();
        (bytes32 root,bytes32 proofHash)=randomness.result(p.request);roster.start(id,root,proofHash);p.state=State.ACTIVE;
    }
    function weekCandidate(bytes32 id,uint16 week) public view returns(FantasyDisputeController420.Candidate memory){
        FantasySeasonData420.Report memory r=data.reportOf(id,week);return FantasyDisputeController420.Candidate(r.root,scores.weekRoot(id,week),r.evidence,r.asOf,r.revision);
    }
    function publishWeek(bytes32 id,uint16 week) external guarded{
        if(pools[id].state!=State.ACTIVE)revert Invalid();bytes32 child=weekDisputeId(id,week);FantasyDisputeController420.Pool memory d=disputes.poolOf(child);
        if(d.state==FantasyDisputeController420.PoolState.REGISTERED)disputes.startCorrection(child,data.periodOf(id,week).cutoff);
        FantasyDisputeController420.Candidate memory c=weekCandidate(id,week);disputes.publishCandidate(child,c);publishedWeek[id][week]=disputes.candidateDigest(child,c);weekRevision[id][week]=c.revision;
    }
    function mayCorrect(bytes32 id,uint16 week) external view returns(bool){
        FantasyDisputeController420.Pool memory d=disputes.poolOf(weekDisputeId(id,week));
        return pools[id].state==State.ACTIVE&&d.state==FantasyDisputeController420.PoolState.REVIEW&&d.invalidated&&d.pending==0&&block.timestamp>=d.challengeEnd&&block.timestamp+1 days<=d.deadline;
    }
    function candidateIsCurrent(bytes32 id,bytes32 candidate) external view returns(bool){
        bytes32 parent=parentPool[id];
        if(parent!=0){uint16 week=childWeek[id];bool finalized=disputes.poolOf(id).state==FantasyDisputeController420.PoolState.FINAL;return pools[parent].state==State.ACTIVE&&!data.seasonCanceled(parent)&&publishedWeek[parent][week]==candidate&&weekRevision[parent][week]==data.reportOf(parent,week).revision&&scores.weekReady(parent,week)&&(finalized||data.reportIsCurrent(parent,week));}
        return pools[id].state==State.REVIEW&&pools[id].candidate==candidate&&_allFinal(id);
    }
    function _allFinal(bytes32 id) private view returns(bool){
        for(uint16 w=1;w<=data.configOf(id).periodCount;w++)if(!disputes.canSettle(weekDisputeId(id,w)))return false;return true;
    }
    function isEntrant(bytes32 id,bytes32 subject) external view returns(bool){bytes32 parent=parentPool[id];return memberForSubject[parent==0?id:parent][subject]!=0;}
    function isInterested(bytes32 id,bytes32 subject) external view returns(bool){
        bytes32 parent=parentPool[id];if(parent==0)parent=id;bytes32 key=admission.currentUserKey(subject);
        return key==0||subject==pools[parent].launcher||memberForSubject[parent][subject]!=0||memberForUser[parent][key]!=0||key==admission.currentUserKey(pools[parent].launcher)||key==data.configOf(parent).custodianUserKey||data.related(parent,key);
    }
    function initializeFinal(bytes32 id) external guarded{
        Pool storage p=pools[id];if(p.state!=State.ACTIVE||data.seasonCanceled(id)||!_allFinal(id))revert Invalid();
        uint256 nonvoid;for(uint16 w=1;w<=data.configOf(id).periodCount;w++)if(!scores.isVoid(id,w))nonvoid++;
        if(nonvoid==0){_cancel(id,keccak256("NO_ELIGIBLE_WEEKS"));return;}p.state=State.REVIEW;p.rankRevision=1;p.fee=p.entryFee==0?0:(p.gross/100)*3+(p.gross%100)*3/100;
        rankings.initialize(id,1,data.configOf(id).teams,p.gross-p.fee,payouts.weightsFor(id,data.configOf(id).teams));
    }
    function rankMember(bytes32 id,uint8 m,uint64 previous,uint64 next) external guarded{
        if(pools[id].state!=State.REVIEW)revert Invalid();rankings.insert(id,1,m,scores.rank(id,m),previous,next);
    }
    function finalCandidate(bytes32 id) public view returns(FantasyDisputeController420.Candidate memory){
        bytes32 root=keccak256(abi.encode(DOMAIN,id,data.manifest(id)));for(uint16 w=1;w<=data.configOf(id).periodCount;w++)root=keccak256(abi.encode(root,scores.weekRoot(id,w)));
        return FantasyDisputeController420.Candidate(root,rankings.rootOf(id,1),data.configOf(id).profileEvidence,data.periodOf(id,data.configOf(id).periodCount).cutoff,1);
    }
    function publishFinal(bytes32 id) external guarded{
        if(pools[id].state!=State.REVIEW)revert Invalid();FantasyDisputeController420.Candidate memory c=finalCandidate(id);pools[id].candidate=keccak256(abi.encode(DOMAIN,block.chainid,address(this),id,pools[id].manifest,c));
    }
    function settle(bytes32 id) external guarded{
        Pool storage p=pools[id];if(p.state!=State.REVIEW||data.seasonCanceled(id)||p.candidate==0||!_allFinal(id))revert Invalid();p.state=State.SETTLED;credit[devFund]+=p.fee;emit Closed(id,false);
    }
    function _cancel(bytes32 id,bytes32 reason) private{
        Pool storage p=pools[id];if(p.state==State.NONE||p.state==State.CANCELED||p.state==State.SETTLED)revert Invalid();p.state=State.CANCELED;
        reason;
        if(p.prize!=0)credit[p.launcherAccount]+=p.prize;emit Closed(id,true);
    }
    function recover(bytes32 id) external guarded{
        Pool storage p=pools[id];FantasySeasonData420.Config memory c=data.configOf(id);
        if(data.seasonCanceled(id)){_cancel(id,keccak256("OFFICIAL_SEASON_CANCELED"));return;}
        if((block.timestamp>=c.fundingEnd&&roster.leagueOf(id).count!=c.teams)||(block.timestamp>=data.periodOf(id,1).lockAt&&(p.state==State.FUNDING||roster.actor(id)!=0))){_cancel(id,keccak256("FUNDING_OR_DRAFT"));return;}
        for(uint16 week=1;week<=c.periodCount;week++){
            FantasySeasonData420.Period memory period=data.periodOf(id,week);FantasyDisputeController420.Pool memory d=disputes.poolOf(weekDisputeId(id,week));
            if(d.state==FantasyDisputeController420.PoolState.CANCELED){_cancel(id,keccak256("WEEK_CANCELED"));return;}
            if(block.timestamp>=uint256(period.cutoff)+5 days&&!disputes.canSettle(weekDisputeId(id,week))){
                if(d.state==FantasyDisputeController420.PoolState.REVIEW)disputes.expire(weekDisputeId(id,week));_cancel(id,keccak256("WEEK_DEADLINE"));return;
            }
        }
        if(block.timestamp>=uint256(data.periodOf(id,c.periodCount).cutoff)+5 days){
            bool allVoid=true;for(uint16 w=1;w<=c.periodCount;w++)if(!scores.isVoid(id,w))allVoid=false;
            if(allVoid){_cancel(id,keccak256("NO_ELIGIBLE_WEEKS"));return;}
        }
        revert Invalid();
    }
    function collect(bytes32 id,uint8 m) external guarded{
        Pool storage p=pools[id];if(m==0||m>roster.leagueOf(id).count||claimed[id][m]||(p.state!=State.CANCELED&&p.state!=State.SETTLED))revert Invalid();
        claimed[id][m]=true;credit[roster.memberOf(id,m).controller]+=p.state==State.CANCELED?p.entryFee:rankings.payoutOf(id,1,m);
    }
    function collectCanceledBond(bytes32 id,uint16 week) external guarded{
        if(pools[id].state!=State.CANCELED)revert Invalid();bytes32 child=weekDisputeId(id,week);FantasyDisputeController420.Pool memory d=disputes.poolOf(child);
        if(d.state==FantasyDisputeController420.PoolState.REGISTERED||d.state==FantasyDisputeController420.PoolState.REVIEW)disputes.cancelByHost(child,keccak256("SEASON_CANCELED"));
    }
    function withdrawCredit() external guarded{
        uint256 amount=credit[msg.sender];if(amount==0)revert Invalid();credit[msg.sender]=0;totalLiability-=amount;uint256 before_=IFantasyBondToken420(asset).balanceOf(msg.sender);
        if(!IFantasyBondToken420(asset).transfer(msg.sender,amount)||IFantasyBondToken420(asset).balanceOf(msg.sender)!=before_+amount)revert Invalid();
    }
}
