// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerDeckDisclosure420.sol";
import "./PokerPrivateShuffleGate420.sol";
import "./PokerGnarkEncryptedShareDeliveryAdapter420.sol";
import "./PokerGnarkThresholdKeyAggregateAdapter420.sol";

interface IPokerPreparedDealAssignment420 {
    function deals() external view returns(PokerConfidentialDeal420);
    function shuffle() external view returns(PokerPrivateShuffleGate420);
    function holeSeatForPosition(bytes32 handId,uint8 position) external view returns(uint8);
    function isHandInitialized(bytes32 handId) external view returns(bool);
}

/// @notice An all-or-nothing proof book for encrypted private hole-card delivery.
/// Each participant gets exactly two positions, and BOTH providers must prove
/// correct encryption of their threshold share at EACH position.
/// @dev No sender, controller, or receipt can mark a proof as verified.
/// This contract only consumes boolean results from immutable deployed adapters
/// which themselves are pinned to exact Groth16 Solidity verifying keys.
contract PokerDeliveryProofBook420 is IPokerDeliveryProofBook420 {
    bytes32 public constant DELIVERY_CONTEXT_DOMAIN=
        keccak256("420.BET.POKER.PRIVATE.SHARE.DELIVERY.CONTEXT.V1");
    bytes32 public constant ENVELOPE_DOMAIN=
        keccak256("420.BET.POKER.PRIVATE.SHARE.ENVELOPE.V1");
    bytes32 public constant AGGREGATE_CONTEXT_DOMAIN=
        keccak256("420.BET.POKER.PRIVATE.SHARE.AGGREGATE.V1");
    uint256 private constant FR=
        21888242871839275222246405745257275088696311157297823662689037894645226208583;
    PokerConfidentialDeal420 public immutable deals;
    PokerDeckDisclosure420 public immutable disclosure;
    PokerRecipientKeys420 public immutable keys;
    PokerPrivateShuffleGate420 public immutable shuffle;
    IPokerPreparedDealAssignment420 public immutable assignment;
    IPokerEncryptedShareDelivery420 public immutable providerA;
    IPokerEncryptedShareDelivery420 public immutable providerB;
    IPokerThresholdKeyAggregate420 public immutable aggregateVerifier;
    bool public aggregateVerified;
    event ProviderAggregateVerified(bytes32 indexed aggregateKeyHash);
    mapping(bytes32=>uint32[2]) private proofBits;
    // Each proof exposes only an encrypted decryption share, never its plaintext.
    mapping(bytes32=>mapping(uint8=>mapping(uint8=>uint256[4]))) private encryptedShares;
    mapping(bytes32=>mapping(uint8=>bytes32)) public proofRecipientFingerprint;

    error InvalidConfiguration();error InvalidState();error InvalidProof();error Duplicate();
    event RecipientShareProofVerified(bytes32 indexed handId,uint8 indexed position,
        uint8 indexed provider,uint8 seat,bytes32 encryptedShareHash);

    constructor(address deals_,address disclosure_,address shuffle_,
        address assignment_,address providerA_,address providerB_,address aggregate_) {
        if(deals_==address(0)||disclosure_==address(0)||shuffle_==address(0)||
            assignment_==address(0)||providerA_==address(0)||providerB_==address(0)||
            providerA_==providerB_||providerA_.code.length==0||
            providerB_.code.length==0||assignment_.code.length==0||
            aggregate_==address(0)||aggregate_.code.length==0)
            revert InvalidConfiguration();
        deals=PokerConfidentialDeal420(deals_);
        disclosure=PokerDeckDisclosure420(disclosure_);
        keys=disclosure.keys();
        shuffle=PokerPrivateShuffleGate420(shuffle_);
        assignment=IPokerPreparedDealAssignment420(assignment_);
        providerA=IPokerEncryptedShareDelivery420(providerA_);
        providerB=IPokerEncryptedShareDelivery420(providerB_);
        aggregateVerifier=IPokerThresholdKeyAggregate420(aggregate_);
        // Only registry-pinned adapters with distinct provider keys are
        // admissible; an arbitrary always-true interface is not a delivery
        // proof. Tests may use a separately marked generated-verifier stub,
        // but production VK/circuit approval is a distinct release gate.
        PokerGnarkEncryptedShareDeliveryAdapter420 a=
            PokerGnarkEncryptedShareDeliveryAdapter420(providerA_);
        PokerGnarkEncryptedShareDeliveryAdapter420 b=
            PokerGnarkEncryptedShareDeliveryAdapter420(providerB_);
        if(a.thresholdKeyCommitment()==bytes32(0)||
           b.thresholdKeyCommitment()==bytes32(0)||
           a.thresholdKeyCommitment()==b.thresholdKeyCommitment()||
           !a.versions().matches(a.versionId(),a.groth16Verifier(),
               a.verifyingKeyHash(),a.circuitHash(),a.schemaHash())||
           !b.versions().matches(b.versionId(),b.groth16Verifier(),
               b.verifyingKeyHash(),b.circuitHash(),b.schemaHash()))
               revert InvalidConfiguration();
        PokerGnarkThresholdKeyAggregateAdapter420 aggregateAdapter=
            PokerGnarkThresholdKeyAggregateAdapter420(aggregate_);
        if(aggregateAdapter.thresholdKeyCommitment()!=shuffle.thresholdKeyCommitment()||
           !aggregateAdapter.versions().matches(aggregateAdapter.versionId(),
               aggregateAdapter.groth16Verifier(),aggregateAdapter.verifyingKeyHash(),
               aggregateAdapter.circuitHash(),aggregateAdapter.schemaHash()))
               revert InvalidConfiguration();
        if(address(disclosure.deals())!=deals_||
            address(shuffle.deals())!=deals_||
            address(assignment.deals())!=deals_||
            address(assignment.shuffle())!=shuffle_||
            address(keys.ledger())!=address(deals.ledger()))revert InvalidConfiguration();
    }

    /// @notice One genuine proof enforces that the two distinct decryption
    /// providers' keys add to exactly the shuffle's aggregate key.
    function aggregateScope(uint256[6] calldata points)public view returns(uint256){
        return uint256(keccak256(abi.encode(AGGREGATE_CONTEXT_DOMAIN,block.chainid,
            address(this),address(shuffle),address(providerA),address(providerB),points)))%FR;
    }
    function proveAggregateKey(uint256[6] calldata points,bytes calldata proof)external{
        if(aggregateVerified||proof.length==0)revert InvalidState();
        PokerGnarkEncryptedShareDeliveryAdapter420 a=
            PokerGnarkEncryptedShareDeliveryAdapter420(address(providerA));
        PokerGnarkEncryptedShareDeliveryAdapter420 b=
            PokerGnarkEncryptedShareDeliveryAdapter420(address(providerB));
        if(keccak256(abi.encode(points[0],points[1]))!=a.thresholdKeyCommitment()||
           keccak256(abi.encode(points[2],points[3]))!=b.thresholdKeyCommitment()||
           keccak256(abi.encode(points[4],points[5]))!=shuffle.thresholdKeyCommitment())
            revert InvalidProof();
        uint256 scope=aggregateScope(points);
        if(scope==0||!aggregateVerifier.verifyAggregate(scope,points,proof))
            revert InvalidProof();
        aggregateVerified=true;
        emit ProviderAggregateVerified(shuffle.thresholdKeyCommitment());
    }
    function encryptedShareOf(bytes32 handId,uint8 position,uint8 provider)
        external view returns(uint256[4] memory) {
        if(provider>1||position>=52)revert InvalidState();
        return encryptedShares[handId][position][provider];
    }
    function proofMaskOf(bytes32 handId,uint8 provider)external view returns(uint32){
        if(provider>1)revert InvalidState();
        return proofBits[handId][provider];
    }
    function _count(uint16 mask)private pure returns(uint8 n){
        for(uint8 i=0;i<9;i++)if((mask&(uint16(1)<<i))!=0)n++;
    }
    function _root(bytes32 handId)private view returns(bytes32){
        PokerPrivateShuffleGate420.Record memory record=shuffle.recordOf(handId);
        if(record.stage!=2||record.finalDeckRoot==bytes32(0))revert InvalidState();
        return record.finalDeckRoot;
    }
    function context(bytes32 handId,uint8 position,uint8 seat,uint8 provider,
        bytes32 root,bytes32 fingerprint,uint64 epoch,uint256[12] calldata points)
        public view returns(uint256) {
        return uint256(keccak256(abi.encode(DELIVERY_CONTEXT_DOMAIN,
            block.chainid,address(this),handId,position,seat,provider,
            root,fingerprint,epoch,points)))%FR;
    }

    function proveEncryptedShare(bytes32 handId,uint8 position,uint8 provider,
        uint256[12] calldata points,bytes calldata proof)external {
        if(!aggregateVerified)revert InvalidState();
        if(position>=52||provider>1||proof.length==0)revert InvalidProof();
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        if(h.state!=PokerConfidentialDeal420.State.COMMITTED||
            assignment.isHandInitialized(handId)||
            deals.ledger().activeHand(h.tableId)!=handId||
            deals.ledger().seatingEpoch(h.tableId)!=h.epoch||
            deals.snapshotFor(h.tableId,deals.handSeatMask(handId))!=h.seatSnapshotHash)
            revert InvalidState();
        uint8 n=_count(deals.handSeatMask(handId));
        if(n<2||position>=2*n)revert InvalidProof();
        uint8 seat=assignment.holeSeatForPosition(handId,position);
        uint32 bit=uint32(1)<<position;
        if((proofBits[handId][provider]&bit)!=0)revert Duplicate();
        (uint256 qx,uint256 qy,bytes32 fingerprint)=keys.encryptionKeyOf(h.tableId,seat);
        if(proofRecipientFingerprint[handId][position]!=bytes32(0)&&
           proofRecipientFingerprint[handId][position]!=fingerprint)revert InvalidProof();
        if(points[6]!=qx||points[7]!=qy)revert InvalidProof();
        bytes32 root=_root(handId);
        uint256 bound=context(handId,position,seat,provider,root,fingerprint,h.epoch,points);
        if(bound==0||!(provider==0?providerA:providerB).verifyDelivery(
            handId,root,position,seat,provider,bound,points,proof))revert InvalidProof();
        proofBits[handId][provider]|=bit;
        proofRecipientFingerprint[handId][position]=fingerprint;
        encryptedShares[handId][position][provider]=
            [points[8],points[9],points[10],points[11]];
        emit RecipientShareProofVerified(handId,position,provider,seat,
            keccak256(abi.encode(points[8],points[9],points[10],points[11])));
    }

    /// @notice Exactly four proven ciphertexts (two positions x two providers)
    /// make one canonical seat envelope, ordered by physical deck position.
    function envelopeHashFor(bytes32 handId,uint8 seat)public view returns(bytes32 digest){
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        uint16 mask=deals.handSeatMask(handId);
        if(seat>=9||(mask&(uint16(1)<<seat))==0)revert InvalidState();
        uint8 n=_count(mask);
        uint32 required=(uint32(1)<<(2*n))-1;
        if((proofBits[handId][0]&required)!=required||
           (proofBits[handId][1]&required)!=required)revert InvalidState();
        (uint256 x,uint256 y,bytes32 fingerprint)=keys.encryptionKeyOf(h.tableId,seat);
        // The two returned public coordinates are security-relevant, not
        // ignorable metadata: only registered, canonical nonidentity keys
        // may bind the encrypted shares for this seat.
        if(x==0||x>=FR||y>=FR)revert InvalidState();
        digest=keccak256(abi.encode(ENVELOPE_DOMAIN,block.chainid,address(this),
            handId,seat,fingerprint,h.epoch,_root(handId)));
        uint8 assigned=0;
        for(uint8 j=0;j<2*n;j++){
            if(assignment.holeSeatForPosition(handId,j)==seat){
                if(proofRecipientFingerprint[handId][j]!=fingerprint)
                    revert InvalidState();
                digest=keccak256(abi.encode(digest,j,
                    encryptedShares[handId][j][0],encryptedShares[handId][j][1]));
                assigned++;
            }
        }
        if(assigned!=2)revert InvalidState();
    }
    function allVerified(bytes32 handId)external view returns(bool){
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        if(h.state!=PokerConfidentialDeal420.State.COMMITTED||
           deals.ledger().activeHand(h.tableId)!=handId||
           deals.ledger().seatingEpoch(h.tableId)!=h.epoch)return false;
        uint16 mask=deals.handSeatMask(handId);
        uint8 n=_count(mask);
        if(n<2||n>9||assignment.isHandInitialized(handId))return false;
        uint32 required=(uint32(1)<<(2*n))-1;
        if((proofBits[handId][0]&required)!=required||
           (proofBits[handId][1]&required)!=required)return false;
        for(uint8 seat=0;seat<9;seat++)if((mask&(uint16(1)<<seat))!=0){
            bytes32 digest=envelopeHashFor(handId,seat);
            if(digest==bytes32(0)||
               disclosure.recipientEnvelopeHash(handId,seat)!=digest)return false;
        }
        return true;
    }
}
