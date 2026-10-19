// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetPokerConfidentialDeal54.t.sol";
import "../src/bet/PokerPrivateShuffleGate420.sol";

/// @dev TEST DOUBLE ONLY. Does not validate a cryptographic proof. Never deploy.
contract ShuffleVerifierFixture54 is IPokerShuffleProofVerifier420 {
    bytes32 public expected;
    function allow(bytes32 digest) external {expected=digest;}
    function verifyShuffleProof(bytes32 digest,bytes calldata proof) external view returns(bool){
        return digest==expected && keccak256(proof)==keccak256(hex"010203");
    }
}
contract PokerPrivateShuffleGate54Test is PokerConfidentialDeal54Test {
    ShuffleVerifierFixture54 verifier;
    PokerPrivateShuffleGate420 gate;
    constructor() {
        verifier=new ShuffleVerifierFixture54();
        gate=new PokerPrivateShuffleGate420(address(deal),address(verifier),
            keccak256("ZK CIRCUIT MUST BE AUDITED BEFORE DEPLOY"),keccak256("THRESHOLD KEY MUST BE CERTIFIED"));
    }
    function _hand54() internal returns(bytes32 id){
        _prepared();id=_begin(1);
        cheat54.prank(PROVIDER_A);deal.commit(id,keccak256("a"));
        cheat54.prank(PROVIDER_B);deal.commit(id,keccak256("b"));
    }
    function testProofGateStagesAndTranscriptBinding() public {
        bytes32 id=_hand54();
        PokerConfidentialDeal420.Hand memory h=deal.getHand(id);
        bytes32 outA=keccak256("re-encrypted A"); bytes32 outB=keccak256("re-encrypted B");
        verifier.allow(gate.statement(id,1,h.transcriptCommitment,outA));
        cheat54.prank(PROVIDER_A);gate.proveStage(id,1,h.transcriptCommitment,outA,hex"010203");
        require(!gate.isProofComplete(id),"premature");
        verifier.allow(gate.statement(id,2,outA,outB));
        cheat54.prank(PROVIDER_B);gate.proveStage(id,2,outA,outB,hex"010203");
        require(gate.isProofComplete(id),"two independently scoped stages");
    }
    function testCannotSkipStageOrSwapProvider() public {
        bytes32 id=_hand54();
        PokerConfidentialDeal420.Hand memory h=deal.getHand(id);
        bytes32 output=keccak256("output");
        cheat54.expectRevert(PokerPrivateShuffleGate420.WrongStage.selector);
        cheat54.prank(PROVIDER_B);gate.proveStage(id,2,h.transcriptCommitment,output,hex"010203");
        cheat54.expectRevert(PokerPrivateShuffleGate420.Unauthorized.selector);
        cheat54.prank(PROVIDER_B);gate.proveStage(id,1,h.transcriptCommitment,output,hex"010203");
    }
    function testInvalidProofAndWrongRootRejected() public {
        bytes32 id=_hand54();
        PokerConfidentialDeal420.Hand memory h=deal.getHand(id);
        bytes32 output=keccak256("output");
        cheat54.expectRevert(PokerPrivateShuffleGate420.InvalidProof.selector);
        cheat54.prank(PROVIDER_A);gate.proveStage(id,1,keccak256("fork"),output,hex"010203");
        cheat54.expectRevert(PokerPrivateShuffleGate420.InvalidProof.selector);
        cheat54.prank(PROVIDER_A);gate.proveStage(id,1,h.transcriptCommitment,output,hex"010203");
    }
    function testRevokedProviderCannotSubmitEvenAValidProof() public {
        bytes32 id=_hand54();
        PokerConfidentialDeal420.Hand memory h=deal.getHand(id);
        bytes32 output=keccak256("output");
        verifier.allow(gate.statement(id,1,h.transcriptCommitment,output));
        cap.grant(PROVIDER_A,deal.ACTION_PROVIDER_COMMIT(),auth.scopeForTable(TABLE),false);
        cheat54.expectRevert(PokerPrivateShuffleGate420.Unauthorized.selector);
        cheat54.prank(PROVIDER_A);gate.proveStage(id,1,h.transcriptCommitment,output,hex"010203");
    }
}
