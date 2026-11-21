// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/CommunityValidatorReserve.sol";
import "../system/ValidatorRegistry.sol";

interface IFoundingRetirement420 {
    function retired() external view returns (bool);
}

/// @notice Purpose-limited Genesis founder authority for full protocol-owned validator credit.
/// @dev The controller NEVER holds native $420, changes consensus eligibility, collects rewards,
/// or withdraws validator collateral. The reserve may only recognize this contract via
/// its independently approved Genesis predeploy storage slot, never a post-Genesis setter.
contract FoundingValidatorSponsorship420 {
    uint256 public constant FULL_BOND = 42_000 ether;
    address public immutable foundingAdministrator;
    IFoundingRetirement420 public immutable foundingRetirement;
    CommunityValidatorReserve public immutable communityReserve;
    ValidatorRegistry public immutable validatorRegistry;
    mapping(bytes32 => bool) public sponsoredValidatorId;
    mapping(address => bool) public sponsoredBeneficiary;

    error UnauthorizedSponsor();
    error InvalidCandidate();
    error NotApprovedGenesis();

    event FullValidatorSponsorshipFunded(
        bytes32 indexed validatorId, address indexed beneficiary, uint256 amount, bytes32 indexed purposeHash
    );

    constructor(address administrator, address retirementAuthority, address reserve, address registry) {
        if (administrator == address(0) || retirementAuthority.code.length == 0
            || reserve.code.length == 0 || registry.code.length == 0
            || administrator == reserve || administrator == registry) revert InvalidCandidate();
        foundingAdministrator = administrator;
        foundingRetirement = IFoundingRetirement420(retirementAuthority);
        communityReserve = CommunityValidatorReserve(payable(reserve));
        validatorRegistry = ValidatorRegistry(payable(registry));
    }

    function retired() external view returns (bool) {
        return foundingRetirement.retired();
    }

    function sponsorFully(bytes32 validatorId, address beneficiary, bytes32 purposeHash) external {
        if (msg.sender != foundingAdministrator || foundingRetirement.retired()) revert UnauthorizedSponsor();
        if (validatorId == bytes32(0) || beneficiary == address(0) || purposeHash == bytes32(0)
            || sponsoredValidatorId[validatorId] || sponsoredBeneficiary[beneficiary]
            || validatorRegistry.ownerValidatorId(beneficiary) != bytes32(0)
            || validatorRegistry.getValidator(validatorId).owner != address(0)) revert InvalidCandidate();
        if (communityReserve.genesisFoundingSponsorAuthority() != address(this)
            || communityReserve.validatorRegistry() != address(validatorRegistry)
            || validatorRegistry.communityValidatorReserve() != address(communityReserve)
            || communityReserve.MAX_CREDIT_PER_VALIDATOR() != FULL_BOND
            || validatorRegistry.MAX_PROTOCOL_CREDIT() != FULL_BOND) revert NotApprovedGenesis();

        sponsoredValidatorId[validatorId] = true;
        sponsoredBeneficiary[beneficiary] = true;
        communityReserve.assignCredit(validatorId, beneficiary, FULL_BOND);
        communityReserve.fundCredit(validatorId);
        if (validatorRegistry.pendingProtocolCredit(validatorId) != FULL_BOND) revert NotApprovedGenesis();

        emit FullValidatorSponsorshipFunded(validatorId, beneficiary, FULL_BOND, purposeHash);
    }
}
