// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./RightsAuthorization420.sol";
import "./RightsAssetRegistry420.sol";
import "./RightsPolicyRegistry420.sol";
import "./RightsIds420.sol";

contract RightsClaimRegistry420 is I420System {
    struct Claim {
        bytes32 subjectId;
        bytes32 rightClass;
        address holder;
        bytes32 jurisdictionHash;
        bytes32 evidenceHash;
        uint64 validFrom;
        uint64 validUntil;
        bool active;
        bool exists;
    }

    RightsAuthorization420 public immutable authorization;
    RightsAssetRegistry420 public immutable assets;
    RightsPolicyRegistry420 public immutable policy;
    mapping(bytes32 => Claim) private _claims;

    error InvalidClaim();
    error Unauthorized();
    error ClaimExists();
    error ClaimNotFound();
    error InactiveRightClass();

    event ClaimDeclared(bytes32 indexed rightId, bytes32 indexed subjectId, address indexed holder, bytes32 rightClass, bytes32 jurisdictionHash, bytes32 evidenceHash, uint64 validFrom, uint64 validUntil);

    constructor(address authorization_, address assets_, address policy_) {
        require(authorization_ != address(0) && assets_ != address(0) && policy_ != address(0), "dependency");
        authorization = RightsAuthorization420(authorization_);
        assets = RightsAssetRegistry420(assets_);
        policy = RightsPolicyRegistry420(policy_);
    }

    function systemName() external pure returns (string memory) { return "RightsClaimRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function declareClaim(bytes32 rightId, bytes32 subjectId, bytes32 rightClass, address holder, bytes32 jurisdictionHash, bytes32 evidenceHash, uint64 validFrom, uint64 validUntil) external {
        if (rightId == bytes32(0) || subjectId == bytes32(0) || rightClass == bytes32(0) || holder == address(0)) revert InvalidClaim();
        if (_claims[rightId].exists) revert ClaimExists();
        if (!assets.exists(subjectId)) revert InvalidClaim();
        if (!policy.isActiveRightClass(rightClass)) revert InactiveRightClass();
        if (validUntil != 0 && validUntil <= validFrom) revert InvalidClaim();
        if (msg.sender != holder && !authorization.isRightAuthorized(msg.sender, rightId, RightsIds420.ACTION_DECLARE_CLAIM)) revert Unauthorized();
        _claims[rightId] = Claim(subjectId, rightClass, holder, jurisdictionHash, evidenceHash, validFrom, validUntil, true, true);
        emit ClaimDeclared(rightId, subjectId, holder, rightClass, jurisdictionHash, evidenceHash, validFrom, validUntil);
    }

    function claim(bytes32 rightId) external view returns (Claim memory c) {
        c = _claims[rightId];
        if (!c.exists) revert ClaimNotFound();
    }

    function isEffective(bytes32 rightId) public view returns (bool) {
        Claim memory c = _claims[rightId];
        if (!c.exists || !c.active || block.timestamp < c.validFrom) return false;
        return c.validUntil == 0 || block.timestamp <= c.validUntil;
    }
}
