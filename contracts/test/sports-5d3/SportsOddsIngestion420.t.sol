// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../sports-5d2/SportsRegistry420.t.sol";
import "../../src/bet/sports/SportsOddsIngestion420.sol";

interface OddsVm {
    function addr(uint256 key) external returns (address);
    function sign(uint256 key, bytes32 digest) external returns (uint8, bytes32, bytes32);
}

contract SportsOddsIngestion420Test is SportsRegistry420Test {
    SportsOddsIngestion420 odds;
    OddsVm constant signerVm = OddsVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 constant KEY = 0x123456;
    address signer;

    function setUp() public override {
        super.setUp();
        odds = new SportsOddsIngestion420(address(auth), address(markets));
        signer = signerVm.addr(KEY);
        _grant(signer, odds.SIGN(), odds.scope(market));
        _grant(CONTROL, odds.INVALIDATE(), odds.scope(market));
    }

    function _quote(uint64 seq) internal view returns (SportsOddsIngestion420.Odds memory q) {
        SportsMarketRegistry420.Record memory m = markets.get(market);
        uint32[] memory prices = new uint32[](2);
        prices[0] = 1_850_000;
        prices[1] = 2_050_000;
        SportsCompetitionRegistry420.Record memory c = comps.get(comp);
        q = SportsOddsIngestion420.Odds(
            market, m.termsHash, m.quoteEpoch, seq, uint64(block.timestamp),
            uint64(block.timestamp + 60),
            keccak256(abi.encode(c.config.provider, c.config.feed, c.config.sourcePolicy)),
            keccak256(abi.encode("observation", seq)), prices
        );
    }

    function _sig(SportsOddsIngestion420.Odds memory q) internal returns (bytes memory) {
        // calldata-only digest is evaluated through the external contract call.
        bytes32 d = odds.digest(q);
        (uint8 v, bytes32 r, bytes32 s) = signerVm.sign(KEY, d);
        return abi.encodePacked(r, s, v);
    }

    function _submit(SportsOddsIngestion420.Odds memory q) internal {
        odds.ingest(q, _sig(q));
    }

    function _reject(SportsOddsIngestion420.Odds memory q) internal {
        bytes memory signature = _sig(q);
        (bool ok,) = address(odds).call(abi.encodeCall(odds.ingest, (q, signature)));
        require(!ok, "quote unexpectedly accepted");
    }

    function testAcceptedOddsRetainProvenanceAndSequence() public {
        _submit(_quote(1));
        (SportsOddsIngestion420.Latest memory first, bool usable) = odds.current(market);
        require(usable && first.sequence == 1 && first.signer == signer, "valid ingest");
        require(first.prices.length == 2 && first.prices[0] == 1_850_000, "prices");
        _reject(_quote(1)); // replay
        _submit(_quote(2));
        (SportsOddsIngestion420.Latest memory next, bool valid) = odds.current(market);
        require(valid && next.priorDigest == first.digest && next.sequence == 2, "hash chain");
    }

    function testInvalidAmountsAndMissingEvidenceFailClosed() public {
        SportsOddsIngestion420.Odds memory q = _quote(1);
        q.prices[0] = 999_999;
        _reject(q);
        q = _quote(1);
        q.prices[1] = 1_000_000_001;
        _reject(q);
        q = _quote(1);
        q.evidenceDigest = bytes32(0);
        _reject(q);
        q = _quote(1);
        q.sourceDigest = bytes32(uint256(1));
        _reject(q);
        q = _quote(1);
        q.prices = new uint32[](1);
        _reject(q);
    }

    function testExpiredQuoteAndWrongEpochFailClosed() public {
        SportsOddsIngestion420.Odds memory q = _quote(1);
        q.validUntil = uint64(block.timestamp);
        _reject(q);
        q = _quote(1);
        q.quoteEpoch += 1;
        _reject(q);
        _submit(_quote(1));
        _call(CONTROL, address(markets), abi.encodeCall(markets.suspend, (market)));
        (, bool usable) = odds.current(market);
        require(!usable, "suspended quote still usable");
        _observe(true);
        _call(CONTROL, address(markets), abi.encodeCall(markets.resume, (market)));
        (, usable) = odds.current(market);
        require(!usable, "old quote reused after resume");
        _submit(_quote(2));
        (, usable) = odds.current(market);
        require(usable, "fresh quote not usable");
    }

    function testInvalidationAndSignerRevocationGateReadiness() public {
        _submit(_quote(1));
        _call(CONTROL, address(odds), abi.encodeCall(odds.invalidate, (market)));
        (, bool usable) = odds.current(market);
        require(!usable, "invalidated quote");
        _submit(_quote(2));
        (, usable) = odds.current(market);
        require(usable, "new signed quote");
        _halt(BetTypes420.EmergencyDomain.SPORTS_MARKET, market, true);
        (, usable) = odds.current(market);
        require(!usable, "halted quote");
    }

    function testInvalidSignatureCannotBeRelayed() public {
        SportsOddsIngestion420.Odds memory q = _quote(1);
        bytes memory signature = new bytes(65);
        (bool ok,) = address(odds).call(abi.encodeCall(odds.ingest, (q, signature)));
        require(!ok, "forged signature");
    }
}
