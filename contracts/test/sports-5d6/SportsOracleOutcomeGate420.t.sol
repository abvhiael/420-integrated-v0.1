// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../sports-5d4/SportsFundedTickets420.t.sol";
import "../../src/bet/sports/SportsOracleOutcomeGate420.sol";

contract SportsResultOracleFixture420 is IOracle420 {
    ResultRead private report;
    bytes32 private expectedFeed;
    bool public halted;
    function configure(bytes32 feed, bytes32 hash, uint64 at, uint16 count, uint16 confidence) external {
        expectedFeed = feed;
        report = ResultRead(hash, at, count, confidence);
    }
    function halt(bool v) external { halted = v; }
    function readResult(bytes32 feed) external view returns (ResultRead memory) {
        require(!halted && feed == expectedFeed, "feed unavailable");
        return report;
    }
    function readNumeric(bytes32) external pure returns (NumericRead memory) { revert("wrong mode"); }
}

contract SportsOracleOutcomeGate420Test is SportsFundedTickets420Test {
    SportsResultOracleFixture420 oracle;
    SportsOracleOutcomeGate420 gate;

    function setUp() public override {
        super.setUp();
        oracle = new SportsResultOracleFixture420();
        gate = new SportsOracleOutcomeGate420(address(oracle), address(vault), 2 hours, 9000, 2);
        _grant(address(gate), vault.RESOLVE(), vault.scope(market));
    }

    function _ticket() internal returns (bytes32 id) {
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        id = _fund(500);
        vm.warp(markets.get(market).config.cutoff + 1);
        _certifyWinner();
    }

    function _feed(uint64 at, uint16 count, uint16 confidence, bytes32 hash) internal {
        oracle.configure(gate.feedFor(market), hash, at, count, confidence);
    }

    function _verified() internal {
        SportsOutcomeCertification420.Result memory result_ = cert.result(market);
        _feed(uint64(block.timestamp), 2, 9500,
            gate.commitment(market, result_.selection, result_.evidence));
    }

    function testVerifiedOracleResultPermitsSingleAuthorizedSettlement() public {
        bytes32 id = _ticket();
        _verified();
        gate.settle(id, true);
        require(vault.credit(PLAYER, address(token)) == 925, "verified payout");
        (bool ok,) = address(gate).call(abi.encodeCall(gate.settle, (id, true)));
        require(!ok, "double settlement");
    }

    function testRejectsMissingOracleQuorum() public {
        bytes32 id = _ticket();
        SportsOutcomeCertification420.Result memory r = cert.result(market);
        _feed(uint64(block.timestamp), 1, 9500, gate.commitment(market, r.selection, r.evidence));
        (bool ok,) = address(gate).call(abi.encodeCall(gate.settle, (id, true)));
        require(!ok, "unverified single source");
    }

    function testRejectsStaleOracleReport() public {
        bytes32 id = _ticket();
        _verified();
        vm.warp(block.timestamp + 2 hours + 1);
        (bool ok,) = address(gate).call(abi.encodeCall(gate.settle, (id, true)));
        require(!ok, "stale oracle accepted");
    }

    function testRejectsLowConfidenceOracleReport() public {
        bytes32 id = _ticket();
        SportsOutcomeCertification420.Result memory r = cert.result(market);
        _feed(uint64(block.timestamp), 2, 8999, gate.commitment(market, r.selection, r.evidence));
        (bool ok,) = address(gate).call(abi.encodeCall(gate.settle, (id, true)));
        require(!ok, "low confidence accepted");
    }

    function testRejectsCrossMarketOrSubstitutedResultCommitment() public {
        bytes32 id = _ticket();
        SportsOutcomeCertification420.Result memory r = cert.result(market);
        _feed(uint64(block.timestamp), 2, 9500, gate.commitment(bytes32(uint256(123)), r.selection, r.evidence));
        (bool ok,) = address(gate).call(abi.encodeCall(gate.settle, (id, true)));
        require(!ok, "cross market replay accepted");
    }

    function testRejectsHaltedOracle() public {
        bytes32 id = _ticket();
        _verified();
        oracle.halt(true);
        (bool ok,) = address(gate).call(abi.encodeCall(gate.settle, (id, true)));
        require(!ok, "halted feed settled");
    }

    function testRejectsIncorrectFeedIdentifier() public {
        bytes32 id = _ticket();
        oracle.configure(bytes32(uint256(1)), bytes32(uint256(2)), uint64(block.timestamp), 2, 9500);
        (bool ok,) = address(gate).call(abi.encodeCall(gate.settle, (id, true)));
        require(!ok, "wrong feed settled");
    }

    function testConstructorEnforcesRealOracleAndQuorum() public {
        (bool ok,) = address(this).call(abi.encodeWithSelector(SportsOracleOutcomeGate420Test._badOracle.selector));
        require(!ok, "EOA oracle allowed");
    }
    function _badOracle() external {
        new SportsOracleOutcomeGate420(address(0x1234), address(vault), 1 hours, 9000, 2);
    }
}
