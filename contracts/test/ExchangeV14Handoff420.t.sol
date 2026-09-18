// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/exchange/ExchangeV14Handoff420.sol";

contract ExchangeV14Handoff420Test {
    ExchangeV14Handoff420 private handoff;

    constructor() {
        handoff = new ExchangeV14Handoff420();
    }

    function testHealthyParityAndFreshnessQualify() public view {
        ExchangeV14Handoff420.ClientEnvelope memory e = _healthy();
        bytes32 id = handoff.validate(e, 1000);
        require(id != bytes32(0), "handoff id");
    }

    function testIndexerLagBeyondSloFailsClosed() public {
        ExchangeV14Handoff420.ClientEnvelope memory e = _healthy();
        e.indexedHead = 996;
        (bool ok,) = address(handoff).staticcall(
            abi.encodeWithSelector(handoff.validate.selector, e, uint64(1000))
        );
        require(!ok, "indexer lag accepted");
    }

    function testSnapshotAndStreamCannotLeadCanonicalHead() public {
        ExchangeV14Handoff420.ClientEnvelope memory e = _healthy();
        e.snapshotHead = 1001;
        (bool snapshotOk,) = address(handoff).staticcall(
            abi.encodeWithSelector(handoff.validate.selector, e, uint64(1000))
        );
        require(!snapshotOk, "snapshot ahead accepted");

        e = _healthy();
        e.streamHead = 1001;
        (bool streamOk,) = address(handoff).staticcall(
            abi.encodeWithSelector(handoff.validate.selector, e, uint64(1000))
        );
        require(!streamOk, "stream ahead accepted");
    }

    function testStreamFreshnessBeyondSloFailsClosed() public {
        ExchangeV14Handoff420.ClientEnvelope memory e = _healthy();
        e.streamEmittedAt = 969;
        (bool ok,) = address(handoff).staticcall(
            abi.encodeWithSelector(handoff.validate.selector, e, uint64(1000))
        );
        require(!ok, "stale stream accepted");
    }

    function testReplacementDrillRequiresDistinctOldAndNewRecords() public view {
        ExchangeV14Handoff420.ClientEnvelope memory e = _healthy();
        e.replacementRequired = true;
        e.affectedRecordId = bytes32(uint256(0xA1));
        e.replacementRecordId = bytes32(uint256(0xB1));
        e.historyRecordId = e.replacementRecordId;

        bytes32 id = handoff.validate(e, 1000);
        require(id != bytes32(0), "replacement drill");
    }

    function testReplacementDrillRejectsMissingOrMismatchedReplacement() public {
        ExchangeV14Handoff420.ClientEnvelope memory e = _healthy();
        e.replacementRequired = true;
        e.affectedRecordId = bytes32(uint256(0xA2));
        e.replacementRecordId = bytes32(uint256(0xB2));

        (bool mismatchOk,) = address(handoff).staticcall(
            abi.encodeWithSelector(handoff.validate.selector, e, uint64(1000))
        );
        require(!mismatchOk, "mismatched history replacement accepted");

        e.historyRecordId = e.replacementRecordId;
        e.replacementRecordId = e.affectedRecordId;
        (bool sameOk,) = address(handoff).staticcall(
            abi.encodeWithSelector(handoff.validate.selector, e, uint64(1000))
        );
        require(!sameOk, "same-id replacement accepted");
    }

    function testNonReplacementEnvelopeCannotSmuggleReplacementRefs() public {
        ExchangeV14Handoff420.ClientEnvelope memory e = _healthy();
        e.affectedRecordId = bytes32(uint256(0xC1));
        (bool ok,) = address(handoff).staticcall(
            abi.encodeWithSelector(handoff.validate.selector, e, uint64(1000))
        );
        require(!ok, "replacement refs accepted without flag");
    }

    function testHandoffIdentityChangesWithCanonicalHead() public view {
        ExchangeV14Handoff420.ClientEnvelope memory a = _healthy();
        ExchangeV14Handoff420.ClientEnvelope memory b = _healthy();
        b.canonicalHead = 999;
        b.indexedHead = 999;
        b.snapshotHead = 999;
        b.streamHead = 999;
        require(handoff.validate(a, 1000) != handoff.validate(b, 1000), "handoff id drift");
    }

    function _healthy() private pure returns (ExchangeV14Handoff420.ClientEnvelope memory) {
        return ExchangeV14Handoff420.ClientEnvelope({
            marketSubjectId: keccak256("MARKET-A"),
            snapshotId: bytes32(uint256(0x1111)),
            historyRecordId: bytes32(uint256(0x2222)),
            canonicalHead: 1000,
            indexedHead: 999,
            snapshotHead: 999,
            streamHead: 1000,
            snapshotObservedAt: 990,
            streamEmittedAt: 995,
            replacementRequired: false,
            affectedRecordId: bytes32(0),
            replacementRecordId: bytes32(0)
        });
    }
}
