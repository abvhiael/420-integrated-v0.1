// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerHandAccountingProof420.sol";
import "./PokerHandFinality420.sol";

/// @notice Read-only convergence gate, not a poker rules prover or settlement authorization.
/// @dev Two-adjudicator finality MUST attest precisely the accounting transcript root.
///      This cannot prove the controller recorded truthful actions, eligibility, pot fairness
///      or encrypted-card validity, and cannot move collateral.
contract PokerVerifiedTerminalGate420 {
    PokerHandAccountingProof420 public immutable accounting;
    PokerHandFinality420 public immutable finality;
    error InvalidDependency();
    constructor(address accounting_,address finality_) {
        if(accounting_==address(0)||finality_==address(0)) revert InvalidDependency();
        accounting=PokerHandAccountingProof420(accounting_);
        finality=PokerHandFinality420(finality_);
        if(address(accounting.deals())!=address(finality.deals())) revert InvalidDependency();
    }
    function isVerifiedTerminal(bytes32 handId) external view returns(bool) {
        PokerHandAccountingProof420.State memory s=accounting.stateOf(handId);
        (bytes32 stateHash,bytes32 transcriptHash,,,,,,bool finalized)=finality.terminals(handId);
        return finalized && s.initialized && s.terminal && s.potChips==0 &&
            s.stackChips+s.rakeChips==s.initialChips &&
            stateHash==s.transcriptRoot && transcriptHash==s.transcriptRoot;
    }
}
