// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./FantasySeasonData420.sol";
import "./FantasySeasonMath420.sol";
interface ISeasonActionsBinding420{function actions() external view returns(address);function transactions() external view returns(address);function stateOf(bytes32 id) external view returns(uint8);}
interface ISeasonProcessed420{function processed(bytes32 id,uint16 week) external view returns(bool);}

/// @notice Exclusive season rosters, verifiable draft and deterministic period transitions.
/// @dev Host authenticates users. Preference Merkle proofs reveal no future ranked choices.
contract FantasySeasonRoster420 {
    bytes32 public constant DOMAIN=keccak256("420.FANTASY.SEASON.ROSTER.V1");
    bytes32 public constant BIND=keccak256("BET_FANTASY_BIND_SEASON_HOST.V1");
    FantasySeasonData420 public immutable data;
    address public host;
    address public actions;
    address public transactions;
    FantasySeasonMath420 public immutable math;
    struct League{uint8 count;uint16 picks;uint64 turnStarted;bytes32 entropy;bytes32 proofHash;bool configured;}
    struct Member{bytes32 subject;bytes32 userKey;address controller;bytes32 preferenceRoot;uint16 preferenceLength;}
    struct Preference{uint16 index;uint32 athlete;bytes32 salt;bytes32[] proof;}
    mapping(bytes32=>League) private leagues;
    mapping(bytes32=>uint32[]) private ranking;
    mapping(bytes32=>mapping(uint256=>uint256)) private rankingSeen;
    mapping(bytes32=>mapping(uint8=>Member)) private members;
    mapping(bytes32=>uint8[]) private orders;
    mapping(bytes32=>uint8[]) private priority;
    mapping(bytes32=>mapping(uint8=>uint32[])) private rosters;
    mapping(bytes32=>mapping(uint32=>uint8)) public owner;
    mapping(bytes32=>mapping(uint8=>mapping(uint8=>uint16))) private ownCounts;
    mapping(bytes32=>mapping(uint8=>uint16)) private freeCounts;
    mapping(bytes32=>mapping(uint16=>mapping(uint8=>uint32[7]))) private lineups;
    mapping(bytes32=>mapping(uint16=>mapping(uint8=>bool))) public lineupSet;
    mapping(bytes32=>mapping(uint16=>bool)) public locked;
    mapping(bytes32=>mapping(uint16=>uint64)) public lastEdit;
    mapping(bytes32=>uint16) public preferenceCursor;
    mapping(bytes32=>uint16) public platformCursor;
    mapping(bytes32=>uint16) public scanPick;
    mapping(bytes32=>mapping(uint32=>uint16)) public availableWeek;
    error Invalid();
    event PreferenceCommitted(bytes32 indexed league,uint8 indexed member,bytes32 root,uint16 length,bytes envelope);
    event DraftPick(bytes32 indexed league,uint16 pick,uint8 indexed member,uint32 athlete,bool automatic);
    event Lineup(bytes32 indexed league,uint16 indexed week,uint8 indexed member,uint32[7] athletes);
    event WaiverCommitted(bytes32 indexed league,uint16 indexed week,uint8 member,bytes32 commitment,bytes envelope);
    event WaiverProcessed(bytes32 indexed league,uint16 indexed week,uint8 member,uint32 add,uint32 drop);
    event TradeReview(bytes32 indexed league,uint256 indexed proposal,bool blocked,bytes32 reason);
    constructor(address data_){if(data_.code.length==0)revert Invalid();data=FantasySeasonData420(data_);math=new FantasySeasonMath420();}
    modifier onlyHost(){if(msg.sender!=host||host==address(0))revert Invalid();_;}
    modifier onlyActions(){if(msg.sender!=actions||actions==address(0))revert Invalid();_;}
    function bindHost(address host_) external{
        BetAuthorization420 auth=data.authorization();if(host!=address(0)||host_.code.length==0||!auth.isAuthorized(msg.sender,BIND,auth.scopeGlobal(),0))revert Invalid();host=host_;actions=ISeasonActionsBinding420(host_).actions();transactions=ISeasonActionsBinding420(host_).transactions();if(actions.code.length==0||transactions.code.length==0)revert Invalid();
    }
    function _publisher(bytes32 id) private view{
        BetAuthorization420 auth=data.authorization();if(!data.isSealed(id)||leagues[id].configured||block.timestamp>=data.configOf(id).fundingEnd||!auth.isAuthorized(msg.sender,data.PUBLISH(),auth.scopeForContest(id),0))revert Invalid();
    }
    function _appendRanking(bytes32 id,uint32[] calldata ranked) private{
        if(ranked.length==0||ranked.length>200||ranking[id].length+ranked.length>data.athleteCount(id))revert Invalid();
        for(uint256 i;i<ranked.length;i++){
            uint8 pos=data.positions(id,ranked[i]);uint16 ordinal=data.athleteOrdinal(id,ranked[i]);uint256 word=ordinal>>8;uint256 bit=uint256(1)<<(ordinal&255);
            if(pos==0||ordinal==0||rankingSeen[id][word]&bit!=0)revert Invalid();rankingSeen[id][word]|=bit;
            ranking[id].push(ranked[i]);freeCounts[id][pos]++;
        }
    }
    function _sealRanking(bytes32 id) private{
        FantasySeasonData420.Config memory c=data.configOf(id);
        if(ranking[id].length!=data.athleteCount(id)||keccak256(abi.encode(ranking[id]))!=c.rankingHash)revert Invalid();
        uint16[32][] memory empty=new uint16[32][](c.teams);uint16[32] memory available;
        for(uint8 p=1;p<32;p++)available[p]=freeCounts[id][p];if(!math.leagueFeasible(empty,available))revert Invalid();leagues[id].configured=true;
    }
    function configure(bytes32 id,uint32[] calldata ranked) external{_publisher(id);if(ranking[id].length!=0)revert Invalid();_appendRanking(id,ranked);_sealRanking(id);}
    function appendRanking(bytes32 id,uint32[] calldata ranked) external{_publisher(id);_appendRanking(id,ranked);}
    function sealRanking(bytes32 id) external{_publisher(id);_sealRanking(id);}
    function leagueOf(bytes32 id) external view returns(League memory){return leagues[id];}
    function memberOf(bytes32 id,uint8 m) external view returns(Member memory){return members[id][m];}
    function rosterOf(bytes32 id,uint8 m) external view returns(uint32[] memory){return rosters[id][m];}
    function orderOf(bytes32 id) external view returns(uint8[] memory){return orders[id];}
    function priorityOf(bytes32 id) external view returns(uint8[] memory){return priority[id];}
    function lineupOf(bytes32 id,uint16 week,uint8 m) external view returns(uint32[7] memory){if(!locked[id][week])revert Invalid();return lineups[id][week][m];}
    function join(bytes32 id,bytes32 subject,bytes32 userKey,address controller) external onlyHost returns(uint8 m){
        League storage l=leagues[id];FantasySeasonData420.Config memory c=data.configOf(id);
        if(!l.configured||block.timestamp>=c.fundingEnd||l.count>=c.teams)revert Invalid();m=++l.count;
        members[id][m]=Member(subject,userKey,controller,bytes32(0),0);
    }
    function preferences(bytes32 id,uint8 m,bytes32 root,uint16 length,bytes calldata envelope) external onlyActions{
        if(m==0||m>leagues[id].count||block.timestamp>=data.configOf(id).draftStart||length>ranking[id].length||(length==0)!=(root==0)||envelope.length>131072)revert Invalid();
        members[id][m].preferenceRoot=root;members[id][m].preferenceLength=length;emit PreferenceCommitted(id,m,root,length,envelope);
    }
    function start(bytes32 id,bytes32 entropy,bytes32 proofHash) external onlyHost{
        League storage l=leagues[id];FantasySeasonData420.Config memory c=data.configOf(id);
        if(l.count!=c.teams||l.entropy!=0||entropy==0||proofHash==0||block.timestamp<c.fundingEnd||block.timestamp>=c.draftStart)revert Invalid();
        l.entropy=entropy;l.proofHash=proofHash;l.turnStarted=c.draftStart;
        uint256[] memory permutation=math.shuffle(entropy,keccak256(abi.encode(DOMAIN,id)),c.teams);
        for(uint256 i;i<permutation.length;i++)orders[id].push(uint8(permutation[i]));
        for(uint256 i=permutation.length;i>0;i--)priority[id].push(uint8(permutation[i-1]));
    }
    function actor(bytes32 id) public view returns(uint8){
        League storage l=leagues[id];if(l.entropy==0||l.picks>=uint16(l.count)*12)return 0;
        uint256 round=l.picks/l.count;uint256 index=l.picks%l.count;return orders[id][round%2==0?index:l.count-1-index];
    }
    function _slot(uint8 i) private pure returns(uint8){return i==0?1:i==1?2:i==2?4:i<5?8:i==5?16:15;}
    function _hall(uint16[32] memory counts,uint8 remainingSlots) private view returns(bool){return math.deficiency(counts,remainingSlots)==0;}
    function _fillable(bytes32 id,uint8 m) private view returns(bool){
        uint16[32] memory counts;for(uint8 p=1;p<32;p++)counts[p]=ownCounts[id][m][p];return _hall(counts,127);
    }
    function _futureWith(bytes32 id,uint8 m,uint8 picker,uint8 newPos) private view returns(bool){
        uint16[32] memory own;uint16[32] memory all;
        for(uint8 p=1;p<32;p++){own[p]=ownCounts[id][m][p]+(p==newPos&&m==picker?1:0);all[p]=own[p]+freeCounts[id][p]-(p==newPos?1:0);}
        if(!_hall(all,127))return false;
        uint256 remaining=12-rosters[id][m].length-(m==picker?1:0);
        if(math.deficiency(own,127)>remaining)return false;
        return true;
    }
    function canPick(bytes32 id,uint8 m,uint32 athlete) public view returns(bool){
        uint8 pos=data.positions(id,athlete);if(m==0||m>leagues[id].count||pos==0||owner[id][athlete]!=0||rosters[id][m].length>=12)return false;
        uint8 count=leagues[id].count;uint16[32][] memory owned=new uint16[32][](count);uint16[32] memory free;
        for(uint8 p=1;p<32;p++)free[p]=freeCounts[id][p]-(p==pos?1:0);
        for(uint8 other=1;other<=count;other++){
            for(uint8 p=1;p<32;p++)owned[other-1][p]=ownCounts[id][other][p]+(other==m&&p==pos?1:0);
            if(math.deficiency(owned[other-1],127)>12-rosters[id][other].length-(other==m?1:0))return false;
        }
        return math.leagueFeasible(owned,free);
    }
    function _ownedRank(bytes32 id,uint8 m,uint8 extra) private view returns(uint256){
        uint16[32] memory counts;for(uint8 p=1;p<32;p++)counts[p]=ownCounts[id][m][p]+(p==extra?1:0);uint256 deficiency;
        deficiency=math.deficiency(counts,127);
        return 7-deficiency;
    }
    function _autoEligible(bytes32 id,uint8 m,uint32 athlete,uint256 rank) private view returns(bool){
        if(owner[id][athlete]!=0||data.positions(id,athlete)==0)return false;
        return (rank==7||_ownedRank(id,m,data.positions(id,athlete))>rank)&&canPick(id,m,athlete);
    }
    function autoEligible(bytes32 id,uint32 athlete) external view returns(bool){uint8 m=actor(id);return m!=0&&_autoEligible(id,m,athlete,_ownedRank(id,m,0));}
    function _add(bytes32 id,uint8 m,uint32 athlete) private{
        uint8 pos=data.positions(id,athlete);if(pos==0||owner[id][athlete]!=0||rosters[id][m].length>=12)revert Invalid();
        owner[id][athlete]=m;rosters[id][m].push(athlete);ownCounts[id][m][pos]++;freeCounts[id][pos]--;
    }
    function _remove(bytes32 id,uint8 m,uint32 athlete) private{
        if(owner[id][athlete]!=m)revert Invalid();uint32[] storage roster=rosters[id][m];
        for(uint256 i;i<roster.length;i++)if(roster[i]==athlete){roster[i]=roster[roster.length-1];roster.pop();break;}
        uint8 pos=data.positions(id,athlete);owner[id][athlete]=0;ownCounts[id][m][pos]--;freeCounts[id][pos]++;
    }
    function _pick(bytes32 id,uint8 m,uint32 athlete,bool automatic) private{
        if(!canPick(id,m,athlete))revert Invalid();_add(id,m,athlete);League storage l=leagues[id];
        l.picks++;l.turnStarted=uint64(block.timestamp);preferenceCursor[id]=0;platformCursor[id]=0;scanPick[id]=l.picks;emit DraftPick(id,l.picks,m,athlete,automatic);
    }
    function pick(bytes32 id,uint8 m,uint32 athlete) external onlyActions{
        League storage l=leagues[id];
        if(m!=actor(id)||m==0||block.timestamp<l.turnStarted||block.timestamp>=l.turnStarted+60||block.timestamp>=data.periodOf(id,1).lockAt)revert Invalid();
        _pick(id,m,athlete,false);
    }
    function preferenceLeaf(bytes32 id,uint8 m,uint16 index,uint32 athlete,bytes32 salt) public view returns(bytes32){return keccak256(bytes.concat(keccak256(abi.encode(DOMAIN,block.chainid,address(this),id,m,index,athlete,salt))));}
    function _proof(bytes32 root,bytes32 value,bytes32[] calldata proof) private view returns(bool){return math.verify(root,value,proof);}
    /// Prefix proves earlier choices unavailable, infeasible or lower position priority.
    function autoPick(bytes32 id,Preference[] calldata prefix) external onlyActions{
        League storage l=leagues[id];uint8 m=actor(id);Member storage member=members[id][m];
        if(m==0||prefix.length>1||block.timestamp<l.turnStarted+60||block.timestamp>=data.periodOf(id,1).lockAt)revert Invalid();
        if(scanPick[id]!=l.picks){preferenceCursor[id]=0;platformCursor[id]=0;scanPick[id]=l.picks;}
        uint32 selected;uint256 rank=_ownedRank(id,m,0);
        for(uint256 i;i<prefix.length;i++){
            Preference calldata p=prefix[i];if(p.index!=preferenceCursor[id]||p.index>=member.preferenceLength||!_proof(member.preferenceRoot,preferenceLeaf(id,m,p.index,p.athlete,p.salt),p.proof))revert Invalid();preferenceCursor[id]++;
            if(_autoEligible(id,m,p.athlete,rank)){if(i+1!=prefix.length)revert Invalid();selected=p.athlete;break;}
        }
        if(selected==0){
            if(preferenceCursor[id]<member.preferenceLength){if(prefix.length==0)revert Invalid();return;}
            // Fallback is frozen before funding, not supplied by the worker.
            uint256 end=uint256(platformCursor[id])+1;if(end>ranking[id].length)end=ranking[id].length;
            for(uint256 i=platformCursor[id];i<end;i++){platformCursor[id]++;if(_autoEligible(id,m,ranking[id][i],rank)){selected=ranking[id][i];break;}}
            if(selected==0&&platformCursor[id]<ranking[id].length)return;
        }
        if(selected==0)revert Invalid();_pick(id,m,selected,true);
    }
    function setLineup(bytes32 id,uint16 week,uint8 m,uint32[7] calldata selected) external onlyActions{
        FantasySeasonData420.Period memory p=data.periodOf(id,week);
        if(p.lockAt==0||block.timestamp>=p.lockAt||locked[id][week]||m==0||m>leagues[id].count||actor(id)!=0)revert Invalid();
        _validate(id,m,selected);lineups[id][week][m]=selected;lineupSet[id][week][m]=true;lastEdit[id][week]=uint64(block.timestamp);emit Lineup(id,week,m,selected);
    }
    function _validate(bytes32 id,uint8 m,uint32[7] memory selected) private view{
        for(uint8 s;s<7;s++){
            if(owner[id][selected[s]]!=m||data.positions(id,selected[s])&_slot(s)==0)revert Invalid();for(uint8 j;j<s;j++)if(selected[s]==selected[j])revert Invalid();
        }
    }
    function _fallback(bytes32 id,uint8 m,uint32[7] memory previous) private view returns(uint32[7] memory selected){
        uint32[] memory list=rosters[id][m];
        for(uint256 i=1;i<list.length;i++){uint32 v=list[i];uint256 j=i;while(j>0&&list[j-1]>v){list[j]=list[j-1];j--;}list[j]=v;}
        // Preserve surviving slots first, in published slot order, with full feasibility.
        for(uint8 s;s<7;s++){
            uint32 aid=previous[s];if(aid==0||owner[id][aid]!=m||data.positions(id,aid)&_slot(s)==0)continue;
            bool used;for(uint8 j;j<7;j++)if(selected[j]==aid)used=true;if(used)continue;
            selected[s]=aid;uint16[32] memory candidate;for(uint8 pos=1;pos<32;pos++)candidate[pos]=ownCounts[id][m][pos];uint8 candidateRemaining=127;
            for(uint8 j;j<7;j++)if(selected[j]!=0){candidate[data.positions(id,selected[j])]--;candidateRemaining^=uint8(1)<<j;}
            if(!_hall(candidate,candidateRemaining))selected[s]=0;
        }
        uint16[32] memory counts;for(uint8 pos=1;pos<32;pos++)counts[pos]=ownCounts[id][m][pos];uint8 remaining=127;
        for(uint8 j;j<7;j++)if(selected[j]!=0){counts[data.positions(id,selected[j])]--;remaining^=uint8(1)<<j;}
        for(uint8 s;s<7;s++){
            if(selected[s]!=0)continue;bool found;
            for(uint256 n;n<list.length;n++){
                uint32 aid=list[n];uint8 pos=data.positions(id,aid);if(pos&_slot(s)==0)continue;bool used;
                for(uint8 j;j<7;j++)if(selected[j]==aid)used=true;if(used)continue;
                counts[pos]--;uint8 next=remaining^(uint8(1)<<s);
                if(_hall(counts,next)){selected[s]=aid;remaining=next;found=true;break;}counts[pos]++;
            }
            if(!found)revert Invalid();
        }
    }
    function lock(bytes32 id,uint16 week) external{
        if(ISeasonActionsBinding420(host).stateOf(id)!=2||week==0||week>data.configOf(id).periodCount||!data.isSealed(id)||locked[id][week]||block.timestamp<data.periodOf(id,week).lockAt||actor(id)!=0||(week>1&&!ISeasonProcessed420(transactions).processed(id,week)))revert Invalid();
        for(uint8 m=1;m<=leagues[id].count;m++){
            if(!lineupSet[id][week][m]){
                uint32[7] memory previous=week>1?lineups[id][week-1][m]:[uint32(0),0,0,0,0,0,0];
                lineups[id][week][m]=_fallback(id,m,previous);lineupSet[id][week][m]=true;emit Lineup(id,week,m,lineups[id][week][m]);
            }
        }
        locked[id][week]=true;
    }
    modifier onlyTransactions(){if(msg.sender!=transactions||transactions==address(0))revert Invalid();_;}
    function noteIntent(bytes32 id,uint16 week,uint64 at) external onlyTransactions{if(at>lastEdit[id][week])lastEdit[id][week]=at;}
    function _invalidateFuture(bytes32 id,uint16 week,uint8 m) private{
        for(uint16 w=week;w<=data.configOf(id).periodCount;w++)if(!locked[id][w])lineupSet[id][w][m]=false;
    }
    function executeClaim(bytes32 id,uint16 week,uint8 m,uint32 add,uint32 drop) external onlyTransactions returns(bool){
        if(data.positions(id,add)==0||owner[id][add]!=0||owner[id][drop]!=m||availableWeek[id][add]>week)return false;
        _remove(id,m,drop);_add(id,m,add);
        if(!_fillable(id,m)){_remove(id,m,add);_add(id,m,drop);return false;}
        availableWeek[id][drop]=week+1;_invalidateFuture(id,week,m);return true;
    }
    function executeTrade(bytes32 id,uint16 week,uint8 a,uint8 b,uint32[] calldata give,uint32[] calldata take) external onlyTransactions returns(bool){
        for(uint256 j;j<give.length;j++)if(owner[id][give[j]]!=a||owner[id][take[j]]!=b)return false;
        for(uint256 j;j<give.length;j++){_remove(id,a,give[j]);_remove(id,b,take[j]);}
        for(uint256 j;j<give.length;j++){_add(id,a,take[j]);_add(id,b,give[j]);}
        if(!_fillable(id,a)||!_fillable(id,b)){
            for(uint256 j;j<give.length;j++){_remove(id,a,take[j]);_remove(id,b,give[j]);}
            for(uint256 j;j<give.length;j++){_add(id,a,give[j]);_add(id,b,take[j]);}return false;
        }
        _invalidateFuture(id,week,a);_invalidateFuture(id,week,b);return true;
    }
}
