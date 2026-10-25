// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./FantasySeasonRoster420.sol";
interface ISeasonTransactionBinding420{function actions() external view returns(address);function transactions() external view returns(address);function stateOf(bytes32 id) external view returns(uint8);}
contract FantasySeasonTransactions420{
    bytes32 public constant DOMAIN=keccak256("420.FANTASY.SEASON.TRANSACTIONS.V1");
    FantasySeasonData420 public immutable data;
    FantasySeasonRoster420 public immutable roster;
    address public host;address public actions;
    struct Claim{uint32 add;uint32 drop;}
    struct Trade{uint8 a;uint8 b;uint32[] give;uint32[] take;uint64 acceptedAt;bool challenged;bool blocked;bool closed;bytes32 reason;uint64 reviewedAt;}
    mapping(bytes32=>mapping(uint16=>mapping(uint8=>bytes32))) public queueCommitment;
    mapping(bytes32=>mapping(uint16=>mapping(uint8=>uint64))) public queueUpdatedAt;
    mapping(bytes32=>mapping(uint16=>mapping(uint8=>Claim[]))) private queues;
    mapping(bytes32=>mapping(uint16=>mapping(uint8=>bool))) public queueRevealed;
    mapping(bytes32=>mapping(uint16=>bool)) public processed;
    mapping(bytes32=>Trade[]) private trades;
    mapping(bytes32=>uint8[]) private priority;
    error Invalid();
    event WaiverCommitted(bytes32 indexed league,uint16 indexed week,uint8 member,bytes32 commitment,bytes envelope);
    event WaiverProcessed(bytes32 indexed league,uint16 indexed week,uint8 member,uint32 add,uint32 drop);
    event TradeReview(bytes32 indexed league,uint256 indexed proposal,bool blocked,bytes32 reason);
    constructor(address data_,address roster_){data=FantasySeasonData420(data_);roster=FantasySeasonRoster420(roster_);if(address(roster.data())!=data_)revert Invalid();}
    modifier onlyActions(){if(msg.sender!=actions||actions==address(0))revert Invalid();_;}
    function bindHost(address host_) external{
        BetAuthorization420 auth=data.authorization();if(host!=address(0)||host_.code.length==0||!auth.isAuthorized(msg.sender,keccak256("BET_FANTASY_BIND_SEASON_HOST.V1"),auth.scopeGlobal(),0))revert Invalid();host=host_;actions=ISeasonTransactionBinding420(host_).actions();if(ISeasonTransactionBinding420(host_).transactions()!=address(this))revert Invalid();
    }
    function priorityOf(bytes32 id) external view returns(uint8[] memory){return priority[id].length==0?roster.priorityOf(id):priority[id];}
    function commitWaivers(bytes32 id,uint16 week,uint8 m,bytes32 committed,bytes calldata envelope) external onlyActions{
        if(week<2||week>data.configOf(id).periodCount||block.timestamp>=data.periodOf(id,week).claimCutoff||m==0||m>roster.leagueOf(id).count||committed==0||envelope.length>65536)revert Invalid();
        queueCommitment[id][week][m]=committed;queueUpdatedAt[id][week][m]=uint64(block.timestamp);queueRevealed[id][week][m]=false;emit WaiverCommitted(id,week,m,committed,envelope);
    }
    function revealWaivers(bytes32 id,uint16 week,uint8 m,Claim[] calldata claims,bytes32 salt) external{
        if(block.timestamp<data.periodOf(id,week).claimCutoff||queueRevealed[id][week][m]||claims.length>32||keccak256(abi.encode(DOMAIN,block.chainid,address(this),id,week,m,claims,salt))!=queueCommitment[id][week][m])revert Invalid();
        queueRevealed[id][week][m]=true;for(uint256 i;i<claims.length;i++)queues[id][week][m].push(claims[i]);
    }
    function propose(bytes32 id,uint8 a,uint8 b,uint32[] calldata give,uint32[] calldata take) external onlyActions returns(uint256 index){
        if(a==b||a==0||b==0||a>roster.leagueOf(id).count||b>roster.leagueOf(id).count||give.length==0||give.length!=take.length||give.length>12||block.timestamp>=data.configOf(id).tradeDeadline)revert Invalid();
        for(uint256 i;i<give.length;i++){if(roster.owner(id,give[i])!=a||roster.owner(id,take[i])!=b)revert Invalid();for(uint256 j;j<i;j++)if(give[i]==give[j]||take[i]==take[j])revert Invalid();}
        index=trades[id].length;trades[id].push();Trade storage t=trades[id][index];t.a=a;t.b=b;t.give=give;t.take=take;
    }
    function accept(bytes32 id,uint256 index,uint8 m) external onlyActions{
        Trade storage t=trades[id][index];if(t.closed||t.acceptedAt!=0||m!=t.b||block.timestamp>=data.configOf(id).tradeDeadline)revert Invalid();t.acceptedAt=uint64(block.timestamp);
    }
    function challengeTrade(bytes32 id,uint256 index,bytes32 evidence) external onlyActions{
        Trade storage t=trades[id][index];if(t.closed||t.acceptedAt==0||evidence==0)revert Invalid();t.challenged=true;
    }
    function reviewTrade(bytes32 id,uint256 index,bool blocked_,bytes32 reason) external onlyActions{
        Trade storage t=trades[id][index];if(t.closed||t.acceptedAt==0||reason==0)revert Invalid();t.blocked=blocked_;t.challenged=false;t.reason=reason;t.reviewedAt=uint64(block.timestamp);emit TradeReview(id,index,blocked_,reason);
    }
    function tradeParties(bytes32 id,uint256 index) external view returns(uint8,uint8){Trade storage t=trades[id][index];return(t.a,t.b);}
    function _roll(bytes32 id,uint8 m) private{
        uint8[] storage q=priority[id];for(uint256 i;i<q.length;i++)if(q[i]==m){for(uint256 j=i;j+1<q.length;j++)q[j]=q[j+1];q[q.length-1]=m;break;}
    }
    function process(bytes32 id,uint16 week) external{
        FantasySeasonData420.Period memory p=data.periodOf(id,week);
        if(ISeasonTransactionBinding420(host).stateOf(id)!=2||roster.actor(id)!=0||week<2||week>data.configOf(id).periodCount||processed[id][week]||block.timestamp<p.processAt||block.timestamp>=p.lockAt||block.timestamp<data.periodOf(id,week-1).activeEnd)revert Invalid();
        if(priority[id].length==0){uint8[] memory initial=roster.priorityOf(id);for(uint256 i;i<initial.length;i++)priority[id].push(initial[i]);}
        // Accepted trades close at this immutable processing cutoff, never wait indefinitely.
        for(uint256 i;i<trades[id].length;i++){
            Trade storage t=trades[id][i];if(t.closed||t.acceptedAt==0)continue;
            t.closed=true;if(t.challenged||t.blocked||t.acceptedAt+1 days>p.processAt||p.processAt>=data.configOf(id).tradeDeadline)continue;
            bool valid=true;for(uint256 j;j<t.give.length;j++)if(roster.owner(id,t.give[j])!=t.a||roster.owner(id,t.take[j])!=t.b)valid=false;if(!valid)continue;
            if(roster.executeTrade(id,week,t.a,t.b,t.give,t.take))roster.noteIntent(id,week,t.reviewedAt>t.acceptedAt?t.reviewedAt:t.acceptedAt);

        }
        uint8 teams=roster.leagueOf(id).count;uint8[13] memory cursor;uint256 remaining;
        for(uint8 m=1;m<=teams;m++){
            if(queueCommitment[id][week][m]!=0&&!queueRevealed[id][week][m])revert Invalid();remaining+=queues[id][week][m].length;
        }
        while(remaining!=0){
            uint8[] memory round=priority[id];bool success;
            for(uint256 r;r<round.length;r++){
                uint8 m=round[r];Claim[] storage claims=queues[id][week][m];
                while(cursor[m]<claims.length){
                    Claim memory c=claims[cursor[m]++];remaining--;
                    if(!roster.executeClaim(id,week,m,c.add,c.drop))continue;
                    roster.noteIntent(id,week,queueUpdatedAt[id][week][m]);_roll(id,m);success=true;emit WaiverProcessed(id,week,m,c.add,c.drop);break;
                }
            }
            if(!success)break;
        }
        processed[id][week]=true;
    }
}
