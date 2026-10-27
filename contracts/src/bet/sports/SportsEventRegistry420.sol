// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./SportsCompetitionRegistry420.sol";

/// @notice Canonical fixtures, append-only revisions and namespace-bound aliases. No result finality.
contract SportsEventRegistry420 is SportsAuthority420 {
    bytes32 public constant SEASON = keccak256("BET_SPORT_SEASON_REGISTER");
    bytes32 public constant PARTICIPANT = keccak256("BET_SPORT_PARTICIPANT_REGISTER");
    bytes32 public constant REGISTER = keccak256("BET_SPORT_EVENT_REGISTER");
    bytes32 public constant MAPPING = keccak256("BET_SPORT_MAPPING_BIND");
    bytes32 public constant SCHEDULE = keccak256("BET_SPORT_SCHEDULE_REVISE");
    bytes32 public constant STATUS = keccak256("BET_SPORT_EVENT_STATUS");
    bytes32 public constant SOURCE = keccak256("BET_SPORT_SOURCE_OBSERVE");
    SportsCompetitionRegistry420 public immutable competitions;

    struct Season {
        bytes32 competition;
        bytes32 label;
        uint64 from;
        uint64 until;
    }

    struct Stage {
        bytes32 season;
        bytes32 label;
    }

    struct Revision {
        uint64 start;
        bytes32 venue;
        bool neutral;
        bytes32 previous;
        bytes32 evidence;
        uint64 recordedAt;
    }

    struct Record {
        SportsTypes420.EventConfig config;
        bytes32 digest;
        SportsTypes420.EventStatus status;
        uint64 revision;
        bytes32 revisionHash;
        uint64 observation;
        bool healthy;
        bytes32 sourceEvidence;
        address reporter;
        uint64 sourceEpoch;
        uint64 invalidatedAt;
    }
    mapping(bytes32 => Season) public seasons;
    mapping(bytes32 => Stage) public stages;
    mapping(bytes32 => bytes32) public participantMetadata;
    mapping(bytes32 => SportsTypes420.Sport) public participantSport;
    mapping(bytes32 => uint8) public participantCategory;
    mapping(bytes32 => mapping(bytes32 => bool)) public member;
    mapping(bytes32 => Record) private records;
    mapping(bytes32 => mapping(uint64 => Revision)) public revisions;
    mapping(bytes32 => bytes32) public aliases;
    mapping(bytes32 => bytes32) public mappingEvidence;
    mapping(bytes32 => mapping(uint8 => mapping(bytes32 => bool))) public mapped;
    event EventRegistered(bytes32 indexed id, bytes32 indexed competition, bytes32 digest);
    event ScheduleRevised(bytes32 indexed id, uint64 revision, bytes32 digest);
    event EventState(bytes32 indexed id, SportsTypes420.EventStatus status);
    event SourceObserved(bytes32 indexed id, uint64 observation, bool healthy, bytes32 evidence);
    event AliasBound(bytes32 indexed key, bytes32 indexed canonical, bytes32 evidence);
    event CatalogObject(bytes32 indexed id, bytes32 indexed parent, bytes32 kind);

    constructor(address auth, address comps) SportsAuthority420(auth) {
        if (comps.code.length == 0 || address(SportsCompetitionRegistry420(comps).authorization()) != auth) {
            revert Invalid();
        }
        competitions = SportsCompetitionRegistry420(comps);
    }

    function seasonId(bytes32 comp, bytes32 label) public view returns (bytes32) {
        return keccak256(abi.encode("420.SPORT.SEASON.V1", block.chainid, address(this), comp, label));
    }

    function registerSeason(bytes32 comp, bytes32 label, uint64 from, uint64 until) external returns (bytes32 id) {
        _auth(SEASON, comp);
        _catalog(comp);
        if (label == 0 || from == 0 || until <= from) revert Invalid();
        id = seasonId(comp, label);
        if (seasons[id].competition != 0) revert Conflict();
        seasons[id] = Season(comp, label, from, until);
        emit CatalogObject(id, comp, SEASON);
    }

    function stageId(bytes32 season, bytes32 label) public view returns (bytes32) {
        return keccak256(abi.encode("420.SPORT.STAGE.V1", block.chainid, address(this), season, label));
    }

    function registerStage(bytes32 season, bytes32 label) external returns (bytes32 id) {
        bytes32 comp = seasons[season].competition;
        if (comp == 0 || label == 0) revert Invalid();
        _auth(SEASON, comp);
        _catalog(comp);
        id = stageId(season, label);
        if (stages[id].season != 0) revert Conflict();
        stages[id] = Stage(season, label);
        emit CatalogObject(id, season, SEASON);
    }

    function participantId(bytes32 identity) public view returns (bytes32) {
        return keccak256(abi.encode("420.SPORT.PARTICIPANT.V1", block.chainid, address(this), identity));
    }

    function registerParticipant(bytes32 comp, bytes32 identity, bytes32 metadata) external returns (bytes32 id) {
        _auth(PARTICIPANT, comp);
        _catalog(comp);
        if (identity == 0 || metadata == 0) revert Invalid();
        id = participantId(identity);
        if (member[comp][id]) revert Conflict();
        SportsTypes420.Competition catalog = competitions.get(comp).config.catalog;
        SportsTypes420.Sport sport = SportsTypes420.sport(catalog);
        uint8 category = SportsTypes420.category(catalog);
        if (
            participantMetadata[id] != 0
                && (participantMetadata[id] != metadata
                    || participantSport[id] != sport
                    || participantCategory[id] != category)
        ) revert Conflict();
        participantMetadata[id] = metadata;
        member[comp][id] = true;
        participantSport[id] = sport;
        participantCategory[id] = category;
        emit CatalogObject(id, comp, PARTICIPANT);
    }

    function idFor(SportsTypes420.EventConfig memory c) public view returns (bytes32) {
        // Neither start time nor provider ID participates in fixture identity.
        return keccak256(
            abi.encode("420.SPORT.EVENT.V1", block.chainid, address(this), c.season, c.stage, c.home, c.away, c.fixture)
        );
    }

    function register(SportsTypes420.EventConfig calldata c) external returns (bytes32 id) {
        Season memory s = seasons[c.season];
        if (s.competition == 0) revert Invalid();
        _auth(REGISTER, s.competition);
        _catalog(s.competition);
        if (
            stages[c.stage].season != c.season || !member[s.competition][c.home] || !member[s.competition][c.away]
                || c.home == c.away || c.fixture == 0 || c.evidence == 0 || c.venue == 0 || c.start <= block.timestamp
                || c.start < s.from || c.start >= s.until
        ) revert Invalid();
        id = idFor(c);
        if (records[id].revision != 0) revert Conflict();
        Record storage r = records[id];
        r.config = c;
        r.revision = 1;
        r.status = SportsTypes420.EventStatus.SCHEDULED;
        r.digest = keccak256(abi.encode("420.SPORT.EVENT.CONFIG.V1", id, c));
        _revision(id, r, c.start, c.venue, c.neutral, c.evidence);
        emit EventRegistered(id, s.competition, r.digest);
    }

    function aliasKey(bytes32 comp, bytes32 provider, bytes32 feed, uint8 kind, bytes32 externalId)
        public
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encode("420.SPORT.ALIAS.V1", block.chainid, address(this), comp, provider, feed, kind, externalId)
        );
    }

    // kind: 1 competition, 2 season, 3 participant, 4 event. Aliases are immutable.
    function bindAlias(bytes32 comp, uint8 kind, bytes32 externalId, bytes32 canonical, bytes32 evidence) external {
        _auth(MAPPING, comp);
        SportsCompetitionRegistry420.Record memory c = competitions.get(comp);
        _catalog(comp);
        if (externalId == 0 || canonical == 0 || evidence == 0 || kind == 0 || kind > 4) revert Invalid();
        bool valid = kind == 1
            ? canonical == comp
            : kind == 2
                ? seasons[canonical].competition == comp
                : kind == 3 ? member[comp][canonical] : _competition(canonical) == comp;
        if (!valid) revert Invalid();
        bytes32 key = aliasKey(comp, c.config.provider, c.config.feed, kind, externalId);
        if (aliases[key] != 0) {
            if (aliases[key] != canonical || mappingEvidence[key] != evidence) revert Conflict();
            return;
        }
        aliases[key] = canonical;
        mappingEvidence[key] = evidence;
        mapped[comp][kind][canonical] = true;
        emit AliasBound(key, canonical, evidence);
    }

    function reviseSchedule(bytes32 id, uint64 start, bytes32 venue, bool neutral, bytes32 evidence) external {
        Record storage r = _get(id);
        _auth(SCHEDULE, id);
        _catalog(_competition(id));
        if (r.status != SportsTypes420.EventStatus.SCHEDULED && r.status != SportsTypes420.EventStatus.POSTPONED) {
            revert State();
        }
        Season memory s = seasons[r.config.season];
        if (start <= block.timestamp || start < s.from || start >= s.until || venue == 0 || evidence == 0) {
            revert Invalid();
        }
        if (
            start == revisions[id][r.revision].start && venue == revisions[id][r.revision].venue
                && neutral == revisions[id][r.revision].neutral
        ) revert Conflict();
        ++r.revision;
        r.healthy = false;
        r.observation = 0;
        r.invalidatedAt = uint64(block.timestamp);
        _revision(id, r, start, venue, neutral, evidence);
    }

    function setStatus(bytes32 id, SportsTypes420.EventStatus next, bytes32 evidence) external {
        Record storage r = _get(id);
        _auth(STATUS, id);
        if (evidence == 0) revert Invalid();
        SportsTypes420.EventStatus old = r.status;
        bool allowed = old == SportsTypes420.EventStatus.SCHEDULED
            ? next == SportsTypes420.EventStatus.POSTPONED || next == SportsTypes420.EventStatus.STARTED
                || next == SportsTypes420.EventStatus.CANCELLED
            : old == SportsTypes420.EventStatus.POSTPONED
                ? next == SportsTypes420.EventStatus.SCHEDULED || next == SportsTypes420.EventStatus.CANCELLED
                : old == SportsTypes420.EventStatus.STARTED
                    && (next == SportsTypes420.EventStatus.COMPLETED || next == SportsTypes420.EventStatus.ABANDONED);
        if (!allowed) revert State();
        if (next == SportsTypes420.EventStatus.SCHEDULED && revisions[id][r.revision].start <= block.timestamp) {
            revert Invalid();
        }
        r.status = next;
        r.healthy = false;
        r.observation = 0;
        r.invalidatedAt = uint64(block.timestamp);
        ++r.sourceEpoch;
        emit EventState(id, next);
        emit SourceObserved(id, 0, false, evidence);
    }

    function observe(bytes32 id, uint64 revision, uint64 at, bool healthy, bytes32 evidence) external {
        Record storage r = _get(id);
        _auth(SOURCE, id);
        SportsCompetitionRegistry420.Record memory c = competitions.get(_competition(id));
        if (
            revision != r.revision || evidence == 0 || at == 0 || at > block.timestamp || at <= r.observation
                || at < r.invalidatedAt || block.timestamp - at > c.config.maxSourceAge
        ) revert Invalid();
        if (r.status != SportsTypes420.EventStatus.SCHEDULED) revert State();
        if (!healthy) ++r.sourceEpoch;
        r.observation = at;
        r.healthy = healthy;
        r.sourceEvidence = evidence;
        r.reporter = msg.sender;
        emit SourceObserved(id, at, healthy, evidence);
    }

    function ready(bytes32 id) external view returns (bool) {
        Record storage r = _get(id);
        bytes32 comp = _competition(id);
        SportsCompetitionRegistry420.Record memory c = competitions.get(comp);
        return competitions.active(comp) && mapped[comp][1][comp] && mapped[comp][2][r.config.season]
            && mapped[comp][3][r.config.home] && mapped[comp][3][r.config.away] && mapped[comp][4][id]
            && r.status == SportsTypes420.EventStatus.SCHEDULED && r.healthy
            && block.timestamp < revisions[id][r.revision].start && r.observation <= block.timestamp
            && r.observation != 0 && block.timestamp - r.observation <= c.config.maxSourceAge
            && authorization.isAuthorized(r.reporter, SOURCE, scope(id), 0);
    }

    function get(bytes32 id) external view returns (Record memory) {
        return _get(id);
    }

    function currentStart(bytes32 id) external view returns (uint64) {
        Record storage r = _get(id);
        return revisions[id][r.revision].start;
    }

    function competitionOf(bytes32 id) external view returns (bytes32) {
        _get(id);
        return _competition(id);
    }

    function _competition(bytes32 id) private view returns (bytes32) {
        return seasons[records[id].config.season].competition;
    }

    function _get(bytes32 id) private view returns (Record storage r) {
        r = records[id];
        if (r.revision == 0) revert Missing();
    }

    function _catalog(bytes32 id) private view {
        if (competitions.get(id).status == SportsTypes420.CompetitionStatus.RETIRED) revert State();
    }

    function _revision(bytes32 id, Record storage r, uint64 start, bytes32 venue, bool neutral, bytes32 evidence)
        private
    {
        Revision memory v = Revision(start, venue, neutral, r.revisionHash, evidence, uint64(block.timestamp));
        revisions[id][r.revision] = v;
        r.revisionHash = keccak256(abi.encode("420.SPORT.SCHEDULE.V1", id, r.revision, v));
        emit ScheduleRevised(id, r.revision, r.revisionHash);
    }
}
