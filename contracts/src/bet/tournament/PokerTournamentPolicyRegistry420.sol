// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../BetAuthorization420.sol";
import "../BetOperatorRegistry420.sol";
import "./PokerTournamentPolicy420.sol";

/// @notice Non-custodial tournament policy publication; PUBLISHED does not authorize play/funding.
/// @dev A later qualified executor must authenticate identity, funds, hands, levels and outcomes.
contract PokerTournamentPolicyRegistry420{
    bytes32 public constant RULESET=keccak256("420.BET.POKER.NLHE.TOURNAMENT.V1");
    bytes32 public constant CREATE=keccak256("BET_POKER_TOURNAMENT_POLICY_CREATE.V1");
    bytes32 public constant APPROVE=keccak256("BET_POKER_TOURNAMENT_POLICY_APPROVE.V1");
    bytes32 public constant PUBLISH=keccak256("BET_POKER_TOURNAMENT_POLICY_PUBLISH.V1");
    bytes32 public constant RETIRE=keccak256("BET_POKER_TOURNAMENT_POLICY_RETIRE.V1");
    enum Status{NONE,REGISTERED,APPROVED,PUBLISHED,RETIRED}
    struct Record{PokerTournamentPolicy420.Config config;bytes32 digest;address publisher;Status status;}
    BetAuthorization420 public immutable authorization;BetOperatorRegistry420 public immutable operators;address public immutable asset;
    mapping(bytes32=>Record) private records;
    error Invalid();error Unauthorized();
    event Registered(bytes32 indexed id,bytes32 indexed digest,address publisher);
    event StatusChanged(bytes32 indexed id,Status status);
    constructor(address auth,address operatorRegistry,address asset_){
        if(auth.code.length==0||operatorRegistry.code.length==0||asset_.code.length==0)revert Invalid();
        authorization=BetAuthorization420(auth);operators=BetOperatorRegistry420(operatorRegistry);asset=asset_;
        if(address(operators.authorization())!=auth)revert Invalid();
    }
    function scope(bytes32 id) public view returns(bytes32){return keccak256(abi.encode("420.BET.SCOPE.TOURNAMENT.POLICY.V1",block.chainid,address(this),id));}
    function digest(bytes32 id,PokerTournamentPolicy420.Config memory c) public view returns(bytes32){return keccak256(abi.encode(RULESET,block.chainid,address(this),id,asset,c));}
    function _cap(bytes32 id,bytes32 action) private view{if(!authorization.isAuthorized(msg.sender,action,scope(id),0))revert Unauthorized();}
    function register(bytes32 id,PokerTournamentPolicy420.Config calldata c) external{
        if(id==0||records[id].status!=Status.NONE)revert Invalid();_cap(id,CREATE);PokerTournamentPolicy420.validate(c,block.timestamp);
        BetOperatorRegistry420.Operator memory op=operators.getOperator(c.operatorId);
        if(op.status!=BetOperatorRegistry420.OperatorStatus.ACTIVE||op.operatorAccount!=msg.sender)revert Unauthorized();
        bytes32 h=digest(id,c);records[id]=Record(c,h,msg.sender,Status.REGISTERED);emit Registered(id,h,msg.sender);
    }
    function approve(bytes32 id) external{_cap(id,APPROVE);Record storage r=records[id];if(r.status!=Status.REGISTERED)revert Invalid();r.status=Status.APPROVED;emit StatusChanged(id,r.status);}
    function publish(bytes32 id) external{
        _cap(id,PUBLISH);Record storage r=records[id];if(r.status!=Status.APPROVED||msg.sender!=r.publisher||!operators.isActive(r.config.operatorId)||block.timestamp>=r.config.registrationOpens)revert Invalid();
        r.status=Status.PUBLISHED;emit StatusChanged(id,r.status);
    }
    function retire(bytes32 id) external{_cap(id,RETIRE);Record storage r=records[id];if(r.status==Status.NONE||r.status==Status.RETIRED)revert Invalid();r.status=Status.RETIRED;emit StatusChanged(id,r.status);}
    function get(bytes32 id) external view returns(Record memory){if(records[id].status==Status.NONE)revert Invalid();return records[id];}
    function usableForNewEvent(bytes32 id) external view returns(bool){Record storage r=records[id];return r.status==Status.PUBLISHED&&block.timestamp<uint256(r.config.startOrRegistrationDeadline)+r.config.underfillGrace&&operators.isActive(r.config.operatorId);}
    function quote(bytes32 id) external view returns(uint256 buyIn,uint256 fee,uint256 total,uint256 chips){
        Record storage r=records[id];if(r.status==Status.NONE)revert Invalid();buyIn=r.config.buyIn;fee=PokerTournamentPolicy420.fee(buyIn);total=buyIn+fee;chips=r.config.startingStack;
    }
    function defaultGracePolicy() external pure returns(uint32 underfill,uint32 technical,uint32 choice,uint32 recovery){return(1800,600,60,86400);}
    function acceptsFunds() external pure returns(bool){return false;}
}
