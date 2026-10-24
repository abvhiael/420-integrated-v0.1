// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerConfidentialDeal420.sol";

/// @notice Prospective player admission and independently reviewed abuse cases.
/// @dev Control-group attestations require real off-chain investigation. Neither
/// a report nor a statistical signal proves collusion or authorizes a payout.
/// There is deliberately NO custody, action, dispute or settlement write API.
contract PokerAbuseControls420 {
    bytes32 public constant ACTION_CONFIGURE=keccak256("BET_POKER_ABUSE_CONFIGURE.V1");
    bytes32 public constant ACTION_ATTEST=keccak256("BET_POKER_PLAYER_CONTROL_ATTEST.V1");
    bytes32 public constant ACTION_REVIEW=keccak256("BET_POKER_ABUSE_REVIEW.V1");
    bytes32 public constant DOMAIN=keccak256("420.BET.POKER.ABUSE.V1");
    PokerSeatLedger420 public immutable ledger;
    PokerConfidentialDeal420 public immutable deals;
    BetAuthorization420 public immutable authorization;
    struct Policy {
        uint32 reviewDelay;
        uint32 maxRestriction;
        uint32 reentryDelay;
        uint32 sitOutDelay;
        uint32 dealInterval;
        uint8 reportsPerDay;
        bytes32 manifestHash;
    }
    mapping(bytes32=>Policy) public policies;
    mapping(bytes32=>bytes32) public policyHash;
    struct Identity {
        bytes32 group;
        bytes32 evidence;
        address proposer;
        address confirmer;
        uint64 validUntil;
        uint64 revision;
    }
    mapping(bytes32=>mapping(address=>Identity)) private identities;
    mapping(bytes32=>mapping(address=>Identity)) private pendingIdentities;
    mapping(bytes32=>mapping(address=>uint64)) public identityProposalNonce;
    mapping(bytes32=>mapping(address=>bytes32)) public identityProposalDigest;
    mapping(bytes32=>mapping(address=>uint64)) public selfExcludedUntil;
    mapping(bytes32=>mapping(address=>uint64)) public playerNonce;
    mapping(bytes32=>mapping(address=>mapping(address=>bool))) public avoids;
    mapping(bytes32=>uint64) public lastDealAt;
    mapping(bytes32=>bytes32) public latestRequestedHand;
    struct Admission {bytes32 tableId;bytes32 root;uint16 mask;uint64 admittedAt;}
    mapping(bytes32=>Admission) public admissions;
    mapping(bytes32=>mapping(uint8=>address)) public admittedPlayer;
    struct Restriction {uint64 until;uint64 revision;bytes32 sourceCase;}
    mapping(bytes32=>mapping(address=>Restriction)) public restrictions;
    enum Category { COLLUSION, CHIP_DUMPING, AUTOMATION, SEAT_HUNTING, GRIEFING }
    struct Case {
        bytes32 handId;
        address reporter;
        address target;
        bytes32 evidence;
        Category category;
        uint64 reportedAt;
        bool finalized;
    }
    mapping(bytes32=>Case) private cases;
    struct Review {
        bytes32 reason;
        bytes32 digest;
        address proposer;
        address confirmer;
        uint64 executableAfter;
        uint64 expiresAt;
        uint32 duration;
        bool appealed;
        bytes32 appealEvidence;
    }
    mapping(bytes32=>Review) private reviews;
    struct Lift {bytes32 reason;bytes32 digest;address proposer;address confirmer;uint64 revision;uint64 executableAfter;uint64 expiresAt;}
    mapping(bytes32=>Lift) public lifts;
    mapping(bytes32=>bool) public reportedPair;
    struct ReportUsage {uint64 day;uint8 count;}
    mapping(bytes32=>mapping(address=>ReportUsage)) public reportUsage;
    error Unauthorized();error InvalidConfiguration();error InvalidState();error Ineligible();
    error RelatedPlayers();error PlayerAvoided();error CoolingOff();error RateLimited();error TooEarly();error Expired();error Stale();
    event AbusePolicyConfigured(bytes32 indexed tableId,bytes32 policyHash,bytes32 manifestHash);
    event PlayerIdentityProposed(bytes32 indexed tableId,address indexed player,bytes32 group,uint64 revision,address proposer,bytes32 evidence,uint64 validUntil,bytes32 digest);
    event PlayerIdentityConfirmed(bytes32 indexed tableId,address indexed player,uint64 revision,address confirmer);
    event PlayerProtectionChanged(bytes32 indexed tableId,address indexed player,uint64 nonce,uint64 selfExcludedUntil,address avoided,bool value);
    event AbuseHandAdmitted(bytes32 indexed handId,bytes32 indexed tableId,bytes32 root,uint16 mask,bytes32 policyHash);
    event AbuseCaseReported(bytes32 indexed caseId,bytes32 indexed handId,address reporter,address target,Category category,bytes32 evidence);
    event RestrictionProposed(bytes32 indexed caseId,bytes32 digest,address proposer,uint64 executableAfter,uint32 duration,bytes32 reason);
    event RestrictionConfirmed(bytes32 indexed caseId,address confirmer,bytes32 digest);
    event AbuseCaseAppealed(bytes32 indexed caseId,bytes32 evidence,uint64 executableAfter);
    event AbuseCaseClosed(bytes32 indexed caseId,bool restricted,address target,uint64 until,uint64 revision);
    event AbuseCaseCancelled(bytes32 indexed caseId,address reviewer,bytes32 reason);
    event RestrictionLiftProposed(bytes32 indexed caseId,address proposer,uint64 restrictionRevision,bytes32 reason,uint64 executableAfter);
    event RestrictionLiftConfirmed(bytes32 indexed caseId,address confirmer,uint64 restrictionRevision);
    event RestrictionLifted(bytes32 indexed caseId,address target,uint64 restrictionRevision);
    constructor(address ledger_,address deals_){
        if(ledger_==address(0)||deals_==address(0))revert InvalidConfiguration();
        ledger=PokerSeatLedger420(ledger_);deals=PokerConfidentialDeal420(deals_);
        if(address(deals.ledger())!=ledger_)revert InvalidConfiguration();
        authorization=ledger.authorization();
    }
    function ledgerAddress()external view returns(address){return address(ledger);}
    function dealsAddress()external view returns(address){return address(deals);}
    function identityOf(bytes32 tableId,address player)external view returns(Identity memory){return identities[tableId][player];}
    function admissionOf(bytes32 id)external view returns(Admission memory){return admissions[id];}
    function restrictionOf(bytes32 tableId,address player)external view returns(Restriction memory){return restrictions[tableId][player];}
    function caseOf(bytes32 id)external view returns(Case memory){return cases[id];}
    function reviewOf(bytes32 id)external view returns(Review memory){return reviews[id];}
    function liftOf(bytes32 id)external view returns(Lift memory){return lifts[id];}
    function configure(bytes32 tableId,Policy calldata policy)external {
        PokerTableRegistry420.Table memory t=ledger.tables().getTable(tableId);
        if(!t.exists||policyHash[tableId]!=bytes32(0)||policy.manifestHash==bytes32(0)||
           policy.reviewDelay<30||policy.reviewDelay>1 days||policy.maxRestriction<60||policy.maxRestriction>30 days||
           policy.reentryDelay<30||policy.reentryDelay>1 days||policy.sitOutDelay<30||policy.sitOutDelay>1 days||
           policy.dealInterval<1||policy.dealInterval>600||policy.reportsPerDay<1||policy.reportsPerDay>9)revert InvalidConfiguration();
        _cap(msg.sender,ACTION_CONFIGURE,tableId);
        policies[tableId]=policy;
        bytes32 digest=keccak256(abi.encode(DOMAIN,block.chainid,address(this),address(ledger),address(deals),tableId,t.configHash,policy));
        policyHash[tableId]=digest;emit AbusePolicyConfigured(tableId,digest,policy.manifestHash);
    }
    function _cap(address actor,bytes32 action,bytes32 tableId)private view {
        if(!authorization.isAuthorized(actor,action,authorization.scopeForTable(tableId),0))revert Unauthorized();
    }
    function _independent(address actor,bytes32 tableId,address a,address b,bytes32 role)private view {
        PokerTableRegistry420.Table memory t=ledger.tables().getTable(tableId);
        if(actor==address(0)||actor==a||actor==b||actor==t.controller||
           actor==deals.providerA()||actor==deals.providerB()||ledger.playerSeatPlusOne(tableId,actor)!=0)revert Unauthorized();
        _cap(actor,role,tableId);
    }
    function proposeIdentity(bytes32 tableId,address player,bytes32 group,bytes32 evidence,uint64 validUntil,uint64 expectedRevision)external returns(bytes32 digest){
        if(policyHash[tableId]==bytes32(0)||player==address(0)||group==bytes32(0)||evidence==bytes32(0)||
           validUntil<=block.timestamp||validUntil>block.timestamp+30 days)revert InvalidConfiguration();
        _independent(msg.sender,tableId,player,address(0),ACTION_ATTEST);
        Identity storage prior=identities[tableId][player];if(prior.revision!=expectedRevision)revert Stale();
        uint64 revision=prior.revision+1;
        pendingIdentities[tableId][player]=Identity(group,evidence,msg.sender,address(0),validUntil,revision);
        uint64 nonce=++identityProposalNonce[tableId][player];
        digest=keccak256(abi.encode(DOMAIN,block.chainid,address(this),tableId,player,group,evidence,validUntil,revision,nonce,msg.sender));
        identityProposalDigest[tableId][player]=digest;
        emit PlayerIdentityProposed(tableId,player,group,revision,msg.sender,evidence,validUntil,digest);
    }
    function confirmIdentity(bytes32 tableId,address player,uint64 revision,bytes32 expectedDigest)external {
        Identity storage x=pendingIdentities[tableId][player];
        if(x.revision!=revision||identities[tableId][player].revision+1!=revision||identityProposalDigest[tableId][player]!=expectedDigest||
           x.proposer==address(0)||x.confirmer!=address(0)||x.validUntil<=block.timestamp)revert InvalidState();
        _independent(msg.sender,tableId,player,x.proposer,ACTION_ATTEST);
        _independent(x.proposer,tableId,player,address(0),ACTION_ATTEST);
        x.confirmer=msg.sender;identities[tableId][player]=x;delete pendingIdentities[tableId][player];
        emit PlayerIdentityConfirmed(tableId,player,revision,msg.sender);
    }
    function _identity(bytes32 tableId,address player)private view returns(Identity memory x){
        x=identities[tableId][player];
        if(x.group==bytes32(0)||x.confirmer==address(0)||x.validUntil<=block.timestamp)revert Ineligible();
        _independent(x.proposer,tableId,player,x.confirmer,ACTION_ATTEST);
        _independent(x.confirmer,tableId,player,x.proposer,ACTION_ATTEST);
    }
    function _eligible(bytes32 tableId,address player)private view returns(Identity memory x){
        if(policyHash[tableId]==bytes32(0)||selfExcludedUntil[tableId][player]>block.timestamp||restrictions[tableId][player].until>block.timestamp)revert Ineligible();
        x=_identity(tableId,player);
        uint64 exited=ledger.lastExitAt(tableId,player);uint64 satOut=ledger.lastSitOutAt(tableId,player);
        Policy storage p=policies[tableId];
        if((exited>0&&block.timestamp<uint256(exited)+p.reentryDelay)||
           (satOut>0&&block.timestamp<uint256(satOut)+p.sitOutDelay))revert CoolingOff();
    }
    function checkReturn(bytes32 tableId,address player)external view {_eligible(tableId,player);}
    function _pair(bytes32 tableId,address a,bytes32 groupA,address b,bytes32 groupB)private view {
        if(groupA==groupB)revert RelatedPlayers();
        if(avoids[tableId][a][b]||avoids[tableId][b][a])revert PlayerAvoided();
    }
    function checkDeposit(bytes32 tableId,address player,uint8 seat)external view {
        Identity memory x=_eligible(tableId,player);
        uint8 count=ledger.tables().getTable(tableId).config.seats;
        for(uint8 i;i<count;i++)if(i!=seat){
            address other=ledger.seatOf(tableId,i).player;
            if(other!=address(0))_pair(tableId,player,x.group,other,identities[tableId][other].group);
        }
    }
    function checkParticipants(bytes32 tableId,uint16 mask)public view {
        uint8 seats=ledger.tables().getTable(tableId).config.seats;
        if(mask==0||(uint256(mask)>>seats)!=0)revert InvalidState();
        address[] memory players=new address[](9);bytes32[] memory groups=new bytes32[](9);uint8 count=0;
        for(uint8 i;i<seats;i++)if((mask&(uint16(1)<<i))!=0){
            address player=ledger.seatOf(tableId,i).player;Identity memory x=_eligible(tableId,player);
            for(uint8 j;j<count;j++)_pair(tableId,player,x.group,players[j],groups[j]);
            players[count]=player;groups[count]=x.group;++count;
        }
        if(count<2)revert InvalidState();
    }
    function selfExclude(bytes32 tableId,uint64 until,uint64 expectedNonce)external {
        if(policyHash[tableId]==bytes32(0)||until<block.timestamp+1 days||until>block.timestamp+365 days||until<=selfExcludedUntil[tableId][msg.sender])revert InvalidState();
        _nonce(tableId,expectedNonce);selfExcludedUntil[tableId][msg.sender]=until;
        emit PlayerProtectionChanged(tableId,msg.sender,playerNonce[tableId][msg.sender],until,address(0),true);
    }
    function setAvoid(bytes32 tableId,address other,bool value,uint64 expectedNonce)external {
        if(policyHash[tableId]==bytes32(0)||other==address(0)||other==msg.sender||avoids[tableId][msg.sender][other]==value)revert InvalidState();
        _nonce(tableId,expectedNonce);avoids[tableId][msg.sender][other]=value;
        emit PlayerProtectionChanged(tableId,msg.sender,playerNonce[tableId][msg.sender],selfExcludedUntil[tableId][msg.sender],other,value);
    }
    function _nonce(bytes32 tableId,uint64 expected)private {if(playerNonce[tableId][msg.sender]!=expected)revert Stale();++playerNonce[tableId][msg.sender];}
    function noteDealRequested(bytes32 tableId,bytes32 handId)external {
        if(msg.sender!=address(ledger))revert Unauthorized();
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        if(h.tableId!=tableId||h.state!=PokerConfidentialDeal420.State.AWAITING||ledger.activeHand(tableId)!=bytes32(0))revert InvalidState();
        uint64 previous=lastDealAt[tableId];
        if(previous>0&&block.timestamp<uint256(previous)+policies[tableId].dealInterval)revert RateLimited();
        bytes32 pending=latestRequestedHand[tableId];
        if(pending!=bytes32(0)&&!ledger.handConsumed(pending)){
            PokerConfidentialDeal420.Hand memory prior=deals.getHand(pending);
            if(block.timestamp<prior.deadline&&prior.state!=PokerConfidentialDeal420.State.EXPIRED)revert RateLimited();
        }
        lastDealAt[tableId]=uint64(block.timestamp);latestRequestedHand[tableId]=handId;
    }
    function admitHand(bytes32 tableId,bytes32 handId,uint16 mask)external returns(bytes32 root){
        if(msg.sender!=address(ledger))revert Unauthorized();
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        if(h.tableId!=tableId||handId!=latestRequestedHand[tableId]||deals.handSeatMask(handId)!=mask||
           h.deadline<block.timestamp||admissions[handId].root!=bytes32(0)||ledger.activeHand(tableId)!=handId||ledger.lockedSnapshot(tableId)==bytes32(0))revert InvalidState();
        checkParticipants(tableId,mask);
        root=keccak256(abi.encode(DOMAIN,block.chainid,address(this),tableId,handId,mask,policyHash[tableId],ledger.lockedSnapshot(tableId)));
        for(uint8 i;i<9;i++)if((mask&(uint16(1)<<i))!=0){
            PokerSeatLedger420.Seat memory s=ledger.seatOf(tableId,i);Identity memory x=identities[tableId][s.player];
            root=keccak256(abi.encode(root,i,s.player,s.epoch,x));admittedPlayer[handId][i]=s.player;
        }
        admissions[handId]=Admission(tableId,root,mask,uint64(block.timestamp));
        emit AbuseHandAdmitted(handId,tableId,root,mask,policyHash[tableId]);
    }
    function _member(bytes32 handId,address player)private view returns(bool){
        uint16 mask=admissions[handId].mask;
        for(uint8 i;i<9;i++)if((mask&(uint16(1)<<i))!=0&&admittedPlayer[handId][i]==player)return true;
        return false;
    }
    function report(bytes32 handId,address target,Category category,bytes32 evidence,uint64 expectedNonce)external returns(bytes32 id){
        Admission memory a=admissions[handId];
        if(uint256(a.root)<1||block.timestamp>uint256(a.admittedAt)+7 days||uint256(evidence)<1||target==msg.sender||
           !_member(handId,msg.sender)||!_member(handId,target))revert InvalidState();
        bytes32 pair=keccak256(abi.encode(handId,msg.sender,target));if(reportedPair[pair])revert RateLimited();
        ReportUsage storage use=reportUsage[a.tableId][msg.sender];uint64 day=uint64(block.timestamp/1 days);
        if(use.day!=day){use.day=day;use.count=0;}if(use.count>=policies[a.tableId].reportsPerDay)revert RateLimited();
        _nonce(a.tableId,expectedNonce);++use.count;reportedPair[pair]=true;
        id=keccak256(abi.encode(DOMAIN,block.chainid,address(this),a.tableId,handId,msg.sender,target,playerNonce[a.tableId][msg.sender]));
        cases[id]=Case(handId,msg.sender,target,evidence,category,uint64(block.timestamp),false);
        emit AbuseCaseReported(id,handId,msg.sender,target,category,evidence);
    }
    function _reviewer(bytes32 id,address actor)private view returns(bytes32 tableId){
        Case storage c=cases[id];if(c.reportedAt==0)revert InvalidState();tableId=admissions[c.handId].tableId;
        _independent(actor,tableId,c.reporter,c.target,ACTION_REVIEW);
    }
    function propose(bytes32 id,uint32 duration,bytes32 reason)external returns(bytes32 digest){
        bytes32 tableId=_reviewer(id,msg.sender);Case storage c=cases[id];Policy storage p=policies[tableId];
        if(c.finalized||reviews[id].proposer!=address(0)||reason==bytes32(0)||block.timestamp>uint256(c.reportedAt)+7 days||
           (duration!=0&&(duration<60||duration>p.maxRestriction)))revert InvalidState();
        uint64 after_=uint64(block.timestamp+p.reviewDelay);uint64 expires=uint64(block.timestamp+2*p.reviewDelay+1 days);
        digest=keccak256(abi.encode(DOMAIN,id,c.evidence,duration,reason,msg.sender,after_,expires));
        reviews[id]=Review(reason,digest,msg.sender,address(0),after_,expires,duration,false,bytes32(0));
        emit RestrictionProposed(id,digest,msg.sender,after_,duration,reason);
    }
    function confirm(bytes32 id,bytes32 expectedDigest)external {
        _reviewer(id,msg.sender);Review storage r=reviews[id];
        if(cases[id].finalized||r.proposer==address(0)||r.proposer==msg.sender||r.confirmer!=address(0)||r.digest!=expectedDigest||block.timestamp>r.expiresAt)revert InvalidState();
        _reviewer(id,r.proposer);r.confirmer=msg.sender;emit RestrictionConfirmed(id,msg.sender,r.digest);
    }
    function appeal(bytes32 id,bytes32 evidence)external {
        Case storage c=cases[id];Review storage r=reviews[id];
        if(msg.sender!=c.target||c.finalized||r.proposer==address(0)||r.appealed||evidence==bytes32(0)||block.timestamp>=r.executableAfter)revert InvalidState();
        r.appealed=true;r.appealEvidence=evidence;r.executableAfter+=policies[admissions[c.handId].tableId].reviewDelay;
        emit AbuseCaseAppealed(id,evidence,r.executableAfter);
    }
    function cancel(bytes32 id,bytes32 reason)external {
        _reviewer(id,msg.sender);Review storage r=reviews[id];
        if(cases[id].finalized||reason==bytes32(0)||(msg.sender!=r.proposer&&msg.sender!=r.confirmer))revert Unauthorized();
        cases[id].finalized=true;emit AbuseCaseCancelled(id,msg.sender,reason);emit AbuseCaseClosed(id,false,cases[id].target,0,0);
    }
    function activate(bytes32 id)external {
        Case storage c=cases[id];Review storage r=reviews[id];
        if(c.finalized||r.proposer==address(0)||r.confirmer==address(0))revert InvalidState();
        bytes32 tableId=_reviewer(id,r.proposer);_reviewer(id,r.confirmer);
        if(block.timestamp<r.executableAfter)revert TooEarly();if(block.timestamp>r.expiresAt)revert Expired();
        c.finalized=true;Restriction storage ban=restrictions[tableId][c.target];
        if(r.duration!=0){
            if(ban.until>block.timestamp)revert InvalidState();
            ban.until=uint64(block.timestamp+r.duration);++ban.revision;ban.sourceCase=id;
        }
        emit AbuseCaseClosed(id,r.duration!=0,c.target,ban.until,ban.revision);
    }
    function proposeLift(bytes32 id,bytes32 reason)external {
        bytes32 tableId=_reviewer(id,msg.sender);Restriction storage ban=restrictions[tableId][cases[id].target];
        if(!cases[id].finalized||ban.sourceCase!=id||ban.until<=block.timestamp||reason==bytes32(0)||
           (lifts[id].proposer!=address(0)&&block.timestamp<=lifts[id].expiresAt))revert InvalidState();
        uint64 after_=uint64(block.timestamp+policies[tableId].reviewDelay);
        uint64 expires=uint64(uint256(after_)+1 days);
        bytes32 digest=keccak256(abi.encode(DOMAIN,id,reason,msg.sender,ban.revision,after_,expires));
        lifts[id]=Lift(reason,digest,msg.sender,address(0),ban.revision,after_,expires);
        emit RestrictionLiftProposed(id,msg.sender,ban.revision,reason,after_);
    }
    function confirmLift(bytes32 id,bytes32 expectedDigest)external {
        _reviewer(id,msg.sender);Lift storage l=lifts[id];
        if(l.proposer==address(0)||l.proposer==msg.sender||l.confirmer!=address(0)||l.digest!=expectedDigest||block.timestamp>l.expiresAt)revert InvalidState();
        _reviewer(id,l.proposer);l.confirmer=msg.sender;emit RestrictionLiftConfirmed(id,msg.sender,l.revision);
    }
    function activateLift(bytes32 id)external {
        Lift storage l=lifts[id];bytes32 tableId=_reviewer(id,l.proposer);_reviewer(id,l.confirmer);
        Restriction storage ban=restrictions[tableId][cases[id].target];
        if(l.proposer==address(0)||l.confirmer==address(0)||ban.sourceCase!=id||ban.revision!=l.revision)revert Stale();
        if(block.timestamp<l.executableAfter)revert TooEarly();if(block.timestamp>l.expiresAt)revert Expired();
        ban.until=0;++ban.revision;emit RestrictionLifted(id,cases[id].target,ban.revision);
    }
}
