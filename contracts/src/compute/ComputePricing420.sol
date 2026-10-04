// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library ComputePricing420 {
    enum Model { NONE, FIXED_PRICE, WORK_UNIT, CPU_TIME, GPU_TIME, VERIFIED_RESULT }
    struct Terms {
        Model model;
        uint256 fixedPrice;
        uint256 unitRate;
        uint256 unitScale;
        uint256 minimumCharge;
        uint256 maximumCharge;
        uint256 maximumBillableUnits;
    }
    function fixedTerms(uint256 amount) internal pure returns (Terms memory t) {
        t = Terms(Model.FIXED_PRICE, amount, 0, 1, amount, amount, 0);
    }
    function isValid(Terms memory t) internal pure returns (bool) {
        if (t.model == Model.NONE) return false;
        if (t.model == Model.FIXED_PRICE) {
            return t.fixedPrice != 0 && t.unitRate == 0 && t.unitScale == 1
                && t.minimumCharge == t.fixedPrice && t.maximumCharge == t.fixedPrice
                && t.maximumBillableUnits == 0;
        }
        if (
            uint8(t.model) > uint8(Model.VERIFIED_RESULT) || t.fixedPrice != 0
                || t.unitRate == 0 || t.unitScale == 0 || t.maximumCharge == 0
                || t.maximumBillableUnits == 0 || t.minimumCharge > t.maximumCharge
        ) return false;
        return true;
    }
    function quoteMaximum(Terms memory t, uint256 billableUnits)
        internal pure returns (bool ok, uint256 amount)
    {
        if (!isValid(t)) return (false, 0);
        if (t.model == Model.FIXED_PRICE) {
            return billableUnits == 0 ? (true, t.fixedPrice) : (false, 0);
        }
        if (billableUnits == 0 || billableUnits > t.maximumBillableUnits) return (false, 0);
        if (t.unitRate > type(uint256).max / billableUnits) return (false, 0);
        uint256 numerator = t.unitRate * billableUnits;
        amount = numerator / t.unitScale;
        if (numerator % t.unitScale != 0) {
            if (amount == type(uint256).max) return (false, 0);
            amount += 1;
        }
        if (amount < t.minimumCharge) amount = t.minimumCharge;
        if (amount > t.maximumCharge) amount = t.maximumCharge;
        return amount != 0 ? (true, amount) : (false, 0);
    }
    function authorityAmount(Terms memory t) internal pure returns (uint256) { return t.maximumCharge; }
    function commitment(Terms memory t) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            t.model, t.fixedPrice, t.unitRate, t.unitScale,
            t.minimumCharge, t.maximumCharge, t.maximumBillableUnits
        ));
    }
}
