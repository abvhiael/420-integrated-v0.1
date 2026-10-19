// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerConfidentialDeal420.sol";
import "./PokerVerifierVersions420.sol";

/// @notice The proof verifier MUST prove that the committed public ciphertext
/// list encrypts the canonical 52-card deck exactly once under the specified
/// jointly controlled threshold key, including hashing that list to deckRoot.
interface IPokerInitialDeckProof420 {
    function verifyInitialDeck(bytes32 statement,bytes32 handId,bytes32 deckRoot,
        bytes32 keyCommitment,bytes calldata proof) external view returns(bool);
}

/// @notice Permissionless, proof-gated publication of the original encrypted deck.
/// @dev No party may substitute an arbitrary dealer seed-commitment for this root.
contract PokerInitialEncryptedDeck420 {
    bytes32 public constant DOMAIN=keccak256("420.BET.POKER.CANONICAL.INITIAL.ELGAMAL.V1");
    PokerConfidentialDeal420 public immutable deals;
    PokerVerifierVersions420 public immutable versions;
    IPokerInitialDeckProof420 public immutable verifier;
    bytes32 public immutable verifierVersion;
    bytes32 public immutable circuitHash;
    bytes32 public immutable verifyingKeyHash;
    bytes32 public immutable publicSchemaHash;
    bytes32 public immutable thresholdKeyCommitment;

    mapping(bytes32=>bytes32) public rootOf;
    mapping(bytes32=>bytes32) public proofHashOf;
    error InvalidConfiguration();error InvalidHand();error InvalidProof();error Duplicate();
    event InitialDeckVerified(bytes32 indexed handId,bytes32 indexed root,bytes32 proofHash);
    constructor(address deals_,address versions_,address verifier_,bytes32 version_,
        bytes32 circuit_,bytes32 keyHash_,bytes32 schema_,bytes32 thresholdKey_) {
        if(deals_==address(0)||versions_==address(0)||verifier_==address(0)||
           verifier_.code.length==0||version_==bytes32(0)||circuit_==bytes32(0)||
           keyHash_==bytes32(0)||schema_==bytes32(0)||thresholdKey_==bytes32(0))
           revert InvalidConfiguration();
        deals=PokerConfidentialDeal420(deals_);
        versions=PokerVerifierVersions420(versions_);
        verifier=IPokerInitialDeckProof420(verifier_);
        verifierVersion=version_;circuitHash=circuit_;verifyingKeyHash=keyHash_;
        publicSchemaHash=schema_;thresholdKeyCommitment=thresholdKey_;
        if(!versions.matches(version_,verifier_,keyHash_,circuit_,schema_))
            revert InvalidConfiguration();
    }
    function statement(bytes32 handId,bytes32 encryptedDeckRoot) public view returns(bytes32) {
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        if(h.state!=PokerConfidentialDeal420.State.COMMITTED || encryptedDeckRoot==bytes32(0))
            revert InvalidHand();
        return keccak256(abi.encode(DOMAIN,block.chainid,address(this),
            address(verifier),verifierVersion,circuitHash,verifyingKeyHash,
            publicSchemaHash,thresholdKeyCommitment,
            handId,h.tableId,h.configHash,h.rulesetId,h.versionId,
            h.seatSnapshotHash,h.epoch,h.nonce,h.transcriptCommitment,
            encryptedDeckRoot));
    }
    /// @dev Contract acceptance is conditioned on a real, qualified proof
    /// adapter verifying the exact encrypted deck and output commitment root.
    function submit(bytes32 handId,bytes32 encryptedDeckRoot,bytes calldata proof) external {
        if(rootOf[handId]!=bytes32(0))revert Duplicate();
        if(proof.length==0||encryptedDeckRoot==bytes32(0))revert InvalidProof();
        bytes32 digest=statement(handId,encryptedDeckRoot);
        if(!verifier.verifyInitialDeck(digest,handId,encryptedDeckRoot,thresholdKeyCommitment,proof))revert InvalidProof();
        rootOf[handId]=encryptedDeckRoot;
        proofHashOf[handId]=keccak256(proof);
        emit InitialDeckVerified(handId,encryptedDeckRoot,keccak256(proof));
    }
}
