// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./FantasyDisputeController420.sol";
import "./FantasySlateBook420.sol";
import "./FantasyNHLScoring420.sol";
import "./FantasyRankingBook420.sol";
import "./FantasyAdmission420.sol";
import "./FantasyPayoutPolicy420.sol";
import "../../revenue/DevelopmentCompensationVault420.sol";

/// @notice Permissioned-launch daily NHL pools with actual escrow and bounded deterministic settlement.
/// @dev The lineup custodian is trusted for confidentiality, admission and timely publication,
/// not for scores/payouts. On-chain plaintext validation and authenticated stat proofs gate payouts.
contract FantasyContestEngine420 is IFantasyDisputeHost420 {
    bytes32 internal constant DOMAIN = keccak256("420.FANTASY.CONTEST.V1");
    bytes32 public constant CREATE = keccak256("BET_FANTASY_CREATE_POOL.V1");
    bytes32 public constant INVITE = keccak256("BET_FANTASY_INVITE.V1");
    bytes32 public constant CONFLICT = keccak256("BET_FANTASY_RECORD_CONFLICT.V1");
    uint64 public constant PUBLICATION_WINDOW = 1 hours;
    FantasyDisputeController420 public immutable disputes;
    FantasySlateBook420 public immutable slateBook;
    FantasyNHLScoring420 public immutable scoring;
    FantasyRankingBook420 public immutable rankings;
    FantasyAdmission420 public immutable admission;
    FantasyPayoutPolicy420 public immutable payoutPolicy;
    BetAuthorization420 public immutable authorization;
    address public immutable asset;
    address public immutable devFund;
    uint256 public totalLiability;
    uint256 private entered;
    enum State {
        NONE,
        OPEN,
        LOCKED,
        REVIEW,
        SETTLED,
        CANCELED
    }

    struct Config {
        bytes32 slate;
        bytes32 candidateFeed;
        bytes32 launcher;
        uint256 entryFee;
        uint256 freePrize;
        uint64 cap;
        bool paid;
        bool inviteOnly;
    }

    struct Pool {
        State state;
        bytes32 manifest;
        address launcherAccount;
        uint64 count;
        uint64 revealed;
        uint64 lastAcceptedAt;
        uint64 revision;
        uint64 publishedRevision;
        uint256 gross;
        uint256 netPrize;
        uint256 fee;
        bytes32 publishedCandidate;
    }

    struct Entry {
        bytes32 subject;
        bytes32 userKey;
        address beneficiary;
        bytes32 commitment;
        uint64 nonce;
        bool revealed;
        bool claimed;
        uint32[7] lineup;
    }

    struct Submission {
        bytes32 commitment;
        uint64 nonce;
        uint64 expiry;
        bytes envelope;
        bytes signature;
    }
    mapping(bytes32 => Config) private configs;
    mapping(bytes32 => Pool) private pools;
    mapping(bytes32 => mapping(uint64 => Entry)) private entries;
    mapping(bytes32 => mapping(bytes32 => uint64)) public entryForSubject;
    mapping(bytes32 => mapping(bytes32 => uint64)) public entryForUser;
    mapping(bytes32 => mapping(bytes32 => bool)) public invited;
    mapping(bytes32 => mapping(bytes32 => bool)) public conflicts;
    mapping(bytes32 => mapping(uint64 => FantasyTypes420.StatReport)) private reports;
    mapping(address => uint256) public credit;
    error InvalidInput();
    error Unauthorized();
    error InvalidState();
    error InvalidTime();
    error InvalidLineup();
    error InvalidSignature();
    error TransferFailed();
    error Reentrancy();
    event PoolCreated(
        bytes32 indexed pool, bytes32 indexed slate, bytes32 manifest, bool paid, uint256 fee, uint256 prize
    );
    event EntryAccepted(
        bytes32 indexed pool,
        uint64 indexed entry,
        bytes32 indexed subject,
        uint64 nonce,
        bytes32 commitment,
        bytes envelope
    );
    event LineupPublished(bytes32 indexed pool, uint64 indexed entry, uint32[7] lineup, bytes32 salt);
    event PoolLocked(bytes32 indexed pool, uint64 count);
    event PoolCanceled(bytes32 indexed pool, bytes32 reason);
    event RevisionStarted(bytes32 indexed pool, uint64 revision, bytes32 statRoot);
    event EntryScored(bytes32 indexed pool, uint64 revision, uint64 entry, int256 score);
    event PoolSettled(bytes32 indexed pool, bytes32 candidate, uint256 prize, uint256 development);
    event Credited(bytes32 indexed pool, uint64 indexed entry, address beneficiary, uint256 amount);
    event Withdrawn(address indexed beneficiary, uint256 amount);
    event DevelopmentFundBound(address indexed canonicalVault, address indexed beneficiary);
    event Invitation(bytes32 indexed pool, bytes32 indexed subject, bool allowed);
    event ConflictRecorded(bytes32 indexed pool, bytes32 indexed subject);

    constructor(
        address disputes_,
        address slates_,
        address scoring_,
        address dev_,
        bytes32 issuer_,
        bytes32 credentialType_
    ) {
        if (
            disputes_.code.length == 0 || slates_.code.length == 0 || scoring_.code.length == 0 || dev_.code.length == 0
                || issuer_ == 0 || credentialType_ == 0
        ) revert InvalidInput();
        if (scoring_.codehash != keccak256(type(FantasyNHLScoring420).runtimeCode)) revert InvalidInput();
        disputes = FantasyDisputeController420(disputes_);
        slateBook = FantasySlateBook420(slates_);
        scoring = FantasyNHLScoring420(scoring_);
        authorization = disputes.authorization();
        asset = disputes.asset();
        DevelopmentCompensationVault420 vault = DevelopmentCompensationVault420(payable(dev_));
        if (address(vault.capabilityRegistry()) != address(authorization.capabilityRegistry())) revert InvalidInput();
        address beneficiary = vault.beneficiary();
        if (beneficiary == address(0) || beneficiary == address(this)) revert InvalidInput();
        devFund = beneficiary;
        emit DevelopmentFundBound(dev_, beneficiary);
        if (
            address(slateBook.authorization()) != address(authorization)
                || address(slateBook.oracle()) != address(disputes.oracle())
        ) revert InvalidInput();
        rankings = new FantasyRankingBook420(address(this));
        admission = new FantasyAdmission420(slates_, address(disputes.identities()), issuer_, credentialType_, address(authorization));
        payoutPolicy = new FantasyPayoutPolicy420(address(this));
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

    function entryOf(bytes32 id, uint64 index) external view returns (Entry memory) {
        return entries[id][index];
    }

    function _cap(bytes32 action, bytes32 id, bool global) private view {
        admission.requireAuthority(msg.sender, action, id, global);
    }

    function registerIdentity(bytes32 subject, bytes32 credential) external nonReentrant {
        admission.registerIdentity(subject, credential);
    }

    function createPool(bytes32 id, Config calldata config, bytes calldata payoutBands) external payable nonReentrant {
        _cap(CREATE, bytes32(0), true);
        admission.requireController(config.launcher, msg.sender);
        FantasySlateBook420.Slate memory s = slateBook.slateOf(config.slate);
        if (
            id == 0 || pools[id].state != State.NONE || s.manifest == 0 || block.timestamp >= s.lockAt
                || s.earlyStart != 0 || config.candidateFeed == 0 || (config.cap != 0 && config.cap < 2)
                || (config.paid ? config.entryFee == 0 || config.freePrize != 0 : config.entryFee != 0)
        ) revert InvalidInput();
        payoutPolicy.register(id, config.cap, payoutBands);
        bytes32 manifest = keccak256(
            abi.encode(
                DOMAIN,
                block.chainid,
                address(this),
                id,
                config,
                payoutBands,
                s.manifest,
                FantasyTypes420.SCORING,
                FantasyTypes420.DATA_POLICY,
                devFund,
                PUBLICATION_WINDOW
            )
        );
        configs[id] = config;
        Pool storage p = pools[id];
        p.state = State.OPEN;
        p.manifest = manifest;
        p.launcherAccount = msg.sender;
        if (!config.paid) {
            p.gross = config.freePrize;
            totalLiability += config.freePrize;
        }
        _receiveExact(config.paid ? 0 : config.freePrize);
        disputes.registerPool(
            id,
            FantasyDisputeController420.Config(
                address(this),
                manifest,
                FantasyTypes420.DATA_POLICY,
                FantasyTypes420.SCORING,
                config.candidateFeed,
                config.entryFee,
                config.freePrize,
                config.paid
            )
        );
        emit PoolCreated(id, config.slate, manifest, config.paid, config.entryFee, config.freePrize);
    }

    function setInvitation(bytes32 id, bytes32 subject, bool allowed) external nonReentrant {
        _cap(INVITE, id, false);
        _open(id);
        if (!configs[id].inviteOnly || subject == 0) revert InvalidInput();
        invited[id][subject] = allowed;
        emit Invitation(id, subject, allowed);
    }

    function recordConflict(bytes32 id, bytes32 subject) external nonReentrant {
        _cap(CONFLICT, id, false);
        if (pools[id].state == State.NONE || subject == 0) revert InvalidInput();
        conflicts[id][subject] = true;
        emit ConflictRecorded(id, subject);
    }

    function _open(bytes32 id) private view {
        FantasySlateBook420.Slate memory s = slateBook.slateOf(configs[id].slate);
        uint64 lock = s.earlyStart == 0 ? s.lockAt : s.earlyStart;
        if (pools[id].state != State.OPEN || block.timestamp >= lock) revert InvalidTime();
    }

    function commitmentOf(bytes32 id, bytes32 subject, uint64 nonce, uint32[7] calldata lineup, bytes32 salt)
        public
        view
        returns (bytes32)
    {
        return keccak256(abi.encode(DOMAIN, block.chainid, address(this), id, subject, nonce, lineup, salt));
    }

    function submissionDigest(bytes32 id, bytes32 subject, bytes32 userKey, Submission calldata sub)
        public
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                DOMAIN,
                block.chainid,
                address(this),
                id,
                pools[id].manifest,
                subject,
                userKey,
                sub.commitment,
                sub.nonce,
                sub.expiry,
                keccak256(sub.envelope)
            )
        );
    }

    function _validateSubmission(bytes32 id, bytes32 subject, bytes32 userKey, Submission calldata sub) private view {
        if (sub.envelope.length == 0 || sub.envelope[0] != 0x01) revert InvalidSignature();
        admission.verifyReceipt(
            configs[id].slate,
            submissionDigest(id, subject, userKey, sub),
            sub.signature,
            sub.expiry,
            sub.envelope.length,
            sub.commitment
        );
    }

    function enterPool(bytes32 id, bytes32 subject, bytes32 credential, Submission calldata sub)
        external
        payable
        nonReentrant
        returns (uint64 index)
    {
        _open(id);
        bytes32 userKey = admission.requireUser(subject, credential, msg.sender, id, configs[id].entryFee);
        Pool storage p = pools[id];
        Config storage c = configs[id];
        if (
            userKey == slateBook.slateOf(c.slate).custodianUserKey || entryForUser[id][userKey] != 0
                || entryForSubject[id][subject] != 0 || sub.nonce != 1 || (c.cap != 0 && p.count >= c.cap)
                || (c.inviteOnly && !invited[id][subject])
        ) revert Unauthorized();
        _validateSubmission(id, subject, userKey, sub);
        index = ++p.count;
        entryForUser[id][userKey] = index;
        entryForSubject[id][subject] = index;
        admission.registerIdentity(subject, credential);
        Entry storage e = entries[id][index];
        e.subject = subject;
        e.userKey = userKey;
        e.beneficiary = msg.sender;
        e.commitment = sub.commitment;
        e.nonce = 1;
        p.lastAcceptedAt = uint64(block.timestamp);
        p.gross += c.entryFee;
        totalLiability += c.entryFee;
        _receiveExact(c.entryFee);
        emit EntryAccepted(id, index, subject, sub.nonce, sub.commitment, sub.envelope);
    }

    function editLineup(bytes32 id, uint64 index, Submission calldata sub) external nonReentrant {
        _open(id);
        Entry storage e = entries[id][index];
        admission.requireEntryActor(e.subject, msg.sender, id);
        if (e.subject == 0 || sub.nonce != e.nonce + 1) revert InvalidInput();
        _validateSubmission(id, e.subject, e.userKey, sub);
        e.commitment = sub.commitment;
        e.nonce = sub.nonce;
        pools[id].lastAcceptedAt = uint64(block.timestamp);
        emit EntryAccepted(id, index, e.subject, sub.nonce, sub.commitment, sub.envelope);
    }

    function lockPool(bytes32 id) external nonReentrant {
        _lockPool(id);
    }

    function _lockPool(bytes32 id) private {
        Pool storage p = pools[id];
        if (p.state != State.OPEN) revert InvalidState();
        FantasySlateBook420.Slate memory s = slateBook.slateOf(configs[id].slate);
        if (block.timestamp < (s.earlyStart == 0 ? s.lockAt : s.earlyStart)) revert InvalidTime();
        if (p.count < 2) {
            _cancel(id, keccak256("MINIMUM_ENTRANTS"));
            return;
        }
        if (s.earlyStart != 0 && p.lastAcceptedAt >= s.earlyStart) {
            _cancel(id, keccak256("EARLY_START"));
            return;
        }
        p.state = State.LOCKED;
        emit PoolLocked(id, p.count);
    }

    function publishLineup(bytes32 id, uint64 index, uint32[7] calldata lineup, bytes32 salt) external nonReentrant {
        Pool storage p = pools[id];
        if (p.state == State.OPEN) _lockPool(id);
        if (p.state != State.LOCKED) revert InvalidState();
        Entry storage e = entries[id][index];
        FantasySlateBook420.Slate memory s = slateBook.slateOf(configs[id].slate);
        uint64 lock = s.earlyStart == 0 ? s.lockAt : s.earlyStart;
        if (block.timestamp > uint256(lock) + PUBLICATION_WINDOW) revert InvalidTime();
        if (e.subject == 0 || e.revealed || commitmentOf(id, e.subject, e.nonce, lineup, salt) != e.commitment) {
            revert InvalidLineup();
        }
        if (!admission.validLineup(configs[id].slate, lineup)) {
            _cancel(id, keccak256("INVALID_VALIDATOR_ATTESTATION"));
            return;
        }
        e.lineup = lineup;
        e.revealed = true;
        p.revealed++;
        emit LineupPublished(id, index, lineup, salt);
    }

    function _cancel(bytes32 id, bytes32 reason) private {
        Pool storage p = pools[id];
        if (p.state == State.NONE || p.state == State.SETTLED || p.state == State.CANCELED) revert InvalidState();
        FantasyDisputeController420.Pool memory dp = disputes.poolOf(id);
        if (dp.state == FantasyDisputeController420.PoolState.FINAL) revert InvalidState();
        if (dp.state != FantasyDisputeController420.PoolState.CANCELED) disputes.cancelByHost(id, reason);
        p.state = State.CANCELED;
        if (!configs[id].paid && p.gross != 0) credit[p.launcherAccount] += p.gross;
        emit PoolCanceled(id, reason);
    }

    function recover(bytes32 id) external nonReentrant {
        Pool storage p = pools[id];
        Config storage c = configs[id];
        FantasySlateBook420.Slate memory s = slateBook.slateOf(c.slate);
        if (p.state == State.OPEN && block.timestamp >= (s.earlyStart == 0 ? s.lockAt : s.earlyStart)) _lockPool(id);
        if (p.state == State.CANCELED) return;
        if (p.state == State.NONE || p.state == State.SETTLED) revert InvalidState();
        if (s.earlyStart != 0 && p.lastAcceptedAt >= s.earlyStart) {
            _cancel(id, keccak256("EARLY_START"));
            return;
        }
        uint64 lock = s.earlyStart == 0 ? s.lockAt : s.earlyStart;
        if (block.timestamp > uint256(lock) + PUBLICATION_WINDOW && p.revealed != p.count) {
            _cancel(id, keccak256("PUBLICATION_FAILURE"));
            return;
        }
        if (s.resolvedAt != 0 && s.eligibleGames == 0) {
            _cancel(id, keccak256("ALL_GAMES_EXCLUDED"));
            return;
        }
        FantasyDisputeController420.Pool memory dp = disputes.poolOf(id);
        if (dp.state == FantasyDisputeController420.PoolState.CANCELED) {
            _cancel(id, keccak256("DISPUTE_CANCELLATION"));
            return;
        }
        if (dp.state == FantasyDisputeController420.PoolState.REVIEW && block.timestamp >= dp.deadline) {
            disputes.expire(id);
            _cancel(id, keccak256("DISPUTE_DEADLINE"));
            return;
        }
        if (
            (s.resolvedAt == 0 && block.timestamp >= uint256(s.cutoff) + 1 days)
                || (s.resolvedAt != 0 && block.timestamp >= uint256(s.resolvedAt) + 1 days && p.publishedRevision == 0)
        ) {
            _cancel(id, keccak256("DATA_OR_CANDIDATE_UNAVAILABLE"));
            return;
        }
        revert InvalidTime();
    }

    function startReview(bytes32 id) external nonReentrant {
        _startReview(id);
    }

    function _startReview(bytes32 id) private {
        Pool storage p = pools[id];
        if (p.state == State.OPEN) _lockPool(id);
        FantasySlateBook420.Slate memory s = slateBook.slateOf(configs[id].slate);
        if (
            p.state != State.LOCKED || p.revealed != p.count || s.resolvedAt == 0 || s.eligibleGames == 0
                || (s.earlyStart != 0 && p.lastAcceptedAt >= s.earlyStart)
        ) revert InvalidState();
        p.state = State.REVIEW;
        // Both products are bounded: 3 * floor(gross / 100) <= 3 * floor(max / 100),
        // and 3 * (gross % 100) <= 297. Their sum is floor(3 * gross / 100)
        // and cannot exceed gross, so these checks cannot reject any uint256 input.
        unchecked {
            p.fee = configs[id].paid ? (p.gross / 100) * 3 + (p.gross % 100) * 3 / 100 : 0;
            p.netPrize = p.gross - p.fee;
        }
        disputes.startCorrection(id, s.resolvedAt);
    }

    function beginRevision(bytes32 id, FantasyTypes420.StatReport calldata report) external nonReentrant {
        Pool storage p = pools[id];
        if (p.state == State.LOCKED) _startReview(id);
        FantasyDisputeController420.Pool memory dp = disputes.poolOf(id);
        if (
            p.state != State.REVIEW || dp.state != FantasyDisputeController420.PoolState.REVIEW
                || report.revision <= p.revision || block.timestamp >= dp.deadline
        ) revert InvalidState();
        if (
            block.timestamp >= dp.correctionEnd
                && (!dp.invalidated || dp.pending != 0 || block.timestamp + 1 days > dp.deadline)
        ) revert InvalidTime();
        slateBook.verifyStats(configs[id].slate, report);
        p.revision = report.revision;
        reports[id][report.revision] = report;
        rankings.initialize(id, report.revision, p.count, p.netPrize, payoutPolicy.weightsFor(id, p.count));
        emit RevisionStarted(id, report.revision, report.root);
    }

    function scoreEntry(bytes32 id, uint64 index, bytes calldata witnesses, uint64 previous, uint64 next)
        external
        nonReentrant
    {
        Pool storage p = pools[id];
        Entry storage e = entries[id][index];
        if (
            p.state != State.REVIEW || p.revision == 0 || !e.revealed
                || disputes.poolOf(id).state != FantasyDisputeController420.PoolState.REVIEW
        ) revert InvalidState();
        int256 score = scoring.calculate(
            address(slateBook), configs[id].slate, p.revision, reports[id][p.revision].root, e.lineup, witnesses
        );
        rankings.insert(id, p.revision, index, score, previous, next);
        emit EntryScored(id, p.revision, index, score);
    }

    function candidateOf(bytes32 id) public view returns (FantasyDisputeController420.Candidate memory) {
        Pool storage p = pools[id];
        FantasyTypes420.StatReport storage r = reports[id][p.revision];
        return
            FantasyDisputeController420.Candidate(
                r.root, rankings.rootOf(id, p.revision), r.evidence, r.asOf, p.revision
            );
    }

    function publishCandidate(bytes32 id) external nonReentrant {
        Pool storage p = pools[id];
        if (p.state != State.REVIEW) revert InvalidState();
        FantasyDisputeController420.Candidate memory candidate = candidateOf(id);
        disputes.publishCandidate(id, candidate);
        p.publishedRevision = p.revision;
        p.publishedCandidate = disputes.candidateDigest(id, candidate);
    }

    function candidateIsCurrent(bytes32 id, bytes32 candidate) public view returns (bool) {
        Pool storage p = pools[id];
        FantasySlateBook420.Slate memory s = slateBook.slateOf(configs[id].slate);
        return p.state == State.REVIEW && p.publishedRevision != 0 && p.revision == p.publishedRevision
            && p.publishedCandidate == candidate && s.resolvedAt != 0 && s.eligibleGames != 0
            && (s.earlyStart == 0 || p.lastAcceptedAt < s.earlyStart);
    }

    function settle(bytes32 id) external nonReentrant {
        Pool storage p = pools[id];
        FantasyDisputeController420.Pool memory dp = disputes.poolOf(id);
        if (dp.state != FantasyDisputeController420.PoolState.FINAL || !candidateIsCurrent(id, dp.candidate)) {
            revert InvalidState();
        }
        p.state = State.SETTLED;
        credit[devFund] += p.fee;
        emit PoolSettled(id, dp.candidate, p.netPrize, p.fee);
    }

    function collect(bytes32 id, uint64 index) external nonReentrant {
        Pool storage p = pools[id];
        Entry storage e = entries[id][index];
        if (e.subject == 0 || e.claimed || (p.state != State.CANCELED && p.state != State.SETTLED)) {
            revert InvalidState();
        }
        e.claimed = true;
        uint256 amount =
            p.state == State.CANCELED ? configs[id].entryFee : rankings.payoutOf(id, p.publishedRevision, index);
        credit[e.beneficiary] += amount;
        emit Credited(id, index, e.beneficiary, amount);
    }

    function isEntrant(bytes32 id, bytes32 subject) external view returns (bool) {
        return entryForSubject[id][subject] != 0;
    }

    function isInterested(bytes32 id, bytes32 subject) external view returns (bool) {
        if (configs[id].launcher == subject || conflicts[id][subject] || entryForSubject[id][subject] != 0) {
            return true;
        }
        bytes32 canonicalKey = admission.currentUserKey(subject);
        if (canonicalKey == 0 || entryForUser[id][canonicalKey] != 0) return true;
        if (admission.controllerOf(subject) == pools[id].launcherAccount) return true;
        bytes32 launcherKey = admission.currentUserKey(configs[id].launcher);
        if (launcherKey != 0 && canonicalKey == launcherKey) return true;
        // Unknown beneficial links still require separately recorded investigation evidence.
        return false;
    }

    function withdrawCredit() external nonReentrant {
        _withdraw(msg.sender);
    }

    /// Permissionless delivery, exclusively to the canonical fixed beneficiary.
    function forwardDevelopment() external nonReentrant {
        _withdraw(devFund);
    }

    function _withdraw(address beneficiary) private {
        uint256 amount = credit[beneficiary];
        if (amount == 0) revert InvalidState();
        credit[beneficiary] = 0;
        totalLiability -= amount;
        _sendExact(beneficiary, amount);
        emit Withdrawn(beneficiary, amount);
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
