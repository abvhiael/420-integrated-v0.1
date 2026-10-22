// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerNLHEBetting420.sol";
import "./PokerGnarkCardRevealAdapters420.sol";

/// @notice Chain-authorized, selectively proven 2-of-2 public card revelation.
/// @dev Public shares are forbidden for hidden hole cards until SHOWDOWN.
///      The correct private delivery of hole cards during betting requires a
///      separate recipient-only encryption proof before gameplay activation.
contract PokerLiveCardReveals420 is IPokerAuthenticatedStreet420 {
    PokerNLHEBetting420 public immutable engine;
    PokerPrivateShuffleGate420 public immutable shuffle;
    IPokerPartialShareProof420 public immutable shareVerifierA;
    IPokerPartialShareProof420 public immutable shareVerifierB;
    IPokerCardUnmaskProof420 public immutable unmaskVerifier;
    bytes32 public immutable providerKeyHashA;
    bytes32 public immutable providerKeyHashB;
    bytes32 public immutable aggregateKeyHash;
    struct Slot {
        uint256 c1x; uint256 c1y; uint256 c2x; uint256 c2y;
        uint256 dax; uint256 day; uint256 dbx; uint256 dby;
        bool shareA;bool shareB;bool opened;uint8 card;
    }
    mapping(bytes32=>mapping(uint8=>Slot)) private slots;
    mapping(bytes32=>uint256) private cardBitmap;
    error InvalidConfig();error WrongStreet();error InvalidProof();error Duplicate();error Incomplete();
    event ShareVerified(bytes32 indexed handId,uint8 indexed position,uint8 holder);
    event CanonicalCardRevealed(bytes32 indexed handId,uint8 indexed position,uint8 indexed street,uint8 card);

    constructor(address engine_,address verifierA_,address verifierB_,address unmask_) {
        if(engine_==address(0)||verifierA_==address(0)||verifierB_==address(0)||
            unmask_==address(0)||verifierA_.code.length==0||
            verifierB_.code.length==0||unmask_.code.length==0)revert InvalidConfig();
        engine=PokerNLHEBetting420(engine_);
        shuffle=engine.shuffle();
        shareVerifierA=IPokerPartialShareProof420(verifierA_);
        shareVerifierB=IPokerPartialShareProof420(verifierB_);
        unmaskVerifier=IPokerCardUnmaskProof420(unmask_);
        providerKeyHashA=PokerGnarkPartialShareAdapter420(verifierA_).thresholdKeyCommitment();
        providerKeyHashB=PokerGnarkPartialShareAdapter420(verifierB_).thresholdKeyCommitment();
        aggregateKeyHash=PokerGnarkCardUnmaskAdapter420(unmask_).thresholdKeyCommitment();
        if(aggregateKeyHash!=shuffle.thresholdKeyCommitment()||
           providerKeyHashA==providerKeyHashB||
           providerKeyHashA==bytes32(0)||providerKeyHashB==bytes32(0))revert InvalidConfig();
    }
    function slotOf(bytes32 handId,uint8 pos)external view returns(Slot memory){return slots[handId][pos];}
    function _playerCount(uint16 mask)private pure returns(uint8 n){
        for(uint8 i=0;i<9;i++)if((mask&(uint16(1)<<i))!=0)n++;
    }
    function _dealSeat(bytes32 handId,uint8 position)private view returns(uint8){
        PokerNLHEBetting420.Game memory g=engine.gameOf(handId);
        uint8 n=_playerCount(g.seatsMask);
        uint8 index=position%n;
        uint8 first;
        if(n==2)first=g.button;
        else {
            first=uint8((uint256(g.button)+1)%9);
            while((g.seatsMask&(uint16(1)<<first))==0)first=uint8((uint256(first)+1)%9);
        }
        uint8 seat=first;
        for(uint8 i=0;i<index;i++){
            seat=uint8((uint256(seat)+1)%9);
            while((g.seatsMask&(uint16(1)<<seat))==0)seat=uint8((uint256(seat)+1)%9);
        }
        return seat;
    }
    function _authorized(bytes32 handId,uint8 street,uint8 pos)private view returns(bool){
        if(!engine.canRevealStreet(handId,street)||pos>=52)return false;
        PokerNLHEBetting420.Game memory g=engine.gameOf(handId);
        uint8 n=_playerCount(g.seatsMask);if(n<2)return false;
        uint8 hole=2*n;
        if(street==1)return pos>=hole+1&&pos<=hole+3;
        if(street==2)return pos==hole+5;
        if(street==3)return pos==hole+7;
        if(street==4 && pos<hole){
            return !engine.playerOf(handId,_dealSeat(handId,pos)).folded;
        }
        return false;
    }
    function _deckRoot(bytes32 handId)private view returns(bytes32 root){
        PokerPrivateShuffleGate420.Record memory d=shuffle.recordOf(handId);
        if(d.stage!=2||d.finalDeckRoot==bytes32(0))revert InvalidProof();
        return d.finalDeckRoot;
    }

    /// @notice Anyone may post a cryptographically verified partial share;
    /// the holder cannot make a different card appear by choosing share bytes.
    function submitShare(bytes32 handId,uint8 street,uint8 position,uint8 holder,
        uint256[8] calldata points,bytes calldata proof)external {
        if(!_authorized(handId,street,position)||holder>1)revert WrongStreet();
        Slot storage s=slots[handId][position];
        if(s.opened||(holder==0?s.shareA:s.shareB))revert Duplicate();
        if(s.shareA||s.shareB){
            if(points[0]!=s.c1x||points[1]!=s.c1y||
               points[2]!=s.c2x||points[3]!=s.c2y)revert InvalidProof();
        }
        bytes32 root=_deckRoot(handId);
        bool verified=holder==0?
            shareVerifierA.verifyPartial(handId,root,position,street,holder,points,proof):
            shareVerifierB.verifyPartial(handId,root,position,street,holder,points,proof);
        if(!verified)revert InvalidProof();
        if(!s.shareA&&!s.shareB){
            s.c1x=points[0];s.c1y=points[1];
            s.c2x=points[2];s.c2y=points[3];
        }
        if(holder==0){s.dax=points[6];s.day=points[7];s.shareA=true;}
        else{s.dbx=points[6];s.dby=points[7];s.shareB=true;}
        emit ShareVerified(handId,position,holder);
    }

    function reveal(bytes32 handId,uint8 street,uint8 position,uint8 card,
        uint256[6] calldata publicKeys,bytes calldata proof)external {
        if(!_authorized(handId,street,position)||card>=52)revert WrongStreet();
        Slot storage s=slots[handId][position];
        if(s.opened)revert Duplicate();
        if(!s.shareA||!s.shareB)revert Incomplete();
        if((cardBitmap[handId]&(uint256(1)<<card))!=0)revert Duplicate();
        if(keccak256(abi.encode(publicKeys[0],publicKeys[1]))!=providerKeyHashA||
           keccak256(abi.encode(publicKeys[2],publicKeys[3]))!=providerKeyHashB||
           keccak256(abi.encode(publicKeys[4],publicKeys[5]))!=aggregateKeyHash)
            revert InvalidProof();
        uint256[12] memory allPoints=[
            s.c2x,s.c2y,s.dax,s.day,s.dbx,s.dby,
            publicKeys[0],publicKeys[1],publicKeys[2],publicKeys[3],
            publicKeys[4],publicKeys[5]];
        // ABI arrays are memory here; verifier interface uses calldata but
        // external call ABI encoding safely copies them.
        if(!unmaskVerifier.verifyCard(handId,_deckRoot(handId),position,street,
            card,allPoints,proof))revert InvalidProof();
        s.opened=true;s.card=card;
        cardBitmap[handId]|=uint256(1)<<card;
        emit CanonicalCardRevealed(handId,position,street,card);
    }
    function isStageComplete(bytes32 handId,uint8 street)external view returns(bool){
        PokerNLHEBetting420.Game memory g=engine.gameOf(handId);
        uint8 n=_playerCount(g.seatsMask);if(n<2)return false;
        uint8 hole=2*n;
        if(street==1){
            return slots[handId][hole+1].opened&&slots[handId][hole+2].opened&&
                slots[handId][hole+3].opened;
        }
        if(street==2)return slots[handId][hole+5].opened;
        if(street==3)return slots[handId][hole+7].opened;
        if(street==4){
            for(uint8 i=0;i<hole;i++){
                uint8 seat=_dealSeat(handId,i);
                if(!engine.playerOf(handId,seat).folded&&!slots[handId][i].opened)return false;
            }
            return true;
        }
        return false;
    }
    /// @notice Objective provider attribution from MISSING accepted partial
    /// shares at the canonical unrevealed street, not operator accusation.
    /// A completed pair with an invalid unmask proof does not blame either
    /// provider unless other cryptographic evidence proves their wrongdoing.
    function missingProviders(bytes32 handId,uint8 street)external view returns(uint8 fault){
        PokerNLHEBetting420.Game memory g=engine.gameOf(handId);
        uint8 n=_playerCount(g.seatsMask);
        if(n<2||n>9)return 0;
        uint8 hole=2*n;
        if(street==1){
            for(uint8 pos=hole+1;pos<=hole+3;pos++){
                if(!slots[handId][pos].shareA)fault|=1;
                if(!slots[handId][pos].shareB)fault|=2;
            }
        }else if(street==2 || street==3){
            uint8 pos=street==2?hole+5:hole+7;
            if(!slots[handId][pos].shareA)fault|=1;
            if(!slots[handId][pos].shareB)fault|=2;
        }else if(street==4){
            for(uint8 pos=0;pos<hole;pos++){
                if(engine.playerOf(handId,_dealSeat(handId,pos)).folded)continue;
                if(!slots[handId][pos].shareA)fault|=1;
                if(!slots[handId][pos].shareB)fault|=2;
            }
        }
    }
    function advance(bytes32 handId,uint8 street)external {
        if(street<1||street>3||!this.isStageComplete(handId,street))revert Incomplete();
        engine.advanceRevealedStreet(handId,street);
    }
}
