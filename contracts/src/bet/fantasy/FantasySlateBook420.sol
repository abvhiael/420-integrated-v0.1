// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../BetAuthorization420.sol";
import "../../interfaces/IOracle420.sol";
import "./FantasyTypes420.sol";

/// @notice Immutable platform slates and canonical, deadline-bound game dispositions.
contract FantasySlateBook420 {
    bytes32 public constant DOMAIN = keccak256("420.FANTASY.SLATE.V1");
    bytes32 public constant PUBLISH = keccak256("BET_FANTASY_PUBLISH_SLATE.V1");
    bytes32 public constant VALIDATE_LINEUP = keccak256("BET_FANTASY_VALIDATE_LINEUP.V1");
    BetAuthorization420 public immutable authorization;
    IOracle420 public immutable oracle;

    struct Slate {
        bytes32 manifest;
        bytes32 feed;
        bytes32 custodianKeyHash;
        bytes32 custodianUserKey;
        address validator;
        uint64 lockAt;
        uint64 cutoff;
        uint64 resolvedAt;
        uint64 earlyStart;
        uint16 gameCount;
        uint16 eligibleGames;
    }
    mapping(bytes32 => Slate) private slates;
    mapping(bytes32 => FantasyTypes420.Game[]) private games;
    mapping(bytes32 => mapping(uint32 => FantasyTypes420.Athlete)) private athletes;
    mapping(bytes32 => mapping(bytes32 => FantasyTypes420.GameResult)) private results;
    mapping(bytes32 => bytes32) public snapshotSeed;
    mapping(bytes32 => bytes32) public rosterHash;
    mapping(bytes32 => uint16) public athleteCount;
    error InvalidInput();
    error InvalidTime();
    error Unauthorized();
    error InvalidEvidence();
    event SlatePublished(bytes32 indexed id, bytes32 manifest, uint64 lockAt, uint64 cutoff, bytes32 custodianKeyHash);
    event AthletePublished(bytes32 indexed slate, uint32 indexed athlete, bytes32 game, uint8 positions);
    event EarlyStart(bytes32 indexed slate, bytes32 game, uint64 actualStart, bytes32 evidence);
    event SlateResolved(bytes32 indexed slate, uint64 resolvedAt, uint16 eligibleGames, bytes32 evidence);

    constructor(address auth, address oracle_) {
        if (auth.code.length == 0 || oracle_.code.length == 0) revert InvalidInput();
        authorization = BetAuthorization420(auth);
        oracle = IOracle420(oracle_);
    }

    function slateOf(bytes32 id) external view returns (Slate memory) {
        return slates[id];
    }

    function athleteOf(bytes32 id, uint32 athlete) external view returns (FantasyTypes420.Athlete memory) {
        return athletes[id][athlete];
    }

    function resultOf(bytes32 id, bytes32 game) external view returns (FantasyTypes420.GameResult memory) {
        return results[id][game];
    }

    function gameAt(bytes32 id, uint256 index) external view returns (FantasyTypes420.Game memory) {
        return games[id][index];
    }

    function publish(
        bytes32 id,
        bytes32 feed,
        bytes32 custodianKeyHash,
        bytes32 custodianUserKey,
        address validator,
        uint64 cutoff,
        FantasyTypes420.Game[] calldata schedule,
        FantasyTypes420.Athlete[] calldata roster
    ) external {
        if (!authorization.isAuthorized(msg.sender, PUBLISH, authorization.scopeForContest(id), 0)) revert Unauthorized();
        if (
            id == bytes32(0) || feed == bytes32(0) || custodianKeyHash == bytes32(0) || custodianUserKey == 0
                || validator == address(0) || snapshotSeed[id] != 0 || schedule.length == 0 || schedule.length > 32
                || roster.length > 64
        ) revert InvalidInput();
        uint64 first = type(uint64).max;
        uint64 last = 0;
        for (uint256 i; i < schedule.length; i++) {
            if (schedule[i].id == 0 || schedule[i].scheduled <= block.timestamp) revert InvalidTime();
            for (uint256 j; j < i; j++) {
                if (schedule[i].id == schedule[j].id) revert InvalidInput();
            }
            if (schedule[i].scheduled < first) first = schedule[i].scheduled;
            if (schedule[i].scheduled > last) last = schedule[i].scheduled;
            games[id].push(schedule[i]);
        }
        // IANA timezone conversion is performed by the audited publisher; exact UTC is immutable.
        if (last - first > 1 days || cutoff <= last || cutoff - last < 23 hours || cutoff - last > 49 hours) {
            revert InvalidTime();
        }
        bytes32 seed = keccak256(
            abi.encode(
                DOMAIN,
                block.chainid,
                address(this),
                id,
                feed,
                custodianKeyHash,
                custodianUserKey,
                validator,
                cutoff,
                schedule,
                FantasyTypes420.DATA_POLICY,
                FantasyTypes420.SCORING
            )
        );
        snapshotSeed[id] = seed;
        slates[id] = Slate(
            bytes32(0),
            feed,
            custodianKeyHash,
            custodianUserKey,
            validator,
            first,
            cutoff,
            0,
            0,
            uint16(schedule.length),
            0
        );
        _appendRoster(id, roster);
    }

    function _appendRoster(bytes32 id, FantasyTypes420.Athlete[] calldata roster) private {
        if (roster.length > 64 || uint256(athleteCount[id]) + roster.length > 2048) revert InvalidInput();
        for (uint256 i; i < roster.length; i++) {
            FantasyTypes420.Athlete calldata a = roster[i];
            if (
                a.id == 0 || a.positions == 0 || a.positions > 31 || ((a.positions & 16) != 0 && a.positions != 16)
                    || athletes[id][a.id].id != 0
            ) revert InvalidInput();
            bool found = false;
            for (uint256 j; j < games[id].length; j++) {
                if (a.game == games[id][j].id) found = true;
            }
            if (!found) revert InvalidInput();
            athletes[id][a.id] = a;
            rosterHash[id] = keccak256(abi.encode(rosterHash[id], a));
            emit AthletePublished(id, a.id, a.game, a.positions);
        }
        athleteCount[id] += uint16(roster.length);
    }

    function appendRoster(bytes32 id, FantasyTypes420.Athlete[] calldata roster) external {
        if (!authorization.isAuthorized(msg.sender, PUBLISH, authorization.scopeForContest(id), 0)) revert Unauthorized();
        if (
            snapshotSeed[id] == 0 || slates[id].manifest != 0 || block.timestamp >= slates[id].lockAt
                || roster.length == 0
        ) {
            revert InvalidInput();
        }
        _appendRoster(id, roster);
    }

    function sealSlate(bytes32 id) external {
        if (!authorization.isAuthorized(msg.sender, PUBLISH, authorization.scopeForContest(id), 0)) revert Unauthorized();
        Slate storage s = slates[id];
        if (snapshotSeed[id] == 0 || s.manifest != 0 || athleteCount[id] < 7 || block.timestamp >= s.lockAt) revert InvalidInput();
        s.manifest = keccak256(abi.encode(snapshotSeed[id], rosterHash[id], athleteCount[id]));
        emit SlatePublished(id, s.manifest, s.lockAt, s.cutoff, s.custodianKeyHash);
    }

    function earlyDigest(bytes32 id, bytes32 game, uint64 start, bytes32 evidence) public view returns (bytes32) {
        return keccak256(
            abi.encode(DOMAIN, block.chainid, address(this), id, slates[id].manifest, "EARLY", game, start, evidence)
        );
    }

    function _read(bytes32 id, bytes32 digest, uint64 earliest) private view {
        IOracle420.ResultRead memory r = oracle.readResult(slates[id].feed);
        if (r.resultHash != digest || r.agreeingSources == 0 || r.updatedAt < earliest || r.updatedAt > block.timestamp)
        {
            revert InvalidEvidence();
        }
    }

    function reportEarlyStart(bytes32 id, bytes32 game, uint64 start, bytes32 evidence) external {
        Slate storage s = slates[id];
        if (
            s.manifest == 0 || s.resolvedAt != 0 || start == 0 || start >= s.lockAt || start > block.timestamp
                || evidence == 0
        ) revert InvalidInput();
        bool found = false;
        for (uint256 i; i < games[id].length; i++) {
            if (games[id][i].id == game) found = true;
        }
        if (!found) revert InvalidInput();
        _read(id, earlyDigest(id, game, start, evidence), start);
        if (s.earlyStart == 0 || start < s.earlyStart) s.earlyStart = start;
        emit EarlyStart(id, game, start, evidence);
    }

    function resultDigest(bytes32 id, FantasyTypes420.GameResult[] calldata dispositions, bytes32 evidence)
        public
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encode(DOMAIN, block.chainid, address(this), id, slates[id].manifest, "RESULT", dispositions, evidence)
        );
    }

    function resolve(bytes32 id, FantasyTypes420.GameResult[] calldata dispositions, bytes32 evidence) external {
        Slate storage s = slates[id];
        if (s.manifest == 0 || s.resolvedAt != 0 || dispositions.length != s.gameCount || evidence == 0) {
            revert InvalidInput();
        }
        uint64 resolution = 0;
        uint16 eligible = 0;
        for (uint256 i; i < dispositions.length; i++) {
            FantasyTypes420.GameResult calldata r = dispositions[i];
            if (
                r.game != games[id][i].id || !r.timingVerified || r.decidedAt == 0 || r.decidedAt > block.timestamp
                    || r.actualStart > block.timestamp
            ) revert InvalidEvidence();
            if (r.eligible) {
                if (
                    r.actualStart == 0 || r.finalAt <= r.actualStart || r.finalAt >= s.cutoff || r.decidedAt < r.finalAt
                        || r.decidedAt >= s.cutoff || r.definitiveCancellation
                ) revert InvalidEvidence();
                eligible++;
            } else if (r.finalAt != 0 || (r.decidedAt < s.cutoff && !r.definitiveCancellation)) {
                revert InvalidEvidence();
            }
            // An excluded game before cutoff needs authenticated definitive cancellation,
            // represented by decidedAt. Reporters must enforce the frozen evidence policy.
            if (r.decidedAt > resolution) resolution = r.decidedAt;
            if (r.actualStart != 0 && r.actualStart < s.lockAt && (s.earlyStart == 0 || r.actualStart < s.earlyStart)) {
                s.earlyStart = r.actualStart;
            }
            results[id][r.game] = r;
        }
        if (resolution < s.lockAt) revert InvalidTime();
        _read(id, resultDigest(id, dispositions, evidence), resolution);
        s.resolvedAt = resolution;
        s.eligibleGames = eligible;
        emit SlateResolved(id, resolution, eligible, evidence);
    }

    function statDigest(bytes32 id, FantasyTypes420.StatReport calldata report) public view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN, block.chainid, address(this), id, slates[id].manifest, "STATS", report));
    }

    function verifyStats(bytes32 id, FantasyTypes420.StatReport calldata report) external view {
        Slate storage s = slates[id];
        if (
            s.resolvedAt == 0 || report.root == 0 || report.evidence == 0 || report.revision == 0
                || report.asOf < s.resolvedAt || report.asOf > block.timestamp || report.asOf > s.resolvedAt + 1 days
        ) revert InvalidEvidence();
        _read(id, statDigest(id, report), report.asOf);
    }
}
