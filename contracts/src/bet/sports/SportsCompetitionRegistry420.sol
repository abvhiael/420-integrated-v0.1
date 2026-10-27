// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./SportsAuthority420.sol";
import "./SportsTypes420.sol";

/// @notice Immutable, explicitly approved competition/source configurations. No wagering or custody.
contract SportsCompetitionRegistry420 is SportsAuthority420 {
    bytes32 public constant REGISTER = keccak256("BET_SPORT_COMPETITION_REGISTER");
    bytes32 public constant APPROVE = keccak256("BET_SPORT_COMPETITION_APPROVE");
    bytes32 public constant SUSPEND = keccak256("BET_SPORT_COMPETITION_SUSPEND");
    bytes32 public constant RESUME = keccak256("BET_SPORT_COMPETITION_RESUME");
    bytes32 public constant RETIRE = keccak256("BET_SPORT_COMPETITION_RETIRE");

    struct Record {
        SportsTypes420.CompetitionConfig config;
        bytes32 digest;
        address registrar;
        address approver;
        SportsTypes420.CompetitionStatus status;
        uint64 epoch;
    }
    mapping(bytes32 => Record) private records;
    event CompetitionRegistered(bytes32 indexed id, bytes32 digest, SportsTypes420.Competition catalog);
    event CompetitionState(bytes32 indexed id, SportsTypes420.CompetitionStatus status, uint64 epoch);
    constructor(address auth) SportsAuthority420(auth) {}

    function idFor(SportsTypes420.Competition catalog) public view returns (bytes32) {
        if (SportsTypes420.sport(catalog) == SportsTypes420.Sport.NONE) revert Invalid();
        return keccak256(abi.encode("420.BET.SPORTS.COMPETITION.V1", block.chainid, address(this), catalog));
    }

    function register(SportsTypes420.CompetitionConfig calldata c) external returns (bytes32 id) {
        id = idFor(c.catalog);
        _auth(REGISTER, id);
        if (records[id].status != SportsTypes420.CompetitionStatus.NONE) revert Conflict();
        if (
            c.sourcePolicy == 0 || c.provider == 0 || c.feed == 0 || c.manifest == 0 || c.maxSourceAge == 0
                || c.maxSourceAge > 1 days
        ) revert Invalid();
        bytes32 digest = keccak256(abi.encode("420.BET.SPORTS.COMPETITION.CONFIG.V1", id, c));
        records[id] = Record(c, digest, msg.sender, address(0), SportsTypes420.CompetitionStatus.REGISTERED, 1);
        emit CompetitionRegistered(id, digest, c.catalog);
    }

    function approve(bytes32 id, bytes32 digest) external {
        Record storage r = _get(id);
        _auth(APPROVE, id);
        if (r.status != SportsTypes420.CompetitionStatus.REGISTERED || r.digest != digest) revert State();
        if (r.registrar == msg.sender) revert Separation();
        r.approver = msg.sender;
        r.status = SportsTypes420.CompetitionStatus.APPROVED;
        emit CompetitionState(id, r.status, r.epoch);
    }

    function suspend(bytes32 id) external {
        Record storage r = _get(id);
        _auth(SUSPEND, id);
        if (r.status != SportsTypes420.CompetitionStatus.APPROVED) revert State();
        r.status = SportsTypes420.CompetitionStatus.SUSPENDED;
        ++r.epoch;
        emit CompetitionState(id, r.status, r.epoch);
    }

    function resume(bytes32 id) external {
        Record storage r = _get(id);
        _auth(RESUME, id);
        if (r.status != SportsTypes420.CompetitionStatus.SUSPENDED) revert State();
        r.status = SportsTypes420.CompetitionStatus.APPROVED;
        emit CompetitionState(id, r.status, r.epoch);
    }

    function retire(bytes32 id) external {
        Record storage r = _get(id);
        _auth(RETIRE, id);
        if (r.status == SportsTypes420.CompetitionStatus.RETIRED) revert State();
        r.status = SportsTypes420.CompetitionStatus.RETIRED;
        ++r.epoch;
        emit CompetitionState(id, r.status, r.epoch);
    }

    function get(bytes32 id) external view returns (Record memory) {
        return _get(id);
    }

    function active(bytes32 id) external view returns (bool) {
        Record storage r = _get(id);
        return r.status == SportsTypes420.CompetitionStatus.APPROVED
            && authorization.isAuthorized(r.approver, APPROVE, scope(id), 0);
    }

    function _get(bytes32 id) private view returns (Record storage r) {
        r = records[id];
        if (r.status == SportsTypes420.CompetitionStatus.NONE) revert Missing();
    }
}
