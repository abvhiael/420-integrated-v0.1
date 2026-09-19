// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ComputeAuthorization420.sol";
import "./ComputeIds420.sol";
import "./ComputeJobRegistry420.sol";
import "./ComputeMatch420.sol";
import "./ComputeProviderRegistry420.sol";
import "./ComputeRequestRegistry420.sol";

contract ComputeSettlement420 is I420System {
    enum State { NONE, CLAIMABLE, REFUNDABLE, CLOSED }

    struct Settlement {
        bytes32 jobId;
        address payer;
        address beneficiary;
        bytes32 fundingRef;
        uint256 fundedAmount;
        uint256 earnedAmount;
        uint256 refundableAmount;
        bytes32 outcomeRef;
        State state;
        bool exists;
    }

    ComputeAuthorization420 public immutable authorization;
    ComputeJobRegistry420 public immutable jobs;
    ComputeMatch420 public immutable matches;
    ComputeProviderRegistry420 public immutable providers;
    ComputeRequestRegistry420 public immutable requests;
    mapping(bytes32 => Settlement) private _settlements;

    error InvalidSettlement();
    error SettlementExists();
    error Unauthorized();
    error InvalidState();

    event SettlementPrepared(
        bytes32 indexed settlementId,
        bytes32 indexed jobId,
        address indexed beneficiary,
        uint256 earnedAmount,
        uint256 refundableAmount
    );
    event SettlementClosed(bytes32 indexed settlementId, bool providerPaid);

    constructor(
        address authorization_,
        address jobs_,
        address matches_,
        address providers_,
        address requests_
    ) {
        if (
            authorization_ == address(0) || jobs_ == address(0) || matches_ == address(0)
                || providers_ == address(0) || requests_ == address(0)
        ) revert InvalidSettlement();
        authorization = ComputeAuthorization420(authorization_);
        jobs = ComputeJobRegistry420(jobs_);
        matches = ComputeMatch420(matches_);
        providers = ComputeProviderRegistry420(providers_);
        requests = ComputeRequestRegistry420(requests_);
    }

    function systemName() external pure returns (string memory) { return "ComputeSettlement420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function canonicalSettlementId(bytes32 jobId) public view returns (bytes32) {
        return keccak256(abi.encode("420/COMPUTE/SETTLEMENT/V1", block.chainid, address(this), jobId));
    }

    function prepare(bytes32 jobId, uint256 earnedAmount, bytes32 outcomeRef)
        external
        returns (bytes32 settlementId)
    {
        ComputeJobRegistry420.Job memory j = jobs.getJob(jobId);
        if (j.state != ComputeJobRegistry420.State.VERIFIED || outcomeRef == bytes32(0)) revert InvalidSettlement();
        ComputeMatch420.MatchRecord memory m = matches.getMatch(j.matchId);
        ComputeRequestRegistry420.Request memory r = requests.getRequest(j.requestId);
        if (earnedAmount > m.quotedAmount420 || earnedAmount > r.fundedAmount) revert InvalidSettlement();
        if (!authorization.isJobAuthorized(msg.sender, jobId, ComputeIds420.ACTION_SETTLE, earnedAmount)) {
            revert Unauthorized();
        }

        settlementId = canonicalSettlementId(jobId);
        if (_settlements[settlementId].exists) revert SettlementExists();
        ComputeProviderRegistry420.Provider memory p = providers.getProvider(j.providerId);

        _settlements[settlementId] = Settlement({
            jobId: jobId,
            payer: r.requester,
            beneficiary: p.settlementAccount,
            fundingRef: r.fundingRef,
            fundedAmount: r.fundedAmount,
            earnedAmount: earnedAmount,
            refundableAmount: r.fundedAmount - earnedAmount,
            outcomeRef: outcomeRef,
            state: State.CLAIMABLE,
            exists: true
        });
        emit SettlementPrepared(
            settlementId, jobId, p.settlementAccount, earnedAmount, r.fundedAmount - earnedAmount
        );
    }

    function closeProviderSettlement(bytes32 settlementId) external {
        Settlement storage s = _get(settlementId);
        if (s.state != State.CLAIMABLE) revert InvalidState();
        if (!authorization.isJobAuthorized(msg.sender, s.jobId, ComputeIds420.ACTION_SETTLE, s.earnedAmount)) {
            revert Unauthorized();
        }
        s.state = State.CLOSED;
        jobs.markSettled(s.jobId, s.earnedAmount);
        emit SettlementClosed(settlementId, true);
    }

    function markRefundable(bytes32 settlementId) external {
        Settlement storage s = _get(settlementId);
        if (!authorization.isJobAuthorized(msg.sender, s.jobId, ComputeIds420.ACTION_SETTLE, 0)) revert Unauthorized();
        if (s.state != State.CLAIMABLE) revert InvalidState();
        s.state = State.REFUNDABLE;
    }

    function closeRefund(bytes32 settlementId) external {
        Settlement storage s = _get(settlementId);
        if (s.state != State.REFUNDABLE) revert InvalidState();
        if (!authorization.isJobAuthorized(msg.sender, s.jobId, ComputeIds420.ACTION_SETTLE, 0)) revert Unauthorized();
        s.state = State.CLOSED;
        jobs.markRefunded(s.jobId);
        emit SettlementClosed(settlementId, false);
    }

    function getSettlement(bytes32 settlementId) external view returns (Settlement memory) {
        return _get(settlementId);
    }

    function _get(bytes32 settlementId) private view returns (Settlement storage s) {
        s = _settlements[settlementId];
        if (!s.exists) revert InvalidSettlement();
    }
}
