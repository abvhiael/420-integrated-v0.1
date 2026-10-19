// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetPokerPrivateShuffleGate54.t.sol";
import "../src/bet/PokerCanonicalEvidence420.sol";

/// @dev Fixture only, NOT a production rules-proof verifier.
contract RulesProofFixture54 is IPokerTerminalRulesProof420 {
    bytes32 public validDigest;
    function setValid(bytes32 digest) external {validDigest=digest;}
    function verifyTerminal(bytes32 digest,bytes calldata proof) external view returns(bool) {
        return digest==validDigest && keccak256(proof)==keccak256(hex"abcd");
    }
}
contract PokerCanonicalEvidence54Test is PokerPrivateShuffleGate54Test {
    PokerCanonicalEvidence420 canonical;
    RulesProofFixture54 rules;
    constructor(){
        rules=new RulesProofFixture54();
        canonical=new PokerCanonicalEvidence420(address(deal),address(gate),address(rules),
            keccak256("TEST RULES CIRCUIT"),keccak256("TEST VERIFICATION KEY"));
    }
    function _shuffle() internal returns(bytes32 id) {
        id=_hand54();
        PokerConfidentialDeal420.Hand memory h=deal.getHand(id);
        bytes32 first=keccak256("stage A"),last=keccak256("stage B");
        verifier.allow(gate.statement(id,1,h.transcriptCommitment,first));
        cheat54.prank(PROVIDER_A);gate.proveStage(id,1,h.transcriptCommitment,first,hex"010203");
        verifier.allow(gate.statement(id,2,first,last));
        cheat54.prank(PROVIDER_B);gate.proveStage(id,2,first,last,hex"010203");
    }
    function _submit(bytes32 id,bytes32 rakeHash) internal {
        canonical.submit(id,keccak256("actions"),keccak256("reveals"),keccak256("payouts"),
            rakeHash,keccak256("terminal"),hex"abcd");
    }
    function testPermissionlessValidProofAndOneTimeAcceptance() public {
        bytes32 id=_shuffle();
        bytes32 rakeHash=registry.getTable(TABLE).config.rakePolicyHash;
        bytes32 digest=canonical.statement(id,keccak256("actions"),keccak256("reveals"),
            keccak256("payouts"),rakeHash,keccak256("terminal"));
        rules.setValid(digest);
        cheat54.prank(OTHER);_submit(id,rakeHash);
        require(canonical.acceptedOf(id).accepted,"evidence accepted");
        cheat54.expectRevert(PokerCanonicalEvidence420.Duplicate.selector);
        _submit(id,rakeHash);
    }
    function testCannotAcceptBeforeShuffleOrWithWrongRake() public {
        bytes32 id=_hand54();
        cheat54.expectRevert(PokerCanonicalEvidence420.MissingShuffle.selector);
        _submit(id,keccak256("wrong"));
        id=_shuffleAfterFreshHand();
        cheat54.expectRevert(PokerCanonicalEvidence420.InvalidHand.selector);
        _submit(id,keccak256("forged rake policy"));
    }
    function _shuffleAfterFreshHand() internal returns(bytes32) {
        // Prior _hand54 has consumed nonce 1, so use a separate fixture hand in
        // this test only by advancing the actual committed nonce.
        bytes32 snap=deal.snapshotFor(TABLE,3);
        cheat54.prank(ADMIN);
        bytes32 id=deal.begin(TABLE,2,uint64(block.timestamp+120),keccak256("next"),snap,3);
        cheat54.prank(PROVIDER_A);deal.commit(id,keccak256("different a"));
        cheat54.prank(PROVIDER_B);deal.commit(id,keccak256("different b"));
        PokerConfidentialDeal420.Hand memory h=deal.getHand(id);
        bytes32 first=keccak256("new first"); bytes32 second=keccak256("new second");
        verifier.allow(gate.statement(id,1,h.transcriptCommitment,first));
        cheat54.prank(PROVIDER_A);gate.proveStage(id,1,h.transcriptCommitment,first,hex"010203");
        verifier.allow(gate.statement(id,2,first,second));
        cheat54.prank(PROVIDER_B);gate.proveStage(id,2,first,second,hex"010203");
        return id;
    }
    function testInvalidRulesProofNeverAccepted() public {
        bytes32 id=_shuffle();
        bytes32 rakeHash=registry.getTable(TABLE).config.rakePolicyHash;
        cheat54.expectRevert(PokerCanonicalEvidence420.InvalidProof.selector);
        _submit(id,rakeHash);
        require(!canonical.acceptedOf(id).accepted,"must fail closed");
    }
}
