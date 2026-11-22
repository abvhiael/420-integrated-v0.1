// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./CivicIds420.sol";

interface ICivicBootstrapIdentity420 {
    function profiles(
        bytes32 profileId
    )
        external
        view
        returns (
            address controller,
            address pendingController,
            bytes32 metadataHash,
            bytes32 primaryName,
            uint64 createdAt,
            uint64 updatedAt,
            bool active
        );
    function credentials(
        bytes32 credentialId
    )
        external
        view
        returns (
            bytes32 issuerId,
            bytes32 subjectProfileId,
            bytes32 credentialType,
            bytes32 claimHash,
            uint64 issuedAt,
            uint64 expiresAt,
            uint64 revokedAt,
            bool subjectRejected
        );
    function credentialMeetsTrust(
        bytes32 credentialId,
        uint8 minTrust
    ) external view returns (bool);
}

interface ICivicBootstrapValidators420 {
    function ownerValidatorId(
        address owner
    ) external view returns (bytes32);
    function retirementOwnerStatus(
        bytes32 validatorId
    ) external view returns (address owner, bool eligible, uint64 continuouslyEligibleSince);
}

/// @notice One-way, independently verified first-electorate enrollment before Civic activation.
/// @dev Members enroll themselves after Genesis. Neither token balances nor a curator's asserted
/// roster confer eligibility. The source contracts still own all proposal Merkle snapshots.
contract CivicInitialElectorateEnrollment420 {
    address public constant IDENTITY_420 = 0x0000000000000000000000000000000000000436;
    address public constant VALIDATORS_420 = 0x0000000000000000000000000000000000000423;
    uint8 public constant VERIFIED_TRUST = 2;
    bytes32 public constant COMMUNITY_MEMBERSHIP_CREDENTIAL = keccak256("420/CIVIC/COMMUNITY_ELECTORATE/V1");
    bytes32 public constant VALIDATOR_MEMBERSHIP_CREDENTIAL = keccak256("420/CIVIC/VALIDATOR_ELECTORATE/V1");

    struct Enrollment {
        address voter;
        bytes32 profileId;
        bytes32 credentialId;
        bytes32 validatorId;
    }

    address public immutable governance;
    uint256 public immutable deploymentChainId;
    bool public enrollmentClosed;
    Enrollment[] private _community;
    Enrollment[] private _validator;
    mapping(uint8 => mapping(address => bool)) public enrolled;
    mapping(uint8 => mapping(bytes32 => bool)) public enrolledProfile;

    error Unauthorized();
    error WrongChain();
    error EnrollmentClosed();
    error DuplicateEnrollment();
    error Ineligible();
    error EmptyElectorate();

    event MemberEnrolled(CivicIds420.House indexed house, address indexed voter, bytes32 indexed profileId);
    event MemberWithdrawn(CivicIds420.House indexed house, address indexed voter, bool invalidated);
    event InitialElectoratesClosed(
        bytes32 communityRoot, uint256 communityWeight, bytes32 validatorRoot, uint256 validatorWeight
    );

    constructor(
        address governance_
    ) {
        if (governance_ == address(0)) revert Unauthorized();
        governance = governance_;
        deploymentChainId = block.chainid;
    }

    function count(
        CivicIds420.House house
    ) external view returns (uint256) {
        return house == CivicIds420.House.COMMUNITY ? _community.length : _validator.length;
    }

    function member(
        CivicIds420.House house,
        uint256 index
    ) external view returns (Enrollment memory) {
        return house == CivicIds420.House.COMMUNITY ? _community[index] : _validator[index];
    }

    /// @notice Self-enrollment requires active issuer-trusted VERIFIED identity; validator
    /// enrollment additionally requires consensus-maintained eligible validator ownership.
    function enroll(
        CivicIds420.House house,
        bytes32 profileId,
        bytes32 credentialId
    ) external {
        if (block.chainid != deploymentChainId) revert WrongChain();
        if (enrollmentClosed) revert EnrollmentClosed();
        uint8 h = uint8(house);
        if (msg.sender == address(0) || profileId == bytes32(0) || credentialId == bytes32(0)) revert Ineligible();
        if (enrolled[h][msg.sender] || enrolledProfile[h][profileId]) revert DuplicateEnrollment();
        bytes32 validatorId;
        if (house == CivicIds420.House.VALIDATOR) {
            validatorId = _validatorId(msg.sender);
        }
        Enrollment memory record = Enrollment(msg.sender, profileId, credentialId, validatorId);
        _verify(record, house);
        enrolled[h][msg.sender] = true;
        enrolledProfile[h][profileId] = true;
        if (house == CivicIds420.House.COMMUNITY) _community.push(record);
        else _validator.push(record);
        emit MemberEnrolled(house, msg.sender, profileId);
    }

    /// @notice Voters can withdraw/refresh records before the one-way seal.
    function withdraw(
        CivicIds420.House house
    ) external {
        _requireOpen();
        _remove(house, msg.sender);
    }

    /// @notice Anyone can eject a credential/status that is provably no longer eligible.
    /// A verified eligible member can never be removed by a third party.
    function pruneIneligible(
        CivicIds420.House house,
        address voter
    ) external {
        _requireOpen();
        if (!enrolled[uint8(house)][voter]) revert Ineligible();
        (bool valid,) = address(this).staticcall(abi.encodeCall(this.verifyMember, (house, voter)));
        if (valid) revert Ineligible();
        _remove(house, voter);
    }

    function verifyMember(
        CivicIds420.House house,
        address voter
    ) external view returns (bool) {
        Enrollment[] storage records = house == CivicIds420.House.COMMUNITY ? _community : _validator;
        for (uint256 i; i < records.length; ++i) {
            if (records[i].voter == voter) {
                _verify(records[i], house);
                return true;
            }
        }
        revert Ineligible();
    }

    function _requireOpen() private view {
        if (block.chainid != deploymentChainId) revert WrongChain();
        if (enrollmentClosed) revert EnrollmentClosed();
    }

    function _remove(
        CivicIds420.House house,
        address voter
    ) private {
        Enrollment[] storage records = house == CivicIds420.House.COMMUNITY ? _community : _validator;
        uint256 count_ = records.length;
        for (uint256 i; i < count_; ++i) {
            if (records[i].voter == voter) {
                enrolled[uint8(house)][voter] = false;
                enrolledProfile[uint8(house)][records[i].profileId] = false;
                if (i != count_ - 1) records[i] = records[count_ - 1];
                records.pop();
                emit MemberWithdrawn(house, voter, msg.sender != voter);
                return;
            }
        }
        revert Ineligible();
    }

    /// @notice Only the Genesis-plan-approved Governance compatibility contract can freeze
    /// both first electorates. Reverts atomically if any member became ineligible.
    function seal()
        external
        returns (bytes32 communityRoot, uint256 communityWeight, bytes32 validatorRoot, uint256 validatorWeight)
    {
        if (msg.sender != governance) revert Unauthorized();
        if (block.chainid != deploymentChainId) revert WrongChain();
        if (enrollmentClosed) revert EnrollmentClosed();
        if (_community.length == 0 || _validator.length == 0) revert EmptyElectorate();
        (communityRoot, communityWeight) = _root(_community, CivicIds420.House.COMMUNITY);
        (validatorRoot, validatorWeight) = _root(_validator, CivicIds420.House.VALIDATOR);
        enrollmentClosed = true;
        emit InitialElectoratesClosed(communityRoot, communityWeight, validatorRoot, validatorWeight);
    }

    /// @notice Recheck genuine live eligibility at the irreversible Timelock handoff.
    function verifyClosed() external view returns (bool) {
        if (!enrollmentClosed || block.chainid != deploymentChainId) revert EnrollmentClosed();
        for (uint256 i; i < _community.length; ++i) _verify(_community[i], CivicIds420.House.COMMUNITY);
        for (uint256 i; i < _validator.length; ++i) _verify(_validator[i], CivicIds420.House.VALIDATOR);
        return true;
    }

    function _validatorId(
        address voter
    ) private view returns (bytes32 id) {
        if (VALIDATORS_420.code.length == 0) revert Ineligible();
        id = ICivicBootstrapValidators420(VALIDATORS_420).ownerValidatorId(voter);
        if (id == bytes32(0)) revert Ineligible();
    }

    function _verify(
        Enrollment memory record,
        CivicIds420.House house
    ) private view {
        if (IDENTITY_420.code.length == 0) revert Ineligible();
        ICivicBootstrapIdentity420 identity = ICivicBootstrapIdentity420(IDENTITY_420);
        (address controller,,,,,, bool active) = identity.profiles(record.profileId);
        (, bytes32 subject, bytes32 credentialType,,,,,) = identity.credentials(record.credentialId);
        bytes32 expectedType =
            house == CivicIds420.House.COMMUNITY ? COMMUNITY_MEMBERSHIP_CREDENTIAL : VALIDATOR_MEMBERSHIP_CREDENTIAL;
        if (
            controller != record.voter || !active || subject != record.profileId || credentialType != expectedType
                || !identity.credentialMeetsTrust(record.credentialId, VERIFIED_TRUST)
        ) revert Ineligible();

        if (house == CivicIds420.House.VALIDATOR) {
            if (record.validatorId == bytes32(0) || _validatorId(record.voter) != record.validatorId) {
                revert Ineligible();
            }
            (address owner, bool eligible,) =
                ICivicBootstrapValidators420(VALIDATORS_420).retirementOwnerStatus(record.validatorId);
            if (owner != record.voter || !eligible) revert Ineligible();
        }
    }

    /// @dev Numeric address order, keccak256(abi.encode(address)) leaves, sorted-pair
    /// hashing and unpaired-node promotion exactly match the retained Civic proof generator.
    function _root(
        Enrollment[] storage records,
        CivicIds420.House house
    ) private view returns (bytes32 root, uint256 totalWeight) {
        totalWeight = records.length;
        address[] memory voters = new address[](totalWeight);
        for (uint256 i; i < totalWeight; ++i) {
            Enrollment memory record = records[i];
            _verify(record, house);
            voters[i] = record.voter;
        }
        for (uint256 i = 1; i < totalWeight; ++i) {
            address key = voters[i];
            uint256 j = i;
            while (j != 0 && uint160(voters[j - 1]) > uint160(key)) {
                voters[j] = voters[j - 1];
                --j;
            }
            voters[j] = key;
        }
        bytes32[] memory nodes = new bytes32[](totalWeight);
        for (uint256 i; i < totalWeight; ++i) nodes[i] = keccak256(abi.encode(voters[i]));
        uint256 width = totalWeight;
        while (width > 1) {
            uint256 nextWidth;
            for (uint256 i; i < width; i += 2) {
                if (i + 1 == width) {
                    nodes[nextWidth++] = nodes[i];
                } else {
                    bytes32 a = nodes[i];
                    bytes32 b = nodes[i + 1];
                    nodes[nextWidth++] = a <= b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
                }
            }
            width = nextWidth;
        }
        root = nodes[0];
    }
}
