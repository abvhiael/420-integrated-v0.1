// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerTableRegistry420.sol";

/// @notice Stateless canonical NLHE cash-game rake-policy verification.
/// @dev Only policies whose hash matches a registered table configuration are valid.
///      Immutable table configuration, not operator-provided client JSON, is authority.
contract PokerCanonicalRake420 {
    bytes32 public constant POLICY_DOMAIN=keccak256("420.BET.POKER.RAKE.POLICY.V1");
    PokerTableRegistry420 public immutable tables;
    struct Policy {
        uint16 rakeBps;
        uint256 cap;
        bool noFlopNoDrop;
        bool noRakeOnUncontested;
    }
    error InvalidPolicy();
    constructor(address tables_){if(tables_==address(0))revert InvalidPolicy();tables=PokerTableRegistry420(tables_);}
    function policyHash(Policy calldata p) public pure returns(bytes32){
        return keccak256(abi.encode(POLICY_DOMAIN,p.rakeBps,p.cap,p.noFlopNoDrop,p.noRakeOnUncontested));
    }
    function verify(bytes32 tableId,Policy calldata p) public view returns(bool) {
        PokerTableRegistry420.Table memory t=tables.getTable(tableId);
        return p.rakeBps<=t.config.maxRakeBps && p.rakeBps<=10000 &&
            p.cap<=t.config.maxBuyIn*uint256(t.config.seats) &&
            policyHash(p)==t.config.rakePolicyHash;
    }
    function rake(bytes32 tableId,Policy calldata p,uint256 grossPot,
        bool flopSeen,bool uncontested) external view returns(uint256 value) {
        if(!verify(tableId,p))revert InvalidPolicy();
        if((!flopSeen&&p.noFlopNoDrop)||(uncontested&&p.noRakeOnUncontested))return 0;
        // Reduce arithmetic overflow by quotient-first calculation.
        uint256 quotient=grossPot/10000;
        uint256 remainder=grossPot%10000;
        value=quotient*p.rakeBps+(remainder*p.rakeBps)/10000;
        if(value>p.cap)value=p.cap;
    }
}
