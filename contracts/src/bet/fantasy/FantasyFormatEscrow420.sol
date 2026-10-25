// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./FantasyFormatBook420.sol";
import "./FantasyAdmission420.sol";
import "./FantasyDisputeController420.sol";
import "./FantasyRankingBook420.sol";
import "./FantasyPayoutPolicy420.sol";
import "./FantasyFormatReceipt420.sol";
import "../../revenue/DevelopmentCompensationVault420.sol";

/// @notice Funded variable-roster pools and independently collateralized house cards.
/// @dev Only the rule book calculates scores. Canonical disputes gate all releases.
abstract contract FantasyFormatEscrowBase420 is IFantasyDisputeHost420 {
    bytes32 public constant DOMAIN=keccak256("420.FANTASY.APPROVED.ESCROW.V1");
    bytes32 public constant CREATE=keccak256("BET_FANTASY_CREATE_FORMAT_POOL.V1");
    FantasyFormatBook420 public immutable book;
    FantasyDisputeController420 public immutable disputes;
    FantasyAdmission420 public immutable admission;
    FantasyRankingBook420 public immutable rankings;
    FantasyPayoutPolicy420 public immutable payouts;
    FantasyFormatReceipt420 public immutable receiptVerifier;
    address public immutable asset;
    address public immutable devFund;
    uint256 public totalLiability;
    uint256 private entered;
    enum State{ NONE,OPEN,REVIEW,SETTLED,CANCELED }
    struct Config{bytes32 format;bytes32 candidateFeed;uint256 entryFee;uint256 freePrize;uint64 cap;uint256 houseLimit;}
    struct Pool{
        State state;bytes32 manifest;address launcher;bytes32 launcherSubject;uint64 count;uint64 revealed;uint64 lastAccepted;
        uint64 revision;uint64 scanned;uint64 qualified;uint64 publishedRevision;uint256 gross;uint256 fee;uint256 reserve;
        uint256 bankroll;uint256 retained;uint256 paidDevelopment;bytes32 candidate;uint64 completed;uint256 spent;bool bankReleased;
    }
    struct Entry{
        bytes32 subject;bytes32 userKey;address beneficiary;bytes32 commitment;uint64 nonce;bool revealed;bool claimed;
        bytes selection;int256 score;uint64 dense;bool qualifies;uint256 multiplier;uint256 reserve;uint64 revision;
        bytes32 candidate;bool terminal;uint256 amount;
    }
    struct Submission{bytes32 commitment;uint64 nonce;uint64 expiry;bytes envelope;bytes signature;}
    mapping(bytes32=>Config) private configs;
    mapping(bytes32=>Pool) private pools;
    mapping(bytes32=>mapping(uint64=>Entry)) private entries;
    mapping(bytes32=>mapping(bytes32=>uint64)) public entryForUser;
    mapping(bytes32=>mapping(bytes32=>uint64)) public entryForSubject;
    mapping(bytes32=>bytes32) public parentPool;
    mapping(bytes32=>uint64) public childEntry;
    mapping(address=>uint256) public credit;
    error Invalid();error Unauthorized();error Transfer();
    event Created(bytes32 indexed pool,bytes32 manifest,Config config);
    event Submitted(bytes32 indexed pool,uint64 indexed index,bytes32 subject,uint64 nonce,bytes32 commitment,bytes envelope);
    event Published(bytes32 indexed pool,uint64 indexed index,bytes selection,bytes32 salt);
    event Calculated(bytes32 indexed pool,uint64 indexed index,uint64 revision,int256 score,bool qualifies,uint256 multiplier);
    event Closed(bytes32 indexed pool,bool canceled);
    event Withdrawal(address indexed beneficiary,uint256 amount);
    constructor(address book_,address disputes_,address admission_,address dev_){
        if(book_.code.length==0 || disputes_.code.length==0 || admission_.code.length==0 || dev_.code.length==0)revert Invalid();
        book=FantasyFormatBook420(book_);disputes=FantasyDisputeController420(disputes_);admission=FantasyAdmission420(admission_);
        if(address(book.disputes())!=disputes_||address(admission.slates())!=address(book.slates()) || address(disputes.authorization())!=address(book.slates().authorization()) || address(disputes.oracle())!=address(book.slates().oracle()) || address(disputes.identities())!=address(admission.identities()))revert Invalid();
        asset=disputes.asset();if(asset==address(0))revert Invalid();
        DevelopmentCompensationVault420 vault=DevelopmentCompensationVault420(payable(dev_));
        if(address(vault.capabilityRegistry())!=address(disputes.authorization().capabilityRegistry()))revert Invalid();
        devFund=vault.beneficiary();if(devFund==address(0)||devFund==address(this))revert Invalid();
        rankings=new FantasyRankingBook420(address(this));payouts=new FantasyPayoutPolicy420(address(this));receiptVerifier=new FantasyFormatReceipt420(address(book.slates()));
    }
    modifier guarded(){if(entered!=0)revert Invalid();entered=1;_;entered=0;}
    function poolOf(bytes32 id) external view returns(Pool memory){return pools[id];}
    function configOf(bytes32 id) external view returns(Config memory){return configs[id];}
    function entryOf(bytes32 id,uint64 i) external view returns(Entry memory){return entries[id][i];}
    function _house(bytes32 id) internal view virtual returns(bool);
    function _slate(bytes32 id) private view returns(FantasySlateBook420.Slate memory){return book.slates().slateOf(book.configOf(configs[id].format).slate);}
    function _receive(uint256 amount) private{
        uint256 before_=IFantasyBondToken420(asset).balanceOf(address(this));
        if(amount!=0 && !IFantasyBondToken420(asset).transferFrom(msg.sender,address(this),amount))revert Transfer();
        if(IFantasyBondToken420(asset).balanceOf(address(this))!=before_+amount)revert Transfer();
        totalLiability+=amount;
    }
    function _register(bytes32 id,bytes32 parent) private{
        Config storage c=configs[parent];Pool storage p=pools[parent];
        disputes.registerPool(id,FantasyDisputeController420.Config(address(this),p.manifest,FantasyTypes420.DATA_POLICY,book.manifest(c.format),c.candidateFeed,c.entryFee,c.freePrize,c.entryFee!=0));
    }
    function create(bytes32 id,bytes32 launcherSubject,Config calldata c,bytes calldata bands,uint256 bankroll) external guarded{
        BetAuthorization420 auth=disputes.authorization();
        if(!auth.isAuthorized(msg.sender,CREATE,auth.scopeGlobal(),0))revert Unauthorized();
        admission.requireController(launcherSubject,msg.sender);
        if(admission.currentUserKey(launcherSubject)==0 || pools[id].state!=State.NONE || id==0 || book.manifest(c.format)==0 || c.candidateFeed==0 || (c.entryFee!=0 && c.freePrize!=0))revert Invalid();
        FantasyFormatBook420.Config memory f=book.configOf(c.format);
        FantasySlateBook420.Slate memory s=book.slates().slateOf(f.slate);
        if(block.timestamp>=s.lockAt || (s.earlyStart!=0 && block.timestamp>=s.earlyStart))revert Invalid();
        bool house=f.kind==FantasyFormatBook420.Kind.HOUSE;
        if(house!=_house(id))revert Invalid();
        if(house?(c.entryFee==0 || c.houseLimit==0 || bankroll==0 || c.freePrize!=0):(bankroll!=0 || c.houseLimit!=0 || (c.cap!=0 && c.cap<2)))revert Invalid();
        configs[id]=c;Pool storage p=pools[id];p.state=State.OPEN;p.launcher=msg.sender;p.launcherSubject=launcherSubject;p.bankroll=bankroll;p.gross=c.freePrize;
        p.manifest=keccak256(abi.encode(DOMAIN,block.chainid,address(this),id,c,book.manifest(c.format),bands,launcherSubject,devFund));
        if(!house){payouts.register(id,c.cap,bands);_register(id,id);}
        _receive(bankroll+c.freePrize);emit Created(id,p.manifest,c);
    }
    function _open(bytes32 id) private view{
        FantasySlateBook420.Slate memory s=_slate(id);
        if(pools[id].state!=State.OPEN || block.timestamp>=(s.earlyStart==0?s.lockAt:s.earlyStart))revert Invalid();
    }
    function commitmentOf(bytes32 id,bytes32 subject,uint64 nonce,bytes calldata selection,bytes32 salt) public view returns(bytes32){
        return keccak256(abi.encode(DOMAIN,block.chainid,address(this),id,pools[id].manifest,subject,nonce,keccak256(selection),salt));
    }
    function submissionDigest(bytes32 id,bytes32 subject,bytes32 userKey,Submission calldata sub) public view returns(bytes32){
        return keccak256(abi.encode(DOMAIN,block.chainid,address(this),id,pools[id].manifest,subject,userKey,sub.commitment,sub.nonce,sub.expiry,keccak256(sub.envelope)));
    }
    function _receipt(bytes32 id,bytes32 subject,bytes32 userKey,Submission calldata sub) private view{
        receiptVerifier.verify(book.configOf(configs[id].format).slate,submissionDigest(id,subject,userKey,sub),sub.commitment,sub.expiry,sub.envelope.length,sub.signature);
    }
    function houseDisputeId(bytes32 id,uint64 index) public view returns(bytes32){if(!_house(id))revert Invalid();return keccak256(abi.encode(DOMAIN,block.chainid,address(this),id,index));}
    function enter(bytes32 id,bytes32 subject,bytes32 credential,Submission calldata sub) external guarded returns(uint64 index){
        _open(id);Config storage c=configs[id];Pool storage p=pools[id];
        bytes32 key=admission.requireUser(subject,credential,msg.sender,id,c.entryFee);
        admission.registerIdentity(subject,credential);
        if(entryForUser[id][key]!=0||entryForSubject[id][subject]!=0||key==_slate(id).custodianUserKey||sub.nonce!=1||(c.cap!=0&&p.count>=c.cap))revert Unauthorized();
        _receipt(id,subject,key,sub);index=++p.count;entryForUser[id][key]=index;entryForSubject[id][subject]=index;
        Entry storage e=entries[id][index];e.subject=subject;e.userKey=key;e.beneficiary=msg.sender;e.commitment=sub.commitment;e.nonce=1;
        if(_house(id)){
            uint256 mult=book.configOf(c.format).cardSize==2?3:5;
            uint256 reserve=c.entryFee*mult+(c.entryFee/100)*3+((c.entryFee%100)*3+99)/100;
            if(p.reserve+reserve>c.houseLimit || p.bankroll+p.gross+c.entryFee<p.reserve+reserve+p.spent)revert Invalid();
            p.reserve+=reserve;e.reserve=reserve;
            bytes32 child=houseDisputeId(id,index);parentPool[child]=id;childEntry[child]=index;_register(child,id);
        }
        p.gross+=c.entryFee;p.lastAccepted=uint64(block.timestamp);_receive(c.entryFee);
        emit Submitted(id,index,subject,1,sub.commitment,sub.envelope);
    }
    function edit(bytes32 id,bytes32 subject,Submission calldata sub) external guarded{
        _open(id);admission.requireEntryActor(subject,msg.sender,id);
        uint64 index=entryForSubject[id][subject];Entry storage e=entries[id][index];
        if(index==0 || sub.nonce!=e.nonce+1 || admission.currentUserKey(subject)!=e.userKey)revert Invalid();
        _receipt(id,subject,e.userKey,sub);e.nonce=sub.nonce;e.commitment=sub.commitment;pools[id].lastAccepted=uint64(block.timestamp);
        emit Submitted(id,index,subject,sub.nonce,sub.commitment,sub.envelope);
    }
    function reveal(bytes32 id,uint64 index,bytes calldata selection,bytes32 salt) external guarded{
        Pool storage p=pools[id];Entry storage e=entries[id][index];FantasySlateBook420.Slate memory s=_slate(id);
        if(p.state!=State.OPEN||block.timestamp<s.lockAt||block.timestamp>s.lockAt+1 hours||e.subject==0||e.revealed||commitmentOf(id,e.subject,e.nonce,selection,salt)!=e.commitment||!book.validate(configs[id].format,selection))revert Invalid();
        e.revealed=true;e.selection=selection;p.revealed++;emit Published(id,index,selection,salt);
    }
    function begin(bytes32 id) external guarded{
        Pool storage p=pools[id];FantasySlateBook420.Slate memory s=_slate(id);
        if(p.state!=State.OPEN||p.revealed!=p.count||s.resolvedAt==0||s.eligibleGames==0||(s.earlyStart!=0&&p.lastAccepted>=s.earlyStart)||(!_house(id)&&p.count<2))revert Invalid();
        p.state=State.REVIEW;
        if(!_house(id))disputes.startCorrection(id,s.resolvedAt);
    }
    function beginRevision(bytes32 id) external guarded{
        Pool storage p=pools[id];FantasyFormatBook420.Report memory r=book.reportOf(configs[id].format);
        if(p.state!=State.REVIEW||_house(id)||r.revision<=p.revision)revert Invalid();
        if(disputes.poolOf(id).state!=FantasyDisputeController420.PoolState.REVIEW)revert Invalid();
        if(block.timestamp>=_slate(id).resolvedAt+1 days){
            FantasyDisputeController420.Pool memory d=disputes.poolOf(id);
            if(!d.invalidated||d.pending!=0||block.timestamp<d.challengeEnd||block.timestamp+1 days>d.deadline)revert Invalid();
        }
        p.revision=r.revision;p.scanned=0;p.qualified=0;p.publishedRevision=0;
    }
    function calculateNext(bytes32 id,bytes calldata witnesses) external guarded{
        Pool storage p=pools[id];
        if(p.state!=State.REVIEW||_house(id)||p.revision==0||p.scanned==p.count||book.reportOf(configs[id].format).revision!=p.revision)revert Invalid();
        uint64 index=++p.scanned;Entry storage e=entries[id][index];
        (e.score,e.qualifies,e.multiplier)=book.calculate(configs[id].format,e.selection,witnesses);e.revision=p.revision;e.dense=e.qualifies?++p.qualified:0;
        emit Calculated(id,index,p.revision,e.score,e.qualifies,e.multiplier);
    }
    function initializeRanking(bytes32 id) external guarded{
        Pool storage p=pools[id];if(p.scanned!=p.count||p.qualified<2||_house(id))revert Invalid();
        uint256 gross=configs[id].entryFee==0?configs[id].freePrize:configs[id].entryFee*p.qualified;
        p.fee=configs[id].entryFee==0?0:(gross/100)*3+(gross%100)*3/100;
        rankings.initialize(id,p.revision,p.qualified,gross-p.fee,payouts.weightsFor(id,p.qualified));
    }
    function rankEntry(bytes32 id,uint64 index,uint64 previous,uint64 next) external guarded{
        if(_house(id))revert Invalid();
        Entry storage e=entries[id][index];Pool storage p=pools[id];
        if(e.revision!=p.revision||!e.qualifies||p.state!=State.REVIEW)revert Invalid();
        rankings.insert(id,p.revision,e.dense,e.score,previous,next);
    }
    function candidateOf(bytes32 id) public view returns(FantasyDisputeController420.Candidate memory){
        if(_house(id))revert Invalid();
        Pool storage p=pools[id];FantasyFormatBook420.Report memory r=book.reportOf(configs[id].format);
        if(r.revision!=p.revision)revert Invalid();
        return FantasyDisputeController420.Candidate(r.root,rankings.rootOf(id,p.revision),r.evidence,r.asOf,r.revision);
    }
    function publishCandidate(bytes32 id) external guarded{
        Pool storage p=pools[id];if(p.state!=State.REVIEW||_house(id))revert Invalid();
        FantasyDisputeController420.Candidate memory c=candidateOf(id);disputes.publishCandidate(id,c);p.publishedRevision=p.revision;p.candidate=disputes.candidateDigest(id,c);
    }
    function candidateIsCurrent(bytes32 id,bytes32 candidate) external view returns(bool){
        bytes32 parent=_house(id)?parentPool[id]:bytes32(0);
        bool finalized=disputes.poolOf(id).state==FantasyDisputeController420.PoolState.FINAL;
        if(parent!=0){Entry storage e=entries[parent][childEntry[id]];return pools[parent].state==State.REVIEW&&!e.terminal&&e.candidate==candidate&&(finalized||(e.revision==book.reportOf(configs[parent].format).revision&&book.reportIsCurrent(configs[parent].format)&&_timing(parent)));}
        Pool storage p=pools[id];return p.state==State.REVIEW&&p.publishedRevision!=0&&p.publishedRevision==p.revision&&p.candidate==candidate&&(finalized||(book.reportOf(configs[id].format).revision==p.revision&&book.reportIsCurrent(configs[id].format)&&_timing(id)));
    }
    function _timing(bytes32 id) private view returns(bool){FantasySlateBook420.Slate memory s=_slate(id);return s.resolvedAt!=0&&s.eligibleGames!=0&&(s.earlyStart==0||pools[id].lastAccepted<s.earlyStart);}
    function isEntrant(bytes32 id,bytes32 subject) external view returns(bool){bytes32 parent=parentPool[id];return entryForSubject[parent==0?id:parent][subject]!=0;}
    function isInterested(bytes32 id,bytes32 subject) external view returns(bool){
        bytes32 parent=parentPool[id];if(parent==0)parent=id;
        bytes32 key=admission.currentUserKey(subject);
        return key==0||subject==pools[parent].launcherSubject||entryForSubject[parent][subject]!=0||(entryForUser[parent][key]!=0||key==_slate(parent).custodianUserKey||key==admission.currentUserKey(pools[parent].launcherSubject)||book.related(configs[parent].format,key));
    }
    function settle(bytes32 id) external guarded{
        Pool storage p=pools[id];
        if(_house(id)||p.state!=State.REVIEW||!disputes.canSettle(id)||!this.candidateIsCurrent(id,p.candidate))revert Invalid();
        p.state=State.SETTLED;credit[devFund]+=p.fee;emit Closed(id,false);
    }
    function prepareHouse(bytes32 id,uint64 index,bytes calldata witnesses) external guarded returns(FantasyDisputeController420.Candidate memory c){
        Pool storage p=pools[id];Entry storage e=entries[id][index];FantasyFormatBook420.Report memory r=book.reportOf(configs[id].format);
        if(!_house(id)||p.state!=State.REVIEW||!e.revealed||e.terminal||r.revision<=e.revision)revert Invalid();
        (e.score,e.qualifies,e.multiplier)=book.calculate(configs[id].format,e.selection,witnesses);e.revision=r.revision;
        bytes32 child=houseDisputeId(id,index);FantasyDisputeController420.Pool memory d=disputes.poolOf(child);
        if(d.state!=FantasyDisputeController420.PoolState.REGISTERED&&d.state!=FantasyDisputeController420.PoolState.REVIEW)revert Invalid();
        if(d.state==FantasyDisputeController420.PoolState.REGISTERED)disputes.startCorrection(child,_slate(id).resolvedAt);
        c=houseCandidateOf(id,index);
    }
    function houseCandidateOf(bytes32 id,uint64 index) public view returns(FantasyDisputeController420.Candidate memory){
        if(!_house(id))revert Invalid();
        Entry storage e=entries[id][index];FantasyFormatBook420.Report memory r=book.reportOf(configs[id].format);
        if(e.revision==0||e.revision!=r.revision)revert Invalid();
        return FantasyDisputeController420.Candidate(r.root,keccak256(abi.encode(pools[id].manifest,index,e.commitment,e.score,e.qualifies,e.multiplier)),r.evidence,r.asOf,r.revision);
    }
    function publishHouse(bytes32 id,uint64 index) external guarded{
        if(!_house(id))revert Invalid();
        Entry storage e=entries[id][index];bytes32 child=houseDisputeId(id,index);
        FantasyDisputeController420.Candidate memory c=houseCandidateOf(id,index);disputes.publishCandidate(child,c);e.candidate=disputes.candidateDigest(child,c);
    }
    function refreshUnchangedHouse(bytes32 id,uint64 index,bytes calldata witnesses) external guarded{
        Entry storage e=entries[id][index];FantasyDisputeController420.Pool memory d=disputes.poolOf(houseDisputeId(id,index));
        if(!_house(id)||pools[id].state!=State.REVIEW||e.terminal||e.candidate==0||d.state!=FantasyDisputeController420.PoolState.REVIEW||d.invalidated)revert Invalid();
        (int256 score,bool qualifies,uint256 multiplier)=book.calculate(configs[id].format,e.selection,witnesses);
        if(score!=e.score||qualifies!=e.qualifies||multiplier!=e.multiplier)revert Invalid();
        e.revision=book.reportOf(configs[id].format).revision;
    }
    function settleHouse(bytes32 id,uint64 index) external guarded{
        Pool storage p=pools[id];Entry storage e=entries[id][index];bytes32 child=houseDisputeId(id,index);
        if(!_house(id)||p.state!=State.REVIEW||e.terminal||!disputes.canSettle(child)||!this.candidateIsCurrent(child,e.candidate))revert Invalid();
        e.terminal=true;p.reserve-=e.reserve;p.completed++;
        uint256 amount=configs[id].entryFee*e.multiplier;e.amount=amount;credit[e.beneficiary]+=amount;p.spent+=amount;
        if(e.qualifies){p.retained+=configs[id].entryFee;uint256 due=(p.retained/100)*3+(p.retained%100)*3/100;uint256 delta=due-p.paidDevelopment;credit[devFund]+=delta;p.spent+=delta;p.paidDevelopment=due;}
        // All obligations remain in totalLiability until the fixed beneficiary withdraws.
    }
    function _cancel(bytes32 id,bytes32 reason) private{
        Pool storage p=pools[id];if(p.state==State.CANCELED||p.state==State.SETTLED||p.state==State.NONE)revert Invalid();
        p.state=State.CANCELED;
        if(!_house(id)){if(disputes.poolOf(id).state!=FantasyDisputeController420.PoolState.CANCELED)disputes.cancelByHost(id,reason);if(configs[id].freePrize!=0)credit[p.launcher]+=configs[id].freePrize;}
        emit Closed(id,true);
    }
    function recover(bytes32 id) external guarded{
        Pool storage p=pools[id];FantasySlateBook420.Slate memory s=_slate(id);
        if((s.earlyStart!=0&&p.lastAccepted>=s.earlyStart)||(block.timestamp>s.lockAt+1 hours&&p.revealed!=p.count)||(s.resolvedAt!=0&&s.eligibleGames==0)||(!_house(id)&&block.timestamp>=s.lockAt&&p.count<2)){
            _cancel(id,keccak256("TIMING_PUBLICATION_OR_MINIMUM"));return;
        }
        if(!_house(id)){
            FantasyDisputeController420.Pool memory d=disputes.poolOf(id);
            if(d.state==FantasyDisputeController420.PoolState.CANCELED||(p.scanned==p.count&&p.revision!=0&&p.qualified<2)){_cancel(id,keccak256("DISPUTE_OR_QUALIFICATION"));return;}
            if(d.state==FantasyDisputeController420.PoolState.REVIEW&&block.timestamp>=d.deadline){disputes.expire(id);_cancel(id,keccak256("DEADLINE"));return;}
        }
        if(block.timestamp>=uint256(s.cutoff)+6 days&&p.publishedRevision==0){_cancel(id,keccak256("MISSING_EVIDENCE"));return;}
        revert Invalid();
    }
    function recoverHouse(bytes32 id,uint64 index) external guarded{
        Pool storage p=pools[id];Entry storage e=entries[id][index];if(!_house(id)||e.subject==0||e.terminal)revert Invalid();
        bytes32 child=houseDisputeId(id,index);FantasyDisputeController420.Pool memory d=disputes.poolOf(child);
        if(p.state!=State.CANCELED){
            if(d.state==FantasyDisputeController420.PoolState.REVIEW&&block.timestamp>=d.deadline)disputes.expire(child);
            else if(d.state!=FantasyDisputeController420.PoolState.CANCELED && block.timestamp<uint256(_slate(id).cutoff)+6 days)revert Invalid();
        }
        d=disputes.poolOf(child);if(d.state!=FantasyDisputeController420.PoolState.CANCELED)disputes.cancelByHost(child,keccak256("HOUSE_RECOVERY"));
        e.terminal=true;e.amount=configs[id].entryFee;p.reserve-=e.reserve;p.completed++;p.spent+=e.amount;credit[e.beneficiary]+=e.amount;
    }
    function releaseHouseBankroll(bytes32 id) external guarded{
        Pool storage p=pools[id];
        if(!_house(id)||p.bankReleased||p.completed!=p.count||p.reserve!=0||block.timestamp<_slate(id).lockAt)revert Invalid();
        p.bankReleased=true;if(p.state!=State.CANCELED)p.state=State.SETTLED;uint256 available=p.bankroll+p.gross-p.spent;credit[p.launcher]+=available;
    }
    function collect(bytes32 id,uint64 index) external guarded{
        Pool storage p=pools[id];Entry storage e=entries[id][index];if(_house(id)||e.subject==0||e.claimed||(p.state!=State.CANCELED&&p.state!=State.SETTLED))revert Invalid();
        e.claimed=true;uint256 amount=p.state==State.CANCELED||!e.qualifies?configs[id].entryFee:rankings.payoutOf(id,p.publishedRevision,e.dense);credit[e.beneficiary]+=amount;
    }
    function withdrawCredit() external guarded{
        uint256 amount=credit[msg.sender];if(amount==0)revert Invalid();credit[msg.sender]=0;totalLiability-=amount;
        uint256 before_=IFantasyBondToken420(asset).balanceOf(msg.sender);
        if(!IFantasyBondToken420(asset).transfer(msg.sender,amount)||IFantasyBondToken420(asset).balanceOf(msg.sender)!=before_+amount)revert Transfer();emit Withdrawal(msg.sender,amount);
    }
}

/// @notice Peer-only custody; cannot accept a house-format configuration.
contract FantasyFormatEscrow420 is FantasyFormatEscrowBase420 {
    constructor(address b,address d,address a,address v) FantasyFormatEscrowBase420(b,d,a,v){}
    function _house(bytes32) internal pure override returns(bool){return false;}
}

/// @notice House-only custody; no peer-pool balances can subsidize its liabilities.
contract FantasyHouseEscrow420 is FantasyFormatEscrowBase420 {
    constructor(address b,address d,address a,address v) FantasyFormatEscrowBase420(b,d,a,v){}
    function _house(bytes32) internal pure override returns(bool){return true;}
}
