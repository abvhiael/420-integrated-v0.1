// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerTournamentAssignments420.sol";
interface IEntropyTournamentHost420 {function escrow()external view returns(address);}

/// @notice Genuine two-provider commit/reveal for each synchronized round's table consolidation.
/// @dev Same independence/withholding assumptions as initial seating; no VRF or provider-independence claim.
contract PokerTournamentRoundEntropy420 is IRandomnessVerifier420 {
    bytes32 public constant DOMAIN=keccak256("420.BET.POKER.TOURNAMENT.ROUND.ENTROPY.V1");
    bytes32 public constant PROVIDE=keccak256("BET_POKER_TOURNAMENT_ROUND_ENTROPY.V1");
    bytes32 public constant METHOD=RandomnessIds420.METHOD_COMMIT_REVEAL;
    address public immutable host;
    PokerTournamentSeatingEntropy420 public immutable providers;
    SeatingRouter420 public immutable router;
    struct Round {uint64 preparedAt;uint64 freezeAt;bytes32 requestId;bytes32 root;bytes32[2] commitments;uint64[2] committedAt;bytes32[2] secrets;bool[2] revealed;}
    mapping(bytes32=>Round)private rounds;mapping(bytes32=>bytes32)private purposes;
    bool private entered;error Invalid();error Unauthorized();error Reentrancy();
    event Prepared(bytes32 indexed purpose,uint64 deadline);
    event Committed(bytes32 indexed purpose,uint8 provider,bytes32 commitment);
    event Requested(bytes32 indexed purpose,bytes32 requestId,bytes32 root);
    event Revealed(bytes32 indexed purpose,uint8 provider,bytes32 secret);
    constructor(address host_,address providers_,address router_){
        if(host_.code.length==0||providers_.code.length==0||router_.code.length==0)revert Invalid();host=host_;providers=PokerTournamentSeatingEntropy420(providers_);router=SeatingRouter420(router_);
        if(IEntropyTournamentHost420(host_).escrow()!=address(providers.escrow())||address(providers.router())!=router_)revert Invalid();
    }
    modifier guarded(){if(entered)revert Reentrancy();entered=true;_;entered=false;}
    modifier onlyHost(){if(msg.sender!=host)revert Unauthorized();_;}
    function scope(bytes32 purpose)public view returns(bytes32){return keccak256(abi.encode(DOMAIN,block.chainid,address(this),host,purpose));}
    function _allowed(uint8 index,bytes32 purpose)private view returns(bool){
        try providers.escrow().personKey(providers.subjects(index),providers.credentials(index),providers.providers(index))returns(bytes32 key){
            return key==providers.providerKeys(index)&&providers.escrow().authorization().isAuthorized(providers.providers(index),PROVIDE,scope(purpose),0);
        }catch{return false;}
    }
    function _index()private view returns(uint8){if(msg.sender==providers.providers(0))return 0;if(msg.sender==providers.providers(1))return 1;revert Unauthorized();}
    function commitment(bytes32 purpose,uint8 index,bytes32 secret)public view returns(bytes32){if(index>1)revert Invalid();return keccak256(abi.encode(DOMAIN,block.chainid,address(this),host,purpose,providers.providers(index),secret));}
    function prepare(bytes32 purpose)external onlyHost guarded {if(purpose==0||rounds[purpose].preparedAt!=0)revert Invalid();rounds[purpose].preparedAt=uint64(block.timestamp);emit Prepared(purpose,uint64(block.timestamp+3600));}
    function commit(bytes32 purpose,bytes32 value)external guarded {
        uint8 index=_index();if(!_allowed(index,purpose))revert Unauthorized();Round storage r=rounds[purpose];
        if(r.preparedAt==0||r.freezeAt!=0||r.commitments[index]!=0||value==0||block.timestamp>=uint256(r.preparedAt)+3600)revert Invalid();
        r.commitments[index]=value;r.committedAt[index]=uint64(block.timestamp);emit Committed(purpose,index,value);
    }
    function freeze(bytes32 purpose)external onlyHost guarded {
        Round storage r=rounds[purpose];if(r.preparedAt==0||r.freezeAt!=0||r.commitments[0]==0||r.commitments[1]==0||block.timestamp<=r.committedAt[0]||block.timestamp<=r.committedAt[1]||block.timestamp>=uint256(r.preparedAt)+3600||!_allowed(0,purpose)||!_allowed(1,purpose))revert Invalid();
        r.freezeAt=uint64(block.timestamp);
    }
    function configuration(bytes32 profile)public view returns(bytes32){RandomnessProfileRegistry420.Profile memory p=router.profileRegistry().profile(profile);RandomnessRouteRegistry420.Route memory route=router.routeRegistry().route(p.primaryRoute);return keccak256(abi.encode(p,route));}
    function request(bytes32 purpose,bytes32 root,bytes32 profile,uint32 timeout_)external onlyHost guarded returns(bytes32 requestId){
        Round storage r=rounds[purpose];RandomnessProfileRegistry420.Profile memory p=router.profileRegistry().profile(profile);RandomnessRouteRegistry420.Route memory route=router.routeRegistry().route(p.primaryRoute);
        if(r.freezeAt==0||r.requestId!=0||root==0||timeout_<30||timeout_>3600||timeout_>p.maxTimeoutSeconds||!p.active||p.revision==0||p.fallbackPolicy!=RandomnessIds420.FALLBACK_VOID||p.fallbackRoute!=0||!route.active||route.operator!=address(this)||route.verifier!=address(this)||route.methodId!=METHOD)revert Invalid();
        r.root=root;requestId=router.requestRandomness(profile,RandomnessIds420.DOMAIN_BET,keccak256(abi.encode(DOMAIN,block.chainid,host,purpose,root,r.freezeAt)),uint64(block.timestamp+timeout_));r.requestId=requestId;purposes[requestId]=purpose;emit Requested(purpose,requestId,root);
    }
    function reveal(bytes32 purpose,bytes32 secret)external guarded {
        uint8 index=_index();if(!_allowed(index,purpose))revert Unauthorized();Round storage r=rounds[purpose];
        if(r.requestId==0||r.revealed[index]||secret==0||commitment(purpose,index,secret)!=r.commitments[index])revert Invalid();
        IRandomnessRouter420.Request memory q=router.request(r.requestId);if(q.status!=IRandomnessRouter420.Status.REQUESTED||block.timestamp>q.deadline)revert Invalid();r.secrets[index]=secret;r.revealed[index]=true;emit Revealed(purpose,index,secret);
    }
    function resolve(bytes32 purpose)external guarded {
        Round storage r=rounds[purpose];if(!r.revealed[0]||!r.revealed[1])revert Invalid();
        router.fulfillRandomness(r.requestId,keccak256(abi.encode(DOMAIN,purpose,r.root,r.secrets[0],r.secrets[1])),abi.encode(r.secrets[0],r.secrets[1]));
    }
    function verifyRandomness(bytes32 requestId,bytes32 domain,bytes32 purpose,bytes32 word,bytes calldata proof)external view returns(bool){
        bytes32 base=purposes[requestId];Round storage r=rounds[base];if(base==0||proof.length!=64||domain!=RandomnessIds420.DOMAIN_BET||!r.revealed[0]||!r.revealed[1]||!_allowed(0,base)||!_allowed(1,base))return false;
        IRandomnessRouter420.Request memory q=router.request(requestId);
        if(q.requester!=address(this)||q.primaryOperator!=address(this)||q.primaryVerifier!=address(this)||q.primaryMethod!=METHOD||q.fallbackPolicy!=RandomnessIds420.FALLBACK_VOID||q.status!=IRandomnessRouter420.Status.REQUESTED||block.timestamp>q.deadline||purpose!=keccak256(abi.encode(DOMAIN,block.chainid,host,base,r.root,r.freezeAt)))return false;
        (bytes32 a,bytes32 b)=abi.decode(proof,(bytes32,bytes32));
        return a==r.secrets[0]&&b==r.secrets[1]&&r.committedAt[0]<r.freezeAt&&r.committedAt[1]<r.freezeAt&&commitment(base,0,a)==r.commitments[0]&&commitment(base,1,b)==r.commitments[1]&&word==keccak256(abi.encode(DOMAIN,base,r.root,a,b));
    }
    function result(bytes32 requestId)external view returns(bytes32 root){if(purposes[requestId]==0||router.status(requestId)!=IRandomnessRouter420.Status.FULFILLED)revert Invalid();(root,)=router.result(requestId);if(root==0)revert Invalid();}
    function expired(bytes32 requestId)external view returns(bool){if(purposes[requestId]==0)return false;IRandomnessRouter420.Request memory q=router.request(requestId);return q.status==IRandomnessRouter420.Status.VOIDED||(q.status==IRandomnessRouter420.Status.REQUESTED&&block.timestamp>q.deadline);}
    function preparationExpired(bytes32 purpose)external view returns(bool){Round storage r=rounds[purpose];return r.preparedAt!=0&&r.freezeAt==0&&block.timestamp>=uint256(r.preparedAt)+3600;}
    function roundOf(bytes32 purpose)external view returns(Round memory){return rounds[purpose];}
}
