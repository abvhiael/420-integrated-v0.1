// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/CommunityValidatorReserve.sol";
import "../system/ValidatorRegistry.sol";
import "../governance/IFoundingWalletClaims420.sol";

interface IFoundingRetirement420 {
    function retired() external view returns (bool);
}

/// @notice Canonical 420Identity profile and independently issued economic-owner credential.
interface IVerifiedSponsorBeneficiary420 {
    function profiles(bytes32 profileId) external view returns (
        address controller, address pendingController, bytes32 metadataHash, bytes32 primaryName,
        uint64 createdAt, uint64 updatedAt, bool active
    );
    function credentials(bytes32 credentialId) external view returns (
        bytes32 issuerId, bytes32 subjectProfileId, bytes32 credentialType, bytes32 claimHash,
        uint64 issuedAt, uint64 expiresAt, uint64 revokedAt, bool subjectRejected
    );
    function credentialMeetsTrust(bytes32 credentialId, uint8 minTrust) external view returns (bool);
}

/// @notice Purpose-limited, verified full protocol-owned validator collateral.
/// No founder can custody the principal, select committee membership or mint reward funds.
contract FoundingValidatorSponsorship420 {
    uint256 public constant FULL_BOND = 42_000 ether;
    uint256 public constant MAX_FULL_SPONSORS = 150; // 6.3M reserve / 42K; matched credits share reserve
    uint8 public constant MIN_IDENTITY_TRUST = 2; // 420Identity.TrustClass.VERIFIED
    bytes32 public constant OWNER_CREDENTIAL_TYPE =
        keccak256("420/STAKE/FULL_SPONSOR_BENEFICIAL_OWNER/V1");
    address public constant IDENTITY_420 = 0x0000000000000000000000000000000000000436;

    address public immutable foundingAdministrator;
    IFoundingWalletClaims420 public immutable founderWalletClaims;
    IFoundingRetirement420 public immutable foundingRetirement;
    CommunityValidatorReserve public immutable communityReserve;
    ValidatorRegistry public immutable validatorRegistry;
    mapping(bytes32 => bool) public sponsoredValidatorId;
    mapping(address => bool) public sponsoredBeneficiary;
    mapping(bytes32 => bool) public sponsoredIdentityGroup;
    uint256 public sponsorCount;

    error UnauthorizedSponsor();
    error InvalidCandidate();
    error NotApprovedGenesis();
    error InvalidVerifiedBeneficiary();
    error ConcentrationLimit();

    event FullValidatorSponsorshipFunded(
        bytes32 indexed validatorId, address indexed beneficiary, uint256 amount, bytes32 indexed purposeHash
    );
    event SponsorshipIdentityVerified(
        bytes32 indexed validatorId, bytes32 indexed profileId,
        bytes32 indexed beneficialOwnerGroup, bytes32 credentialId
    );

    constructor(address administrator, address claims, address retirementAuthority, address reserve, address registry) {
        if (administrator == address(0) || claims.code.length == 0 || retirementAuthority.code.length == 0
            || reserve.code.length == 0 || registry.code.length == 0
            || administrator == reserve || administrator == registry) revert InvalidCandidate();
        IFoundingWalletClaims420 verifier = IFoundingWalletClaims420(claims);
        if (verifier.administrator() != administrator || verifier.andrew() == address(0)
            || verifier.janet() == address(0) || verifier.genesisPlanCommitment() == bytes32(0))
            revert InvalidCandidate();
        foundingAdministrator = administrator;
        founderWalletClaims = verifier;
        foundingRetirement = IFoundingRetirement420(retirementAuthority);
        communityReserve = CommunityValidatorReserve(payable(reserve));
        validatorRegistry = ValidatorRegistry(payable(registry));
    }

    function retired() external view returns (bool) {
        return foundingRetirement.retired();
    }

    /// @dev Old 3-argument funding selector is permanently fail-closed: no identity,
    /// issuer-attested owner group or proper purpose-specific authorization exists.
    function sponsorFully(bytes32, address, bytes32) external pure {
        revert InvalidVerifiedBeneficiary();
    }

    function purposeFor(
        bytes32 validatorId, address beneficiary, bytes32 profileId,
        bytes32 credentialId, bytes32 beneficialOwnerGroup
    ) public view returns (bytes32) {
        return keccak256(abi.encode(
            keccak256("420/FOUNDING/FULL_SPONSOR/PURPOSE/V1"),
            block.chainid, address(this), validatorId, beneficiary, profileId,
            credentialId, beneficialOwnerGroup, FULL_BOND
        ));
    }

    /// @notice Exact verified 42K credit only, one validator and ONE issuer-attested
    /// beneficial-owner group per founding allocation, regardless of EOA aliases.
    function sponsorFullyVerified(
        bytes32 validatorId, address beneficiary, bytes32 profileId,
        bytes32 credentialId, bytes32 purposeHash
    ) external {
        if (msg.sender != foundingAdministrator || !founderWalletClaims.claimed(msg.sender)
            || foundingRetirement.retired()) revert UnauthorizedSponsor();
        if (validatorId == bytes32(0) || beneficiary == address(0) || profileId == bytes32(0)
            || credentialId == bytes32(0) || purposeHash == bytes32(0)
            || sponsoredValidatorId[validatorId] || sponsoredBeneficiary[beneficiary]
            || validatorRegistry.ownerValidatorId(beneficiary) != bytes32(0)
            || validatorRegistry.getValidator(validatorId).owner != address(0)) revert InvalidCandidate();
        if (sponsorCount >= MAX_FULL_SPONSORS) revert ConcentrationLimit();
        if (IDENTITY_420.code.length == 0) revert InvalidVerifiedBeneficiary();

        IVerifiedSponsorBeneficiary420 id = IVerifiedSponsorBeneficiary420(IDENTITY_420);
        (address controller,,,,,,bool active) = id.profiles(profileId);
        if (controller != beneficiary || !active) revert InvalidVerifiedBeneficiary();
        (bytes32 issuerId, bytes32 subject, bytes32 credentialType, bytes32 group,
            uint64 issuedAt, uint64 expiresAt, uint64 revokedAt, bool subjectRejected
        ) = id.credentials(credentialId);
        if (issuerId == bytes32(0) || issuedAt == 0 || revokedAt != 0 || subjectRejected
            || (expiresAt != 0 && expiresAt <= block.timestamp)
            || subject != profileId || credentialType != OWNER_CREDENTIAL_TYPE
            || group == bytes32(0) || sponsoredIdentityGroup[group]
            || !id.credentialMeetsTrust(credentialId, MIN_IDENTITY_TRUST))
            revert InvalidVerifiedBeneficiary();
        if (purposeHash != purposeFor(validatorId, beneficiary, profileId, credentialId, group))
            revert InvalidCandidate();

        if (communityReserve.genesisFoundingSponsorAuthority() != address(this)
            || communityReserve.validatorRegistry() != address(validatorRegistry)
            || validatorRegistry.communityValidatorReserve() != address(communityReserve)
            || communityReserve.MAX_CREDIT_PER_VALIDATOR() != FULL_BOND
            || validatorRegistry.MAX_PROTOCOL_CREDIT() != FULL_BOND) revert NotApprovedGenesis();

        sponsoredValidatorId[validatorId] = true;
        sponsoredBeneficiary[beneficiary] = true;
        sponsoredIdentityGroup[group] = true;
        ++sponsorCount;
        communityReserve.assignCredit(validatorId, beneficiary, FULL_BOND);
        communityReserve.fundCredit(validatorId);
        if (validatorRegistry.pendingProtocolCredit(validatorId) != FULL_BOND) revert NotApprovedGenesis();

        emit SponsorshipIdentityVerified(validatorId, profileId, group, credentialId);
        emit FullValidatorSponsorshipFunded(validatorId, beneficiary, FULL_BOND, purposeHash);
    }
}
