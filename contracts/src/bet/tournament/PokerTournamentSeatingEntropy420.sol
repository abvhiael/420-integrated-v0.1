// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerTournamentEntryEscrow420.sol";
import "../../interfaces/IRandomnessRouter420.sol";
import "../../interfaces/IRandomnessVerifier420.sol";
import "../../randomness/RandomnessIds420.sol";

/// @notice Genuine two-provider commit/reveal for seating; not a VRF or proof of operational independence.
/// @dev One honest fresh-secret provider is assumed. Withholding may abort, never select a fallback seed.
contract PokerTournamentSeatingEntropy420 is IRandomnessVerifier420 {
    bytes32 public constant DOMAIN=keccak256("420.BET.POKER.SEATING.ENTROPY.V1");
    bytes32 public constant METHOD=RandomnessIds420.METHOD_COMMIT_REVEAL;
    bytes32 public constant PROVIDE=keccak256("BET_POKER_TOURNAMENT_SEATING_ENTROPY.V1");
    PokerTournamentEntryEscrow420 public immutable escrow;
    IRandomnessRouter420 public immutable router;
    address[2] public providers;
    bytes32[2] public subjects;
    bytes32[2] public credentials;
    bytes32[2] public providerKeys;
    struct Round {
        bytes32 eventId;bytes32 requestId;bytes32 rosterRoot;uint64 readyAt;
        bytes32[2] commitments;uint64[2] committedAt;bytes32[2] secrets;bool[2] revealed;
    }
    struct Link {address requester;bytes32 purpose;}
    mapping(address=>mapping(bytes32=>Round)) private rounds;
    mapping(bytes32=>Link) private links;
    error Invalid();error Unauthorized();
    bool private entered;
    modifier guarded(){if(entered)revert Invalid();entered=true;_;entered=false;}
    event Prepared(address indexed requester,bytes32 indexed purpose,bytes32 eventId);
    event Committed(address indexed requester,bytes32 indexed purpose,uint8 provider,bytes32 commitment);
    event RequestAttached(address indexed requester,bytes32 indexed purpose,bytes32 requestId,bytes32 rosterRoot,uint64 readyAt);
    event Revealed(address indexed requester,bytes32 indexed purpose,uint8 provider,bytes32 secret);
    constructor(address escrow_,address router_,address[2] memory actors,bytes32[2] memory subjectIds,bytes32[2] memory credentialIds) {
        if(escrow_.code.length==0||router_.code.length==0||actors[0]==address(0)||actors[1]==address(0)||actors[0]==actors[1])revert Invalid();
        escrow=PokerTournamentEntryEscrow420(escrow_);router=IRandomnessRouter420(router_);providers=actors;subjects=subjectIds;credentials=credentialIds;
        providerKeys[0]=escrow.personKey(subjectIds[0],credentialIds[0],actors[0]);providerKeys[1]=escrow.personKey(subjectIds[1],credentialIds[1],actors[1]);
        if(providerKeys[0]==providerKeys[1])revert Invalid();
    }
    function scope(address requester,bytes32 purpose) public view returns(bytes32){return keccak256(abi.encode(DOMAIN,block.chainid,address(this),requester,purpose));}
    function commitment(address requester,bytes32 purpose,uint8 provider,bytes32 secret) public view returns(bytes32){
        if(provider>1)revert Invalid();return keccak256(abi.encode(DOMAIN,block.chainid,address(this),requester,purpose,providers[provider],secret));
    }
    function requestPurpose(bytes32 base,bytes32 rosterRoot) public pure returns(bytes32){return keccak256(abi.encode(DOMAIN,base,rosterRoot));}
    function roundOf(address requester,bytes32 purpose) external view returns(Round memory){return rounds[requester][purpose];}
    function prepare(bytes32 purpose,bytes32 eventId) external guarded {
        PokerTournamentEntryEscrow420.EventAccount memory e=escrow.eventOf(eventId);
        if(purpose==0||eventId==0||rounds[msg.sender][purpose].eventId!=0||e.state!=PokerTournamentEntryEscrow420.State.REGISTRATION||e.receipts!=0||
            block.timestamp>=escrow.configOf(eventId).registrationOpens||e.funder==providers[0]||e.funder==providers[1])revert Invalid();
        rounds[msg.sender][purpose].eventId=eventId;emit Prepared(msg.sender,purpose,eventId);
    }
    function _index() private view returns(uint8){if(msg.sender==providers[0])return 0;if(msg.sender==providers[1])return 1;revert Unauthorized();}
    function _valid(uint8 index) private view returns(bool){
        try escrow.personKey(subjects[index],credentials[index],providers[index]) returns(bytes32 key){return key==providerKeys[index];}catch{return false;}
    }
    function _authority(address requester,bytes32 purpose,uint8 index) private view {
        if(!_allowed(requester,purpose,index))revert Unauthorized();
    }
    function _allowed(address requester,bytes32 purpose,uint8 index) private view returns(bool){
        return _valid(index)&&escrow.authorization().isAuthorized(providers[index],PROVIDE,scope(requester,purpose),0);
    }
    function commit(address requester,bytes32 purpose,bytes32 value) external guarded {
        uint8 index=_index();_authority(requester,purpose,index);Round storage r=rounds[requester][purpose];
        if(r.eventId==0||r.requestId!=0||value==0||r.commitments[index]!=0)revert Invalid();
        escrow.tick(r.eventId);PokerTournamentEntryEscrow420.State state=escrow.eventOf(r.eventId).state;
        if(state!=PokerTournamentEntryEscrow420.State.REGISTRATION&&state!=PokerTournamentEntryEscrow420.State.DELAYED)revert Invalid();
        r.commitments[index]=value;r.committedAt[index]=uint64(block.timestamp);emit Committed(requester,purpose,index,value);
    }
    function attachRequest(bytes32 purpose,bytes32 requestId,bytes32 rosterRoot) external guarded {
        Round storage r=rounds[msg.sender][purpose];IRandomnessRouter420.Request memory q=router.request(requestId);
        PokerTournamentEntryEscrow420.EventAccount memory e=escrow.eventOf(r.eventId);
        if(r.eventId==0||r.requestId!=0||links[requestId].requester!=address(0)||rosterRoot==0||e.state!=PokerTournamentEntryEscrow420.State.STARTING||
            e.readyAt==0||q.requester!=msg.sender||q.purpose!=requestPurpose(purpose,rosterRoot)||q.domain!=RandomnessIds420.DOMAIN_BET||
            q.primaryVerifier!=address(this)||q.primaryOperator!=msg.sender||q.primaryMethod!=METHOD||q.fallbackPolicy!=RandomnessIds420.FALLBACK_VOID||
            q.status!=IRandomnessRouter420.Status.REQUESTED||q.requestedAt<e.readyAt||
            r.committedAt[0]==0||r.committedAt[1]==0||r.committedAt[0]>=e.readyAt||r.committedAt[1]>=e.readyAt)revert Invalid();
        r.requestId=requestId;r.rosterRoot=rosterRoot;r.readyAt=e.readyAt;links[requestId]=Link(msg.sender,purpose);
        emit RequestAttached(msg.sender,purpose,requestId,rosterRoot,e.readyAt);
    }
    function reveal(address requester,bytes32 purpose,bytes32 secret) external guarded {
        uint8 index=_index();_authority(requester,purpose,index);Round storage r=rounds[requester][purpose];
        if(r.requestId==0||r.revealed[index]||secret==0||commitment(requester,purpose,index,secret)!=r.commitments[index])revert Invalid();
        IRandomnessRouter420.Request memory q=router.request(r.requestId);
        if(q.status!=IRandomnessRouter420.Status.REQUESTED||block.timestamp>q.deadline)revert Invalid();
        r.secrets[index]=secret;r.revealed[index]=true;emit Revealed(requester,purpose,index,secret);
    }
    function proofFor(address requester,bytes32 purpose) external view returns(bytes32 word,bytes memory proof){
        Round storage r=rounds[requester][purpose];if(!r.revealed[0]||!r.revealed[1])revert Invalid();
        proof=abi.encode(r.secrets[0],r.secrets[1]);word=keccak256(abi.encode(DOMAIN,purpose,r.rosterRoot,r.secrets[0],r.secrets[1]));
    }
    function verifyRandomness(bytes32 requestId,bytes32 domain,bytes32 purpose,bytes32 word,bytes calldata proof) external view returns(bool){
        if(proof.length!=64||domain!=RandomnessIds420.DOMAIN_BET)return false;
        Link memory link=links[requestId];if(link.requester==address(0))return false;Round storage r=rounds[link.requester][link.purpose];
        IRandomnessRouter420.Request memory q=router.request(requestId);PokerTournamentEntryEscrow420.EventAccount memory e=escrow.eventOf(r.eventId);
        if(q.requester!=link.requester||q.purpose!=purpose||purpose!=requestPurpose(link.purpose,r.rosterRoot)||q.domain!=domain||q.primaryVerifier!=address(this)||
            q.primaryOperator!=link.requester||q.primaryMethod!=METHOD||q.fallbackPolicy!=RandomnessIds420.FALLBACK_VOID||
            q.status!=IRandomnessRouter420.Status.REQUESTED||block.timestamp>q.deadline||e.state!=PokerTournamentEntryEscrow420.State.STARTING||
            block.timestamp>=uint256(r.readyAt)+escrow.configOf(r.eventId).technicalGrace||!r.revealed[0]||!r.revealed[1]||!_allowed(link.requester,link.purpose,0)||!_allowed(link.requester,link.purpose,1))return false;
        (bytes32 a,bytes32 b)=abi.decode(proof,(bytes32,bytes32));
        return a==r.secrets[0]&&b==r.secrets[1]&&r.committedAt[0]<r.readyAt&&r.committedAt[1]<r.readyAt&&
            commitment(link.requester,link.purpose,0,a)==r.commitments[0]&&commitment(link.requester,link.purpose,1,b)==r.commitments[1]&&
            word==keccak256(abi.encode(DOMAIN,link.purpose,r.rosterRoot,a,b));
    }
}
