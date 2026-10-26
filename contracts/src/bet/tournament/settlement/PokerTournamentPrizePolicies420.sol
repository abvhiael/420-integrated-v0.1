// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../PokerTournamentPolicyRegistry420.sol";
/// @notice Versioned payout bands, immutable after registration; funds are never held here.
contract PokerTournamentPrizePolicies420 {
    bytes32 public constant DOMAIN=keccak256("420.BET.POKER.TOURNAMENT.PRIZES.V1");
    bytes32 public constant FULL_REFUND=keccak256("420.BET.POKER.TOURNAMENT.RECOVERY.FULL.REFUND.V1");
    bytes32 public constant ROUNDING=keccak256("420.BET.POKER.TOURNAMENT.RANK.ROUNDING.HASHED.TIE.V1");
    bytes32 public constant REGISTER=keccak256("BET_POKER_TOURNAMENT_PRIZES_REGISTER.V1");
    bytes32 public constant APPROVE=keccak256("BET_POKER_TOURNAMENT_PRIZES_APPROVE.V1");
    bytes32 public constant PUBLISH=keccak256("BET_POKER_TOURNAMENT_PRIZES_PUBLISH.V1");
    enum Status {NONE,REGISTERED,APPROVED,PUBLISHED}
    struct Record {bytes32 operatorId;bytes32 digest;address publisher;Status status;uint16 maximum;uint16 bands;}
    PokerTournamentPolicyRegistry420 public immutable policies;
    BetAuthorization420 public immutable authorization;
    mapping(bytes32=>Record)private records;
    mapping(bytes32=>uint16[])private limits;
    mapping(bytes32=>mapping(uint16=>uint16[]))private payouts;
    error Invalid();error Unauthorized();
    event Published(bytes32 indexed id,bytes32 digest,uint16 maximum);
    constructor(address p){if(p.code.length==0)revert Invalid();policies=PokerTournamentPolicyRegistry420(p);authorization=policies.authorization();}
    function scope(bytes32 id)public view returns(bytes32){return keccak256(abi.encode(DOMAIN,block.chainid,address(this),id));}
    function _cap(bytes32 id,bytes32 action)private view{if(!authorization.isAuthorized(msg.sender,action,scope(id),0))revert Unauthorized();}
    function register(bytes32 id,bytes32 operatorId,uint16[] calldata upper,uint16[][] calldata weights)external{
        _cap(id,REGISTER);BetOperatorRegistry420.Operator memory op=policies.operators().getOperator(operatorId);
        if(op.status!=BetOperatorRegistry420.OperatorStatus.ACTIVE||op.operatorAccount!=msg.sender)revert Unauthorized();
        if(id==0||records[id].status!=Status.NONE||upper.length==0||upper.length>64||upper.length!=weights.length)revert Invalid();
        uint16 previous=1;
        for(uint16 b;b<upper.length;b++){
            if(upper[b]<=previous||upper[b]>576||weights[b].length==0||weights[b].length>uint256(previous)+1)revert Invalid();
            if(b==0&&(upper[b]!=2||weights[b].length!=1||weights[b][0]!=10000))revert Invalid();
            uint256 sum;uint16 last=10000;for(uint256 i;i<weights[b].length;i++){uint16 w=weights[b][i];if(w==0||w>last)revert Invalid();sum+=w;last=w;}if(sum!=10000)revert Invalid();
            limits[id].push(upper[b]);payouts[id][b]=weights[b];previous=upper[b];
        }
        bytes32 digest=keccak256(abi.encode(DOMAIN,block.chainid,address(this),id,operatorId,upper,weights,FULL_REFUND,ROUNDING));
        records[id]=Record(operatorId,digest,msg.sender,Status.REGISTERED,previous,uint16(upper.length));
    }
    function approve(bytes32 id)external{_cap(id,APPROVE);if(records[id].status!=Status.REGISTERED)revert Invalid();records[id].status=Status.APPROVED;}
    function publish(bytes32 id)external{_cap(id,PUBLISH);Record storage r=records[id];if(r.status!=Status.APPROVED||r.publisher!=msg.sender||!policies.operators().isActive(r.operatorId))revert Invalid();r.status=Status.PUBLISHED;emit Published(id,r.digest,r.maximum);}
    function get(bytes32 id)external view returns(Record memory){if(records[id].status==Status.NONE)revert Invalid();return records[id];}
    function select(bytes32 id,uint32 unique)external view returns(uint16[] memory){Record storage r=records[id];if(r.status!=Status.PUBLISHED||unique<2||unique>r.maximum)revert Invalid();for(uint16 b;b<r.bands;b++)if(unique<=limits[id][b])return payouts[id][b];revert Invalid();}
    function acceptsFunds()external pure returns(bool){return false;}
}
