// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../BetAuthorization420.sol";
import "../../apps/Identity420.sol";
import "../../interfaces/IOracle420.sol";
import "./IFantasyDisputeHost420.sol";

interface IFantasyBondToken420 {
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
}

/// @notice Bounded fantasy disputes, canonical oracle evidence, scoped resolvers and bond custody.
/// @dev Custodies challenge bonds ONLY. No sports-data truth, ranking proof, entry/prize
/// custody or production host is implied. Administrators cannot submit payout vectors.
/// Native $420 uses asset=0; otherwise deployment must bind the canonical token.
contract FantasyDisputeController420 {
    bytes32 public constant DOMAIN = keccak256("420.BET.FANTASY.DISPUTE.V1");
    bytes32 public constant REGISTER = keccak256("BET_FANTASY_DISPUTE_REGISTER.V1");
    bytes32 public constant RESOLVE = keccak256("BET_FANTASY_DISPUTE_RESOLVE.V1");
    bytes32 public constant DELEGATE = keccak256("BET_FANTASY_DISPUTE_DELEGATE.V1");
    bytes32 public constant ENABLE_DELEGATION = keccak256("BET_FANTASY_DISPUTE_ENABLE_DELEGATION.V1");
    uint64 public constant CORRECTION_WINDOW = 1 days;
    uint64 public constant CHALLENGE_WINDOW = 1 days;
    uint64 public constant RESOLUTION_WINDOW = 3 days;
    uint64 public constant RE_REVIEW_WINDOW = 1 days;

    BetAuthorization420 public immutable authorization;
    Identity420 public immutable identities;
    IOracle420 public immutable oracle;
    bytes32 public immutable resolverCredentialType;
    address public immutable asset;
    address public immutable communityFund;
    bool public delegationEnabled;
    uint256 public totalLiability;
    uint256 private entered;

    enum PoolState {
        NONE,
        REGISTERED,
        REVIEW,
        FINAL,
        CANCELED
    }
    enum Verdict {
        PENDING,
        UPHELD,
        DENIED
    }

    struct Config {
        address host;
        bytes32 manifest;
        bytes32 dataPolicy;
        bytes32 scoringProfile;
        bytes32 candidateFeed;
        uint256 entryFee;
        uint256 freePrize;
        bool paid;
    }

    struct Candidate {
        bytes32 statRoot;
        bytes32 rankingRoot;
        bytes32 evidence;
        uint64 dataAsOf;
        uint64 revision;
    }

    struct Pool {
        PoolState state;
        uint64 correctionEnd;
        uint64 challengeEnd;
        uint64 deadline;
        uint64 reviewUntil;
        uint64 generation;
        uint64 statRevision;
        uint256 pending;
        bytes32 candidate;
        bool invalidated;
    }

    struct Claim {
        bytes32 poolId;
        bytes32 subject;
        address payer;
        bytes32 candidate;
        bytes32 evidence;
        uint256 bond;
        uint64 createdAt;
        Verdict verdict;
        bool collected;
    }

    struct Delegation {
        address grantor;
        bytes32 subject;
        bytes32 credential;
        uint64 expiresAt;
        uint64 epoch;
        bool accepted;
    }
    mapping(bytes32 => Config) private configs;
    mapping(bytes32 => Pool) private pools;
    mapping(bytes32 => Claim) private claims;
    mapping(bytes32 => Delegation) public delegations;
    mapping(bytes32 => uint64) public delegationEpoch;
    mapping(bytes32 => bool) public challengeUsed;
    mapping(address => uint256) public credit;

    error InvalidInput();
    error Unauthorized();
    error InvalidState();
    error InvalidTime();
    error InvalidEvidence();
    error TransferFailed();
    error Reentrancy();
    event PoolRegistered(bytes32 indexed poolId, address indexed host, bytes32 manifest, bytes32 dataPolicy);
    event CorrectionStarted(bytes32 indexed poolId, uint64 correctionEnd, uint64 challengeEnd, uint64 deadline);
    event CandidatePublished(
        bytes32 indexed poolId, bytes32 candidate, uint64 generation, uint64 reviewUntil, bytes32 evidence
    );
    event Challenged(
        bytes32 indexed claimId,
        bytes32 indexed poolId,
        bytes32 indexed subject,
        address payer,
        uint256 bond,
        bytes32 evidence
    );
    event DelegationEnabled();
    event ResolverDelegated(
        bytes32 indexed claimId, bytes32 indexed subject, uint64 epoch, uint64 expiresAt, bytes32 credential
    );
    event DelegationAccepted(bytes32 indexed claimId, uint64 epoch);
    event DelegationRevoked(bytes32 indexed claimId, uint64 epoch);
    event Resolved(bytes32 indexed claimId, Verdict verdict, address resolver, bytes32 reason, uint64 epoch);
    event PoolFinalized(bytes32 indexed poolId, bytes32 candidate);
    event PoolCanceled(bytes32 indexed poolId, bytes32 reason);
    event BondCredited(bytes32 indexed claimId, address indexed beneficiary, uint256 amount);
    event Withdrawn(address indexed beneficiary, uint256 amount);

    constructor(
        address auth_,
        address identity_,
        address oracle_,
        bytes32 credentialType_,
        address asset_,
        address community_
    ) {
        if (
            auth_.code.length == 0 || identity_.code.length == 0 || oracle_.code.length == 0
                || credentialType_ == bytes32(0) || community_ == address(0) || community_ == address(this)
                || (asset_ != address(0) && asset_.code.length == 0)
        ) revert InvalidInput();
        authorization = BetAuthorization420(auth_);
        identities = Identity420(identity_);
        oracle = IOracle420(oracle_);
        resolverCredentialType = credentialType_;
        asset = asset_;
        communityFund = community_;
    }
    modifier nonReentrant() {
        if (entered != 0) revert Reentrancy();
        entered = 1;
        _;
        entered = 0;
    }

    function poolOf(bytes32 id) external view returns (Pool memory) {
        return pools[id];
    }

    function configOf(bytes32 id) external view returns (Config memory) {
        return configs[id];
    }

    function claimOf(bytes32 id) external view returns (Claim memory) {
        return claims[id];
    }

    function claimScope(bytes32 id) public view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN, block.chainid, address(this), "CLAIM", id));
    }

    function _cap(address who, bytes32 action, bytes32 scope) private view {
        if (!authorization.isAuthorized(who, action, scope, 0)) revert Unauthorized();
    }

    /// Host registration capability must only be granted after its entry/prize graph is qualified.
    function registerPool(bytes32 id, Config calldata config) external {
        if (
            id == bytes32(0) || config.host != msg.sender || msg.sender.code.length == 0
                || config.manifest == bytes32(0) || config.dataPolicy == bytes32(0)
                || config.scoringProfile == bytes32(0) || config.candidateFeed == bytes32(0)
                || (config.paid ? config.entryFee == 0 || config.freePrize != 0 : config.entryFee != 0)
        ) revert InvalidInput();
        _cap(msg.sender, REGISTER, authorization.scopeForContest(id));
        if (pools[id].state != PoolState.NONE) revert InvalidState();
        configs[id] = config;
        pools[id].state = PoolState.REGISTERED;
        emit PoolRegistered(id, msg.sender, config.manifest, config.dataPolicy);
    }

    function _host(bytes32 id) private view {
        if (msg.sender != configs[id].host || msg.sender == address(0)) revert Unauthorized();
    }

    /// The authoritative host supplies evidenced slate resolution; no admin can reset the clocks.
    function startCorrection(bytes32 id, uint64 resolvedAt) external {
        _host(id);
        Pool storage p = pools[id];
        if (p.state != PoolState.REGISTERED) revert InvalidState();
        if (
            resolvedAt == 0 || resolvedAt > block.timestamp
                || block.timestamp >= uint256(resolvedAt) + CORRECTION_WINDOW
        ) revert InvalidTime();
        p.state = PoolState.REVIEW;
        p.correctionEnd = resolvedAt + CORRECTION_WINDOW;
        p.challengeEnd = p.correctionEnd + CHALLENGE_WINDOW;
        p.deadline = p.challengeEnd + RESOLUTION_WINDOW;
        emit CorrectionStarted(id, p.correctionEnd, p.challengeEnd, p.deadline);
    }

    function candidateDigest(bytes32 id, Candidate calldata candidate) public view returns (bytes32) {
        Config storage c = configs[id];
        return keccak256(
            abi.encode(
                DOMAIN, block.chainid, address(this), id, c.host, c.manifest, c.dataPolicy, c.scoringProfile, candidate
            )
        );
    }

    /// Read canonical oracle evidence, never treat an observation submission as acceptance.
    function _read(bytes32 feed, bytes32 expected, uint64 earliest) private view {
        IOracle420.ResultRead memory r = oracle.readResult(feed);
        if (
            r.resultHash != expected || r.updatedAt < earliest || r.updatedAt > block.timestamp
                || r.agreeingSources == 0
        ) revert InvalidEvidence();
    }

    function publishCandidate(bytes32 id, Candidate calldata candidate) external {
        _host(id);
        Pool storage p = pools[id];
        if (
            p.state != PoolState.REVIEW || candidate.statRoot == bytes32(0) || candidate.rankingRoot == bytes32(0)
                || candidate.evidence == bytes32(0) || candidate.revision <= p.statRevision
                || candidate.dataAsOf < p.correctionEnd - CORRECTION_WINDOW || candidate.dataAsOf > p.correctionEnd
                || candidate.dataAsOf > block.timestamp
        ) revert InvalidEvidence();
        bool correcting = block.timestamp >= p.correctionEnd;
        if (correcting) {
            if (
                !p.invalidated || p.pending != 0 || block.timestamp < p.challengeEnd
                    || block.timestamp + RE_REVIEW_WINDOW > p.deadline
            ) revert InvalidTime();
        }
        bytes32 digest = candidateDigest(id, candidate);
        if (digest == p.candidate) revert InvalidEvidence();
        _read(configs[id].candidateFeed, digest, candidate.dataAsOf);
        p.candidate = digest;
        p.statRevision = candidate.revision;
        p.generation++;
        p.invalidated = false;
        p.reviewUntil = correcting ? uint64(block.timestamp) + RE_REVIEW_WINDOW : p.challengeEnd;
        emit CandidatePublished(id, digest, p.generation, p.reviewUntil, candidate.evidence);
    }

    function bondFor(bytes32 id) public view returns (uint256) {
        Config storage c = configs[id];
        uint256 value = c.paid ? c.entryFee : c.freePrize;
        uint256 divisor = c.paid ? 2 : 10;
        // Round up to one base unit; never undercharge a positive fractional bond.
        return value / divisor + (value % divisor == 0 ? 0 : 1);
    }

    function _controller(bytes32 subject, address actor) private view {
        (address controller,,,,,, bool active) = identities.profiles(subject);
        if (!active || controller != actor || actor == address(0)) revert Unauthorized();
    }

    function challenge(bytes32 id, bytes32 subject, bytes32 evidence)
        external
        payable
        nonReentrant
        returns (bytes32 claimId)
    {
        Pool storage p = pools[id];
        if (p.state != PoolState.REVIEW || p.candidate == bytes32(0) || evidence == bytes32(0)) revert InvalidState();
        if (block.timestamp < p.correctionEnd || block.timestamp >= p.reviewUntil || block.timestamp >= p.deadline) {
            revert InvalidTime();
        }
        _controller(subject, msg.sender);
        if (!IFantasyDisputeHost420(configs[id].host).isEntrant(id, subject)) revert Unauthorized();
        // One submission per entrant/revision; aggregate issues in its evidence.
        // Varying evidence hashes must not permit an unbounded claim flood.
        bytes32 key = keccak256(abi.encode(id, p.generation, subject));
        if (challengeUsed[key]) revert InvalidState();
        challengeUsed[key] = true;
        claimId = keccak256(abi.encode(DOMAIN, block.chainid, address(this), key, evidence));
        uint256 bond = bondFor(id);
        claims[claimId] = Claim(
            id, subject, msg.sender, p.candidate, evidence, bond, uint64(block.timestamp), Verdict.PENDING, false
        );
        p.pending++;
        totalLiability += bond;
        _receiveExact(bond);
        emit Challenged(claimId, id, subject, msg.sender, bond, evidence);
    }

    function enableDelegation() external {
        _cap(msg.sender, ENABLE_DELEGATION, authorization.scopeGlobal());
        if (delegationEnabled) revert InvalidState();
        delegationEnabled = true;
        emit DelegationEnabled();
    }

    function _verified(bytes32 subject, bytes32 credential, address actor) private view {
        _controller(subject, actor);
        // Check this exact credential, not an unrelated valid credential of the same type.
        IIdentityCredential420.CredentialView memory c = identities.credential(credential);
        if (
            c.subjectId != subject || c.credentialType != resolverCredentialType
                || !identities.credentialMeetsTrust(credential, Identity420.TrustClass.VERIFIED)
        ) revert Unauthorized();
    }

    function _independent(bytes32 id, bytes32 subject) private view {
        if (
            IFantasyDisputeHost420(configs[id].host).isInterested(id, subject)
                || IFantasyDisputeHost420(configs[id].host).isEntrant(id, subject)
        ) revert Unauthorized();
    }

    function delegateResolver(bytes32 claimId, bytes32 subject, bytes32 credential, uint64 expiresAt) external {
        Claim storage c = claims[claimId];
        Pool storage p = pools[c.poolId];
        _cap(msg.sender, DELEGATE, claimScope(claimId));
        if (
            !delegationEnabled || c.payer == address(0) || c.verdict != Verdict.PENDING || p.state != PoolState.REVIEW
                || block.timestamp >= p.deadline || expiresAt <= block.timestamp || expiresAt > p.deadline
        ) revert InvalidState();
        (address actor,,,,,,) = identities.profiles(subject);
        if (actor == c.payer) revert Unauthorized();
        _verified(subject, credential, actor);
        _independent(c.poolId, subject);
        uint64 epoch = ++delegationEpoch[claimId];
        delegations[claimId] = Delegation(msg.sender, subject, credential, expiresAt, epoch, false);
        emit ResolverDelegated(claimId, subject, epoch, expiresAt, credential);
    }

    function acceptDelegation(bytes32 claimId, uint64 epoch) external {
        Delegation storage d = delegations[claimId];
        if (d.grantor == address(0) || epoch != d.epoch || d.accepted || block.timestamp >= d.expiresAt) {
            revert InvalidState();
        }
        _verified(d.subject, d.credential, msg.sender);
        _cap(d.grantor, DELEGATE, claimScope(claimId));
        d.accepted = true;
        emit DelegationAccepted(claimId, epoch);
    }

    function revokeDelegation(bytes32 claimId) external {
        _cap(msg.sender, DELEGATE, claimScope(claimId));
        uint64 epoch = ++delegationEpoch[claimId];
        delete delegations[claimId];
        emit DelegationRevoked(claimId, epoch);
    }

    /// Native transactions bind sender, chain and this controller. Expected candidate and
    /// epoch reject stale decisions; no reusable off-chain bearer signature is accepted.
    function resolve(
        bytes32 claimId,
        bool upheld,
        bytes32 reason,
        bytes32 expectedCandidate,
        bytes32 resolverSubject,
        bytes32 credential,
        uint64 epoch
    ) external {
        Claim storage c = claims[claimId];
        if (msg.sender == c.payer) revert Unauthorized();
        _verified(resolverSubject, credential, msg.sender);
        _independent(c.poolId, resolverSubject);
        if (epoch == 0) {
            _cap(msg.sender, RESOLVE, claimScope(claimId));
        } else {
            Delegation storage d = delegations[claimId];
            if (
                !delegationEnabled || !d.accepted || d.epoch != epoch || d.subject != resolverSubject
                    || d.credential != credential || block.timestamp >= d.expiresAt
            ) revert Unauthorized();
            _cap(d.grantor, DELEGATE, claimScope(claimId));
        }
        _resolve(claimId, upheld, reason, expectedCandidate, epoch);
    }

    function verdictFeed(bytes32 claimId) public view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN, block.chainid, address(this), "VERDICT_FEED", claimId));
    }

    function verdictDigest(bytes32 claimId, bool upheld, bytes32 reason) public view returns (bytes32) {
        Claim storage c = claims[claimId];
        Config storage cfg = configs[c.poolId];
        return keccak256(
            abi.encode(
                DOMAIN,
                block.chainid,
                address(this),
                claimId,
                c.poolId,
                cfg.manifest,
                cfg.dataPolicy,
                c.candidate,
                c.evidence,
                upheld,
                reason
            )
        );
    }

    /// Permissionless execution of an authenticated canonical computation verdict.
    /// Report authenticity is not proof that sports facts are true: feed qualification
    /// and source-policy enforcement remain mandatory outside this controller.
    function resolveCanonical(bytes32 claimId, bool upheld, bytes32 reason) external {
        Claim storage c = claims[claimId];
        _read(verdictFeed(claimId), verdictDigest(claimId, upheld, reason), c.createdAt);
        _resolve(claimId, upheld, reason, c.candidate, 0);
    }

    function _resolve(bytes32 claimId, bool upheld, bytes32 reason, bytes32 expectedCandidate, uint64 epoch) private {
        Claim storage c = claims[claimId];
        Pool storage p = pools[c.poolId];
        if (
            c.payer == address(0) || c.verdict != Verdict.PENDING || p.state != PoolState.REVIEW
                || expectedCandidate != c.candidate || expectedCandidate != p.candidate || reason == bytes32(0)
        ) revert InvalidState();
        if (block.timestamp < p.reviewUntil || block.timestamp >= p.deadline) revert InvalidTime();
        c.verdict = upheld ? Verdict.UPHELD : Verdict.DENIED;
        p.pending--;
        if (upheld) p.invalidated = true;
        emit Resolved(claimId, c.verdict, msg.sender, reason, epoch);
    }

    function canSettle(bytes32 id) public view returns (bool) {
        Pool storage p = pools[id];
        return p.state == PoolState.FINAL;
    }

    function _ready(bytes32 id) private view returns (bool) {
        Pool storage p = pools[id];
        if (!(p.state == PoolState.REVIEW && p.candidate != bytes32(0) && !p.invalidated && p.pending == 0
                    && block.timestamp >= p.reviewUntil && block.timestamp >= p.challengeEnd)) return false;
        try IFantasyDisputeHost420(configs[id].host).candidateIsCurrent(id, p.candidate) returns (bool current) {
            return current;
        } catch {
            return false;
        }
    }

    function finalize(bytes32 id) external {
        Pool storage p = pools[id];
        if (!_ready(id)) revert InvalidState();
        p.state = PoolState.FINAL;
        emit PoolFinalized(id, p.candidate);
    }

    /// No loops over entrants or claims. Bond refunds are independently collectible.
    function expire(bytes32 id) external {
        Pool storage p = pools[id];
        if (p.state != PoolState.REVIEW || block.timestamp < p.deadline || _ready(id)) revert InvalidState();
        _cancel(id, keccak256("UNRESOLVED_AT_DEADLINE"));
    }

    function cancelByHost(bytes32 id, bytes32 reason) external {
        _host(id);
        if (reason == bytes32(0) || (pools[id].state != PoolState.REGISTERED && pools[id].state != PoolState.REVIEW)) {
            revert InvalidState();
        }
        _cancel(id, reason);
    }

    function _cancel(bytes32 id, bytes32 reason) private {
        pools[id].state = PoolState.CANCELED;
        emit PoolCanceled(id, reason);
    }

    function collectBond(bytes32 claimId) external {
        Claim storage c = claims[claimId];
        if (
            c.payer == address(0) || c.collected
                || (c.verdict == Verdict.PENDING && pools[c.poolId].state != PoolState.CANCELED)
        ) revert InvalidState();
        c.collected = true;
        address beneficiary = c.verdict == Verdict.DENIED ? communityFund : c.payer;
        credit[beneficiary] += c.bond;
        emit BondCredited(claimId, beneficiary, c.bond);
    }

    function withdrawCredit() external nonReentrant {
        uint256 amount = credit[msg.sender];
        if (amount == 0) revert InvalidState();
        credit[msg.sender] = 0;
        totalLiability -= amount;
        _sendExact(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function _receiveExact(uint256 amount) private {
        if (asset == address(0)) {
            if (msg.value != amount) revert InvalidInput();
        } else {
            if (msg.value != 0) revert InvalidInput();
            IFantasyBondToken420 token = IFantasyBondToken420(asset);
            uint256 beforeVault = token.balanceOf(address(this));
            uint256 beforePayer = token.balanceOf(msg.sender);
            if (amount != 0 && !token.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
            if (
                token.balanceOf(address(this)) != beforeVault + amount
                    || token.balanceOf(msg.sender) + amount != beforePayer
            ) revert TransferFailed();
        }
    }

    function _sendExact(address recipient, uint256 amount) private {
        if (asset == address(0)) {
            (bool ok,) = payable(recipient).call{value: amount}("");
            if (!ok) revert TransferFailed();
        } else {
            IFantasyBondToken420 token = IFantasyBondToken420(asset);
            uint256 beforeVault = token.balanceOf(address(this));
            uint256 beforeRecipient = token.balanceOf(recipient);
            if (
                !token.transfer(recipient, amount) || token.balanceOf(address(this)) + amount != beforeVault
                    || token.balanceOf(recipient) != beforeRecipient + amount
            ) revert TransferFailed();
        }
    }
}
