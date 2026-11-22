// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Named, opt-in community governance committee used for founding-era appointment
/// and the 15-member uninterrupted membership retirement threshold.
/// @dev Appointment is not the Community electorate or its vote. Civic decisions remain
/// authoritative for community-level policy and recalls.
contract FoundingCommitteeMembership420 {
    address public immutable foundingAdministrator;
    address public immutable andrew;
    address public immutable janet;
    address public immutable governanceTimelock;
    address public retirementAuthority;
    uint256 public memberCount;
    uint64 public committeeQualifiedSince;

    mapping(address => bool) public nominated;
    mapping(address => bytes32) public nominationEvidence;
    mapping(address => bool) public isMember;

    error Unauthorized();
    error InvalidCandidate();
    error NotNominated();
    error Duplicate();
    error NotMember();
    error InvalidEvidence();
    error RetirementAuthorityUnbound();

    event CandidateNominated(address indexed candidate, bytes32 indexed evidence);
    event MemberAppointed(address indexed candidate, bytes32 indexed evidence, bool foundingSeat);
    event MemberRemoved(address indexed candidate, bytes32 indexed evidence, bool byCivic);
    event RetirementAuthorityBound(address indexed authority);
    event CommitteeQualifiedSince(uint64 qualifiedSince, uint256 members);

    constructor(
        address administrator_,
        address andrew_,
        address janet_,
        address timelock_
    ) {
        if (
            administrator_ == address(0) || andrew_ == address(0) || janet_ == address(0) || administrator_ == andrew_
                || administrator_ == janet_ || andrew_ == janet_ || timelock_.code.length == 0
        ) revert InvalidCandidate();
        foundingAdministrator = administrator_;
        andrew = andrew_;
        janet = janet_;
        governanceTimelock = timelock_;
    }

    function isFoundingSeat(
        address wallet
    ) public view returns (bool) {
        return wallet == foundingAdministrator || wallet == andrew || wallet == janet;
    }

    /// @notice One-shot Timelock installation to link the actual retired flag.
    /// Before binding, founding membership mutations are disabled.
    function bindRetirementAuthority(
        address authority
    ) external {
        if (msg.sender != governanceTimelock || retirementAuthority != address(0) || authority.code.length == 0) {
            revert Unauthorized();
        }
        (bool ok, bytes memory data) = authority.staticcall(abi.encodeWithSignature("foundingAdministrator()"));
        if (!ok || data.length != 32 || abi.decode(data, (address)) != foundingAdministrator) revert Unauthorized();
        retirementAuthority = authority;
        emit RetirementAuthorityBound(authority);
    }

    function nominate(
        bytes32 evidence
    ) external {
        if (evidence == bytes32(0)) revert InvalidEvidence();
        nominated[msg.sender] = true; // candidate signs from their own wallet
        nominationEvidence[msg.sender] = evidence;
        emit CandidateNominated(msg.sender, evidence);
    }

    function appoint(
        address wallet,
        bytes32 evidence
    ) external {
        _requireAuthority();
        if (!nominated[wallet]) revert NotNominated();
        if (wallet == address(0) || isMember[wallet]) revert InvalidCandidate();
        if (evidence == bytes32(0)) revert InvalidEvidence();
        isMember[wallet] = true;
        ++memberCount;
        _resetMembershipStableSince();
        emit MemberAppointed(wallet, evidence, isFoundingSeat(wallet));
    }

    function remove(
        address wallet,
        bytes32 evidence
    ) external {
        _requireAuthority();
        if (!isMember[wallet]) revert NotMember();
        if (evidence == bytes32(0)) revert InvalidEvidence();
        // A founder cannot unilaterally dismiss one of the three founding seats.
        // The Civic electorate can recall a founding seat through its Timelock.
        if (isFoundingSeat(wallet) && msg.sender != governanceTimelock) revert Unauthorized();
        isMember[wallet] = false;
        --memberCount;
        _resetMembershipStableSince();
        emit MemberRemoved(wallet, evidence, msg.sender == governanceTimelock);
    }

    function _requireAuthority() private view {
        if (msg.sender == governanceTimelock) return;
        if (retirementAuthority == address(0)) revert RetirementAuthorityUnbound();
        (bool ok, bytes memory data) = retirementAuthority.staticcall(abi.encodeWithSignature("retired()"));
        if (msg.sender != foundingAdministrator || !ok || data.length != 32 || abi.decode(data, (bool))) {
            revert Unauthorized();
        }
    }

    function _resetMembershipStableSince() private {
        // A changed roster is not falsely counted as 15 unchanged people for 30 days.
        committeeQualifiedSince = memberCount >= 15 ? uint64(block.timestamp) : 0;
        emit CommitteeQualifiedSince(committeeQualifiedSince, memberCount);
    }
}
