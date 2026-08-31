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
        bytes32 supersededBy;
    }

    RightsAuthorization420 public immutable authorization;
    RightsAssetRegistry420 public immutable assets;
    RightsPolicyRegistry420 public immutable policy;
    mapping(bytes32 => Claim) private _claims;
    mapping(bytes32 => bytes32) public claimIdForFingerprint;

    error InvalidClaim();
    error Unauthorized();
    error ClaimExists();
    error ClaimReplay();
    error ClaimNotFound();
    error InactiveRightClass();
    error InvalidSupersession();

    event ClaimDeclared(bytes32 indexed rightId, bytes32 indexed subjectId, address indexed holder, bytes32 rightClass, bytes32 jurisdictionHash, bytes32 evidenceHash, uint64 validFrom, uint64 validUntil);
    event ClaimSuperseded(bytes32 indexed oldRightId, bytes32 indexed newRightId, address indexed actor);
    event RightHolderTransferred(bytes32 indexed rightId, address indexed previousHolder, address indexed newHolder, bytes32 successionEvidenceHash);

    constructor(address authorization_, address assets_, address policy_) {
        require(authorization_ != address(0) && assets_ != address(0) && policy_ != address(0), "dependency");
        authorization = RightsAuthorization420(authorization_);
        assets = RightsAssetRegistry420(assets_);
        policy = RightsPolicyRegistry420(policy_);
    }

    function systemName() external pure returns (string memory) { return "RightsClaimRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function claimFingerprint(bytes32 subjectId, bytes32 rightClass, address holder, bytes32 jurisdictionHash, bytes32 evidenceHash, uint64 validFrom, uint64 validUntil) public pure returns (bytes32) {
        return keccak256(abi.encode(subjectId, rightClass, holder, jurisdictionHash, evidenceHash, validFrom, validUntil));
    }

    function declareClaim(bytes32 rightId, bytes32 subjectId, bytes32 rightClass, address holder, bytes32 jurisdictionHash, bytes32 evidenceHash, uint64 validFrom, uint64 validUntil) external {
        if (rightId == bytes32(0) || subjectId == bytes32(0) || rightClass == bytes32(0) || holder == address(0)) revert InvalidClaim();
        if (jurisdictionHash == bytes32(0) || evidenceHash == bytes32(0)) revert InvalidClaim();
        if (_claims[rightId].exists) revert ClaimExists();
        if (!assets.exists(subjectId)) revert InvalidClaim();
        if (!policy.isActiveRightClass(rightClass)) revert InactiveRightClass();
        if (validUntil != 0 && validUntil <= validFrom) revert InvalidClaim();
        if (msg.sender != holder && !authorization.isRightAuthorized(msg.sender, rightId, RightsIds420.ACTION_DECLARE_CLAIM)) revert Unauthorized();

        bytes32 fingerprint = claimFingerprint(subjectId, rightClass, holder, jurisdictionHash, evidenceHash, validFrom, validUntil);
        if (claimIdForFingerprint[fingerprint] != bytes32(0)) revert ClaimReplay();
        claimIdForFingerprint[fingerprint] = rightId;
        _claims[rightId] = Claim(subjectId, rightClass, holder, jurisdictionHash, evidenceHash, validFrom, validUntil, true, true, bytes32(0));
        emit ClaimDeclared(rightId, subjectId, holder, rightClass, jurisdictionHash, evidenceHash, validFrom, validUntil);
    }

    function supersedeClaim(bytes32 oldRightId, bytes32 newRightId) external {
        Claim storage oldClaim = _claims[oldRightId];
        Claim memory newClaim = _claims[newRightId];
        if (!oldClaim.exists || !newClaim.exists || !oldClaim.active || oldRightId == newRightId) revert InvalidSupersession();
        if (oldClaim.subjectId != newClaim.subjectId || oldClaim.rightClass != newClaim.rightClass) revert InvalidSupersession();
        if (msg.sender != oldClaim.holder && !authorization.isRightAuthorized(msg.sender, oldRightId, RightsIds420.ACTION_SUPERSEDE_CLAIM)) revert Unauthorized();
        oldClaim.active = false;
        oldClaim.supersededBy = newRightId;
        emit ClaimSuperseded(oldRightId, newRightId, msg.sender);
    }

    function transferHolder(bytes32 rightId, address newHolder, bytes32 successionEvidenceHash) external {
        Claim storage c = _claims[rightId];
        if (!c.exists || !c.active || newHolder == address(0) || newHolder == c.holder || successionEvidenceHash == bytes32(0)) revert InvalidClaim();
        address previousHolder = c.holder;
        if (msg.sender != previousHolder && !authorization.isRightAuthorized(msg.sender, rightId, RightsIds420.ACTION_TRANSFER_RIGHT)) revert Unauthorized();
        c.holder = newHolder;
        c.evidenceHash = keccak256(abi.encode(c.evidenceHash, successionEvidenceHash, previousHolder, newHolder));
        emit RightHolderTransferred(rightId, previousHolder, newHolder, successionEvidenceHash);
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
