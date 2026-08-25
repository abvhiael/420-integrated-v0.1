// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/GenesisResidentAccess420.sol";
import "../interfaces/genesis/Types420.sol";
import "../interfaces/genesis/ISystemSafety420.sol";
import "./PayIds420.sol";

contract MerchantRegistry420 is GenesisResidentAccess420 {
    enum Status { UNVERIFIED, REGISTERED, CREDENTIALED, REGULATED }

    struct Merchant {
        address controller;
        bytes32 profileId;
        bytes32 metadataHash;
        Status status;
        bool active;
        uint32 payoutVersion;
    }

    struct PayoutProfile {
        address primary;
        uint64 activatesAt;
        bytes32 planHash;
        bool active;
    }

    mapping(bytes32 => Merchant) public merchants;
    mapping(bytes32 => mapping(uint32 => PayoutProfile)) public payoutProfiles;

    event MerchantSet(bytes32 indexed merchantId, address indexed controller, Status status, bool active);
    event PayoutProfileScheduled(
        bytes32 indexed merchantId,
        uint32 indexed version,
        address primary,
        uint64 activatesAt,
        bytes32 planHash
    );

    constructor(address timelock_, address registry_, bytes32 genesisConfigHash_)
        GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_)
    {}

    function componentId() public pure override returns (bytes32) { return PayIds420.MERCHANT_REGISTRY; }

    function register(bytes32 merchantId, bytes32 profileId, bytes32 metadataHash, address payout) external {
        _requireOperational(
            PayIds420.ACTION_CREATE_INVOICE,
            ISystemSafety420.ActionClass.NORMAL_ONLY,
            Types420.Direction.INBOUND
        );
        require(merchantId != bytes32(0) && merchants[merchantId].controller == address(0), "invalid/exists");
        require(payout != address(0), "payout");
        merchants[merchantId] = Merchant(msg.sender, profileId, metadataHash, Status.REGISTERED, true, 1);
        payoutProfiles[merchantId][1] = PayoutProfile(payout, uint64(block.timestamp), bytes32(0), true);
        emit MerchantSet(merchantId, msg.sender, Status.REGISTERED, true);
        emit PayoutProfileScheduled(merchantId, 1, payout, uint64(block.timestamp), bytes32(0));
    }

    function setStatus(bytes32 merchantId, Status status, bool active) external {
        _requireGenesisGovernance(PayIds420.ACTION_CONFIGURE);
        require(merchants[merchantId].controller != address(0), "unknown");
        merchants[merchantId].status = status;
        merchants[merchantId].active = active;
        emit MerchantSet(merchantId, merchants[merchantId].controller, status, active);
    }

    function schedulePayout(bytes32 merchantId, address primary, bytes32 planHash, uint64 activatesAt) external {
        _requireOperational(
            PayIds420.ACTION_CONFIGURE,
            ISystemSafety420.ActionClass.NORMAL_ONLY,
            Types420.Direction.OUTBOUND
        );
        Merchant storage m = merchants[merchantId];
        require(m.controller == msg.sender, "controller");
        require(primary != address(0), "payout");
        uint64 minActivation = uint64(block.timestamp);
        if (m.status == Status.CREDENTIALED || m.status == Status.REGULATED) {
            minActivation = uint64(block.timestamp + 1 days);
        }
        require(activatesAt >= minActivation, "activation delay");
        uint32 next = m.payoutVersion + 1;
        payoutProfiles[merchantId][next] = PayoutProfile(primary, activatesAt, planHash, true);
        m.payoutVersion = next;
        emit PayoutProfileScheduled(merchantId, next, primary, activatesAt, planHash);
    }

    function currentPayout(bytes32 merchantId) external view returns (address primary, uint32 version, bytes32 planHash) {
        Merchant memory m = merchants[merchantId];
        require(m.controller != address(0), "unknown");
        for (uint32 v = m.payoutVersion; v >= 1; v--) {
            PayoutProfile memory p = payoutProfiles[merchantId][v];
            if (p.active && p.activatesAt <= block.timestamp) return (p.primary, v, p.planHash);
            if (v == 1) break;
        }
        revert("no active payout");
    }
}
