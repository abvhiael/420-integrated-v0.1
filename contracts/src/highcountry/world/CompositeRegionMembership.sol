// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IFoundingMembership {
    function exists(
        uint16 id
    ) external view returns (bool);
}

interface IExpansionMembership {
    function isOpen(
        uint16 id
    ) external view returns (bool);
}

/// @notice Deploy as the regionRegistry dependency of NEW land/profile registries.
/// @dev Existing deployed immutable consumer bindings require deliberate redeployment/rebinding.
contract CompositeRegionMembership {
    error InvalidRegistry();
    IFoundingMembership public immutable founding;
    IExpansionMembership public immutable expansion;

    constructor(
        address founding_,
        address expansion_
    ) {
        if (founding_.code.length == 0 || expansion_.code.length == 0 || founding_ == expansion_) revert InvalidRegistry();
        founding = IFoundingMembership(founding_);
        expansion = IExpansionMembership(expansion_);
    }

    function exists(
        uint16 id
    ) external view returns (bool) {
        if (id == 0) return false;
        return id <= 3 ? founding.exists(id) : expansion.isOpen(id);
    }
}
