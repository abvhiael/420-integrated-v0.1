// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetPokerConfidentialDeal54.t.sol";
import "../src/bet/PokerPrivateShuffleGate420.sol";

/// @dev TEST DOUBLE ONLY. Does not validate a cryptographic proof. Never deploy.
contract ShuffleVerifierFixture54 is IPokerShuffleProofVerifier420 {
    bytes32 public expected;
    function allow(bytes32 digest) external {expected=digest;}
    function verifyShuffleProof(bytes32 digest,bytes32,bytes32,bytes32,bytes32,bytes calldata proof) external view returns(bool){
        return digest==expected && keccak256(proof)==keccak256(hex"010203");
    }
}
/// @dev TEST DOUBLE ONLY. Must never be a production initial-deck verifier.
contract InitialDeckProofFixture54 is IPokerInitialDeckProof420 {
    bytes32 public expected;
    function allow(bytes32 digest) external {expected=digest;}
    function verifyInitialDeck(bytes32 digest,bytes32,bytes32,bytes32,bytes calldata proof) external view returns(bool){
        return digest==expected && keccak256(proof)==keccak256(hex"f00d");
    }
}
/// @dev ABI plumbing fixture; real MiMC root/publication qualification uses the generated cryptographic suite.
contract ShuffleAvailabilityFixture54 {
    bool public enabled=true;
    function setEnabled(bool value) external {enabled=value;}
    function isAvailable(uint256,bytes32) external view returns(bool){return enabled;}
}
contract PokerPrivateShuffleGate54Test is PokerConfidentialDeal54Test {
    ShuffleVerifierFixture54 verifier;
    InitialDeckProofFixture54 initialVerifier;
    PokerVerifierVersions420 initialVersions;
    PokerInitialEncryptedDeck420 initialDeck;
    PokerPrivateShuffleGate420 gate;
    PokerShuffleProviderIndependence420 independence;
    ShuffleAvailabilityFixture54 availability;
    constructor() {
        verifier=new ShuffleVerifierFixture54();
        initialVerifier=new InitialDeckProofFixture54();
        initialVersions=new PokerVerifierVersions420(address(this));
        initialVersions.register(keccak256("TEST INITIAL VERSION"),address(initialVerifier),
            keccak256("TEST INITIAL KEY"),keccak256("TEST INITIAL CIRCUIT"),
            keccak256("TEST INITIAL SCHEMA"));
        initialDeck=new PokerInitialEncryptedDeck420(address(deal),address(initialVersions),
            address(initialVerifier),keccak256("TEST INITIAL VERSION"),
            keccak256("TEST INITIAL CIRCUIT"),keccak256("TEST INITIAL KEY"),
            keccak256("TEST INITIAL SCHEMA"),keccak256(abi.encode(uint256(19),uint256(20))));
        independence=new PokerShuffleProviderIndependence420(address(this),address(0xC0FFEE));
        independence.attest(PROVIDER_A,keccak256("provider A independently attested controller"),keccak256("provider A independently verified dossier"),uint64(block.timestamp+30 days));
        independence.attest(PROVIDER_B,keccak256("provider B independently attested controller"),keccak256("provider B independently verified dossier"),uint64(block.timestamp+30 days));
        availability=new ShuffleAvailabilityFixture54();
        cheat54.prank(address(0xC0FFEE));
        independence.review(PROVIDER_A,keccak256("provider A independently attested controller"),keccak256("provider A independently reviewed dossier"),uint64(block.timestamp+30 days));
        cheat54.prank(address(0xC0FFEE));
        independence.review(PROVIDER_B,keccak256("provider B independently attested controller"),keccak256("provider B independently reviewed dossier"),uint64(block.timestamp+30 days));
        gate=new PokerPrivateShuffleGate420(address(deal),address(initialDeck),address(verifier),address(independence),address(availability),
            keccak256("ZK CIRCUIT MUST BE AUDITED BEFORE DEPLOY"),keccak256(abi.encode(uint256(19),uint256(20))));
    }
    function _hand54() internal returns(bytes32 id){
        _prepared();id=_begin(1);
        cheat54.prank(PROVIDER_A);deal.commit(id,keccak256("a"));
        cheat54.prank(PROVIDER_B);deal.commit(id,keccak256("b"));
        bytes32 initialRoot=keccak256("canonical 52-card encrypted deck fixture");
        initialVerifier.allow(initialDeck.statement(id,initialRoot));
        initialDeck.submit(id,initialRoot,hex"f00d");
    }
    function testUnattestedCommonControlOrRevocationBlocksBothStages() public {
        bytes32 id=_hand54();
        bytes32 root=initialDeck.rootOf(id);
        bytes32 output=keccak256("output");
        verifier.allow(gate.statement(id,1,root,output));
        independence.attest(PROVIDER_B,keccak256("provider A independently attested controller"),
            keccak256("conflicting controller evidence"),uint64(block.timestamp+30 days));
        cheat54.expectRevert(PokerPrivateShuffleGate420.Unauthorized.selector);
        cheat54.prank(PROVIDER_A);gate.proveStage(id,1,root,output,hex"010203");
        independence.attest(PROVIDER_B,keccak256("provider B independently attested controller"),
            keccak256("new independent evidence"),uint64(block.timestamp+30 days));
        independence.revoke(PROVIDER_B);
        cheat54.expectRevert(PokerPrivateShuffleGate420.Unauthorized.selector);
        cheat54.prank(PROVIDER_A);gate.proveStage(id,1,root,output,hex"010203");
    }
    function testExpiredAttestationBlocksStage() public {
        bytes32 id=_hand54();
        bytes32 root=initialDeck.rootOf(id);
        bytes32 output=keccak256("output");
        verifier.allow(gate.statement(id,1,root,output));
        independence.attest(PROVIDER_A,keccak256("provider A independently attested controller"),
            keccak256("expiring verification dossier"),uint64(block.timestamp+1));
        cheat54.warp(block.timestamp+2);
        cheat54.expectRevert(PokerPrivateShuffleGate420.Unauthorized.selector);
        cheat54.prank(PROVIDER_A);gate.proveStage(id,1,root,output,hex"010203");
    }
    function testMissingPublicCiphertextDataBlocksBothStages() public {
        bytes32 id=_hand54();
        bytes32 root=initialDeck.rootOf(id);
        bytes32 output=keccak256("output");
        verifier.allow(gate.statement(id,1,root,output));
        availability.setEnabled(false);
        cheat54.expectRevert(PokerPrivateShuffleGate420.InvalidProof.selector);
        cheat54.prank(PROVIDER_A);gate.proveStage(id,1,root,output,hex"010203");
    }
    function testIndependentReviewerRevocationBlocksBothStages() public {
        bytes32 id=_hand54();
        bytes32 root=initialDeck.rootOf(id);
        bytes32 output=keccak256("output");
        verifier.allow(gate.statement(id,1,root,output));
        cheat54.prank(address(0xC0FFEE));
        independence.revokeIndependentReview(PROVIDER_B);
        cheat54.expectRevert(PokerPrivateShuffleGate420.Unauthorized.selector);
        cheat54.prank(PROVIDER_A);gate.proveStage(id,1,root,output,hex"010203");
    }
    function testProofGateStagesAndTranscriptBinding() public {
        bytes32 id=_hand54();
        bytes32 certifiedRoot=initialDeck.rootOf(id);
        PokerConfidentialDeal420.Hand memory h=deal.getHand(id);
        bytes32 outA=keccak256("re-encrypted A"); bytes32 outB=keccak256("re-encrypted B");
        verifier.allow(gate.statement(id,1,certifiedRoot,outA));
        cheat54.prank(PROVIDER_A);gate.proveStage(id,1,certifiedRoot,outA,hex"010203");
        require(!gate.isProofComplete(id),"premature");
        verifier.allow(gate.statement(id,2,outA,outB));
        cheat54.prank(PROVIDER_B);gate.proveStage(id,2,outA,outB,hex"010203");
        require(gate.isProofComplete(id),"two independently scoped stages");
    }
    function testCannotSkipStageOrSwapProvider() public {
        bytes32 id=_hand54();
        bytes32 certifiedRoot=initialDeck.rootOf(id);
        PokerConfidentialDeal420.Hand memory h=deal.getHand(id);
        bytes32 output=keccak256("output");
        cheat54.expectRevert(PokerPrivateShuffleGate420.WrongStage.selector);
        cheat54.prank(PROVIDER_B);gate.proveStage(id,2,certifiedRoot,output,hex"010203");
        cheat54.expectRevert(PokerPrivateShuffleGate420.Unauthorized.selector);
        cheat54.prank(PROVIDER_B);gate.proveStage(id,1,certifiedRoot,output,hex"010203");
    }
    function testInvalidProofAndWrongRootRejected() public {
        bytes32 id=_hand54();
        bytes32 certifiedRoot=initialDeck.rootOf(id);
        PokerConfidentialDeal420.Hand memory h=deal.getHand(id);
        bytes32 output=keccak256("output");
        cheat54.expectRevert(PokerPrivateShuffleGate420.InvalidProof.selector);
        cheat54.prank(PROVIDER_A);gate.proveStage(id,1,keccak256("fork"),output,hex"010203");
        cheat54.expectRevert(PokerPrivateShuffleGate420.InvalidProof.selector);
        cheat54.prank(PROVIDER_A);gate.proveStage(id,1,certifiedRoot,output,hex"010203");
    }
    function testRevokedProviderCannotSubmitEvenAValidProof() public {
        bytes32 id=_hand54();
        bytes32 certifiedRoot=initialDeck.rootOf(id);
        PokerConfidentialDeal420.Hand memory h=deal.getHand(id);
        bytes32 output=keccak256("output");
        verifier.allow(gate.statement(id,1,certifiedRoot,output));
        cap.grant(PROVIDER_A,deal.ACTION_PROVIDER_COMMIT(),auth.scopeForTable(TABLE),false);
        cheat54.expectRevert(PokerPrivateShuffleGate420.Unauthorized.selector);
        cheat54.prank(PROVIDER_A);gate.proveStage(id,1,certifiedRoot,output,hex"010203");
    }
}
