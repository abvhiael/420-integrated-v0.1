
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library AccountingCommitment420 {
    struct TaxSummary {
        uint256 subtotal;
        uint256 discounts;
        uint256 gst;
        uint256 hst;
        uint256 pst;
        uint256 otherTax;
        uint256 tip;
        uint256 total;
        bytes32 jurisdictionHash;
    }

    function hashTaxSummary(TaxSummary memory t) internal pure returns(bytes32) {
        return keccak256(abi.encode(
            t.subtotal,t.discounts,t.gst,t.hst,t.pst,t.otherTax,t.tip,t.total,t.jurisdictionHash
        ));
    }
}
