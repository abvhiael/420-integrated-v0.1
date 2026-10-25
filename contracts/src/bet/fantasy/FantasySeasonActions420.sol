// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./FantasySeasonTransactions420.sol";
import "./FantasySeasonReceipt420.sol";
import "./FantasyAdmission420.sol";
interface IFantasySeasonHostView420{
    function stateOf(bytes32 id) external view returns(uint8);
    function manifestOf(bytes32 id) external view returns(bytes32);
    function launcherOf(bytes32 id) external view returns(bytes32);
}
/// @notice Authenticated user actions, separately deployed from prize custody.
contract FantasySeasonActions420{
    bytes32 public constant DOMAIN=keccak256("420.FANTASY.SEASON.ACTIONS.V1");
    bytes32 public constant REVIEW_TRADE=keccak256("BET_FANTASY_REVIEW_TRADE.V1");
    FantasySeasonData420 public immutable data;
    FantasySeasonRoster420 public immutable roster;
    FantasySeasonTransactions420 public immutable transactions;
    FantasyAdmission420 public immutable admission;
    FantasySeasonReceipt420 public immutable receiptVerifier;
    IFantasySeasonHostView420 public host;
    struct PrivateSubmission{bytes32 root;uint16 length;uint64 nonce;uint64 expiry;bytes envelope;bytes signature;}
    mapping(bytes32=>mapping(uint16=>mapping(uint8=>uint64))) public privateNonce;
    error Invalid();
    constructor(address data_,address roster_,address admission_,address transactions_){data=FantasySeasonData420(data_);roster=FantasySeasonRoster420(roster_);admission=FantasyAdmission420(admission_);if(address(roster.data())!=data_)revert Invalid();transactions=FantasySeasonTransactions420(transactions_);if(address(transactions.roster())!=roster_)revert Invalid();receiptVerifier=new FantasySeasonReceipt420(data_);}
    function bindHost(address host_) external{
        BetAuthorization420 auth=data.authorization();if(address(host)!=address(0)||host_.code.length==0||!auth.isAuthorized(msg.sender,keccak256("BET_FANTASY_BIND_SEASON_HOST.V1"),auth.scopeGlobal(),0))revert Invalid();host=IFantasySeasonHostView420(host_);
    }
    function _manager(bytes32 id,bytes32 subject) private view returns(uint8 m){
        admission.requireEntryActor(subject,msg.sender,id);uint8 count=roster.leagueOf(id).count;
        for(uint8 i=1;i<=count;i++)if(roster.memberOf(id,i).subject==subject){m=i;break;}
        if(m==0||admission.currentUserKey(subject)!=roster.memberOf(id,m).userKey||host.stateOf(id)>2||host.stateOf(id)==0)revert Invalid();
    }
    function privateDigest(bytes32 id,bytes32 subject,uint16 week,PrivateSubmission calldata s) public view returns(bytes32){return keccak256(abi.encode(DOMAIN,block.chainid,address(this),address(host),id,host.manifestOf(id),subject,week,s.root,s.length,s.nonce,s.expiry,keccak256(s.envelope)));}
    function setPrivate(bytes32 id,bytes32 subject,uint16 week,PrivateSubmission calldata s) external{
        uint8 m=_manager(id,subject);uint64 deadline=week==0?data.configOf(id).draftStart:data.periodOf(id,week).claimCutoff;
        if(s.nonce!=privateNonce[id][week][m]+1||block.timestamp>=deadline)revert Invalid();
        receiptVerifier.verify(id,privateDigest(id,subject,week,s),s.expiry,deadline,s.signature);privateNonce[id][week][m]=s.nonce;
        if(week==0)roster.preferences(id,m,s.root,s.length,s.envelope);else transactions.commitWaivers(id,week,m,s.root,s.envelope);
    }
    function pick(bytes32 id,bytes32 subject,uint32 athlete) external{uint8 m=_manager(id,subject);if(host.stateOf(id)!=2)revert Invalid();roster.pick(id,m,athlete);}
    function autoPick(bytes32 id,FantasySeasonRoster420.Preference[] calldata prefix) external{if(host.stateOf(id)!=2)revert Invalid();roster.autoPick(id,prefix);}
    function setLineup(bytes32 id,bytes32 subject,uint16 week,uint32[7] calldata lineup) external{roster.setLineup(id,week,_manager(id,subject),lineup);}
    function proposeTrade(bytes32 id,bytes32 subject,uint8 other,uint32[] calldata give,uint32[] calldata take) external returns(uint256){return transactions.propose(id,_manager(id,subject),other,give,take);}
    function acceptTrade(bytes32 id,bytes32 subject,uint256 proposal) external{transactions.accept(id,proposal,_manager(id,subject));}
    function challengeTrade(bytes32 id,bytes32 subject,uint256 proposal,bytes32 evidence) external{_manager(id,subject);transactions.challengeTrade(id,proposal,evidence);}
    function reviewTrade(bytes32 id,uint256 proposal,bytes32 subject,bytes32 credential,bool blocked_,bytes32 reason) external{
        BetAuthorization420 auth=data.authorization();bytes32 scope=keccak256(abi.encode(DOMAIN,id,proposal));admission.requireController(subject,msg.sender);bytes32 key=admission.credentialKey(subject,credential);
        if(host.stateOf(id)!=2||!auth.isAuthorized(msg.sender,REVIEW_TRADE,scope,0)||key==0||key==admission.currentUserKey(host.launcherOf(id))||key==data.configOf(id).custodianUserKey||data.related(id,key))revert Invalid();
        for(uint8 m=1;m<=roster.leagueOf(id).count;m++)if(roster.memberOf(id,m).userKey==key)revert Invalid();
        transactions.reviewTrade(id,proposal,blocked_,reason);
    }
}
