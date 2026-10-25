// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./FantasySlateBook420.sol";
import "../../apps/Identity420.sol";

/// @notice Shared immutable identity, receipt and roster-validation boundary.
contract FantasyAdmission420 {
    FantasySlateBook420 public immutable slates;
    Identity420 public immutable identities;
    bytes32 public immutable issuer;
    bytes32 public immutable credentialType;
    mapping(bytes32 => bytes32) public credentialOf;
    error Unauthorized();
    error InvalidSignature();

    constructor(address slate_, address identity_, bytes32 issuer_, bytes32 type_) {
        slates = FantasySlateBook420(slate_);
        identities = Identity420(identity_);
        issuer = issuer_;
        credentialType = type_;
    }

    function controllerOf(bytes32 subject) public view returns (address) {
        (address actor,,,,,, bool active) = identities.profiles(subject);
        return active ? actor : address(0);
    }

    function requireController(bytes32 subject, address actor) external view {
        if (actor == address(0) || controllerOf(subject) != actor) revert Unauthorized();
    }

    function credentialKey(bytes32 subject, bytes32 credential) public view returns (bytes32) {
        IIdentityCredential420.CredentialView memory c = identities.credential(credential);
        if (
            c.subjectId != subject || c.issuerId != issuer || c.credentialType != credentialType
                || !identities.credentialMeetsTrust(credential, Identity420.TrustClass.VERIFIED)
        ) revert Unauthorized();
        (,,, bytes32 person,,,,) = identities.credentials(credential);
        if (person == 0) revert Unauthorized();
        return keccak256(abi.encode(issuer, person));
    }

    function requireUser(bytes32 subject, bytes32 credential, address actor, bytes32 pool, uint256 amount)
        external
        view
        returns (bytes32)
    {
        if (actor == address(0) || controllerOf(subject) != actor) revert Unauthorized();
        _entryAuthority(actor, pool, amount);
        return credentialKey(subject, credential);
    }

    function requireEntryActor(bytes32 subject, address actor, bytes32 pool) external view {
        if (actor == address(0) || controllerOf(subject) != actor) revert Unauthorized();
        _entryAuthority(actor, pool, 0);
    }

    function _entryAuthority(address actor, bytes32 pool, uint256 amount) private view {
        BetAuthorization420 auth = slates.authorization();
        if (!auth.isAuthorized(actor, BetIds420.ACTION_FANTASY_ENTER, auth.scopeForContest(pool), amount)) {
            revert Unauthorized();
        }
    }

    function registerIdentity(bytes32 subject, bytes32 credential) external {
        credentialKey(subject, credential);
        credentialOf[subject] = credential;
    }

    function currentUserKey(bytes32 subject) external view returns (bytes32) {
        if (credentialOf[subject] == 0) return bytes32(0);
        try this.credentialKey(subject, credentialOf[subject]) returns (bytes32 key) {
            return key;
        } catch {
            return bytes32(0);
        }
    }

    function verifyReceipt(
        bytes32 slate,
        bytes32 digest,
        bytes calldata signature,
        uint64 expiry,
        uint256 envelopeLength,
        bytes32 commitment
    ) external view {
        FantasySlateBook420.Slate memory s = slates.slateOf(slate);
        if (
            commitment == 0 || envelopeLength != 317 || expiry < block.timestamp || expiry > s.lockAt
                || signature.length != 65
        ) {
            revert InvalidSignature();
        }
        bytes32 r;
        bytes32 sigS;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            sigS := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if ((v != 27 && v != 28) || uint256(sigS) > 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0)
        {
            revert InvalidSignature();
        }
        address signer = ecrecover(digest, v, r, sigS);
        BetAuthorization420 auth = slates.authorization();
        if (
            signer == address(0) || signer != s.validator
                || !auth.isAuthorized(signer, slates.VALIDATE_LINEUP(), auth.scopeForContest(slate), 0)
        ) revert InvalidSignature();
    }

    function validLineup(bytes32 slate, uint32[7] calldata lineup) external view returns (bool) {
        for (uint256 i; i < 7; i++) {
            FantasyTypes420.Athlete memory a = slates.athleteOf(slate, lineup[i]);
            uint8 required = i == 0 ? 1 : i == 1 ? 2 : i == 2 ? 4 : i < 5 ? 8 : i == 5 ? 16 : 15;
            if (a.id == 0 || (a.positions & required) == 0) return false;
            for (uint256 j; j < i; j++) {
                if (lineup[j] == lineup[i]) return false;
            }
        }
        return true;
    }
}
