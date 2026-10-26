// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../PokerTournamentPolicyRegistry420.sol";

/// @notice Immutable opt-in C6 terms. Existing event manifests cannot acquire add-ons.
contract PokerTournamentPurchasePolicies420 {
    bytes32 public constant DOMAIN=keccak256("420.BET.POKER.TOURNAMENT.PURCHASE.POLICY.V1");
    bytes32 public constant REGISTER=keccak256("BET_POKER_TOURNAMENT_PURCHASE_POLICY_REGISTER.V1");
    bytes32 public constant APPROVE=keccak256("BET_POKER_TOURNAMENT_PURCHASE_POLICY_APPROVE.V1");
    bytes32 public constant PUBLISH=keccak256("BET_POKER_TOURNAMENT_PURCHASE_POLICY_PUBLISH.V1");
    enum Status { NONE,REGISTERED,APPROVED,PUBLISHED }
    struct Record {bytes32 basePolicy;bytes32 digest;address publisher;bool addOn;uint32 window;Status status;}
    PokerTournamentPolicyRegistry420 public immutable policies;
    BetAuthorization420 public immutable authorization;
    mapping(bytes32=>Record) private records;
    mapping(bytes32=>bytes32) public planForPolicy;
    error Invalid();error Unauthorized();
    event Published(bytes32 indexed id,bytes32 indexed basePolicy,bytes32 digest,bool addOn,uint32 window);
    constructor(address p){if(p.code.length==0)revert Invalid();policies=PokerTournamentPolicyRegistry420(p);authorization=policies.authorization();}
    function scope(bytes32 id)public view returns(bytes32){return keccak256(abi.encode(DOMAIN,block.chainid,address(this),id));}
    function _cap(bytes32 id,bytes32 action)private view{if(!authorization.isAuthorized(msg.sender,action,scope(id),0))revert Unauthorized();}
    function register(bytes32 id,bytes32 basePolicy,bool addOn,uint32 window)external{
        _cap(id,REGISTER);PokerTournamentPolicyRegistry420.Record memory p=policies.get(basePolicy);
        if(id==0||records[id].status!=Status.NONE||planForPolicy[basePolicy]!=0||msg.sender!=p.publisher||block.timestamp>=p.config.registrationOpens)revert Invalid();
        if(addOn){if(p.config.purchaseKind==PokerTournamentPolicy420.PurchaseKind.FREEZEOUT||window==0||window>3600||window>p.config.recoveryGrace)revert Invalid();}
        else if(window!=0)revert Invalid();
        if(uint256(p.config.startingStack)*p.config.maxPlayers*(uint256(p.config.extraCap)+1+(addOn?1:0))>type(uint128).max)revert Invalid();
        bytes32 h=keccak256(abi.encode(DOMAIN,block.chainid,address(this),id,basePolicy,p.digest,addOn,window,uint8(1),p.config.buyIn,PokerTournamentPolicy420.fee(p.config.buyIn),p.config.startingStack));
        records[id]=Record(basePolicy,h,msg.sender,addOn,window,Status.REGISTERED);planForPolicy[basePolicy]=id;
    }
    function approve(bytes32 id)external{_cap(id,APPROVE);if(records[id].status!=Status.REGISTERED)revert Invalid();records[id].status=Status.APPROVED;}
    function publish(bytes32 id)external{
        _cap(id,PUBLISH);Record storage r=records[id];PokerTournamentPolicyRegistry420.Record memory p=policies.get(r.basePolicy);
        if(r.status!=Status.APPROVED||msg.sender!=r.publisher||p.status!=PokerTournamentPolicyRegistry420.Status.PUBLISHED||!policies.operators().isActive(p.config.operatorId)||block.timestamp>=p.config.registrationOpens)revert Invalid();
        r.status=Status.PUBLISHED;emit Published(id,r.basePolicy,r.digest,r.addOn,r.window);
    }
    function get(bytes32 id)external view returns(Record memory){if(records[id].status==Status.NONE)revert Invalid();return records[id];}
    function defaultWindow()external pure returns(uint32){return 300;}
    function acceptsFunds()external pure returns(bool){return false;}
}
