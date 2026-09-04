// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetAuthorization420.sol";
import "./BetIds420.sol";

contract WithdrawalQueue420 is I420System {
    struct WithdrawalRequest {
        bytes32 requestId;
        bytes32 vaultId;
        address beneficiary;
        uint256 amount;
        uint64 requestedAt;
        uint64 claimableAt;
        bool claimed;
    }

    BetAuthorization420 public immutable authorization;
    uint256 public nonce;
    mapping(bytes32 => WithdrawalRequest) private _requests;

    error ZeroAddress();
    error InvalidId();
    error InvalidAmount();
    error InvalidBeneficiary();
    error Unauthorized();
    error NotFound();
    error NotClaimable();
    error AlreadyClaimed();

    event WithdrawalRequested(
        bytes32 indexed requestId,
        bytes32 indexed vaultId,
        address indexed beneficiary,
        uint256 amount,
        uint64 claimableAt
    );
    event WithdrawalClaimed(bytes32 indexed requestId, bytes32 indexed vaultId, address indexed beneficiary, uint256 amount);

    constructor(address authorization_) {
        if (authorization_ == address(0)) revert ZeroAddress();
        authorization = BetAuthorization420(authorization_);
    }

    function systemName() external pure returns (string memory) { return "WithdrawalQueue420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function enqueue(bytes32 vaultId, address beneficiary, uint256 amount, uint64 claimableAt)
        external returns (bytes32 requestId)
    {
        if (vaultId == bytes32(0)) revert InvalidId();
        if (beneficiary == address(0)) revert InvalidBeneficiary();
        if (amount == 0) revert InvalidAmount();
        _requireAuth(vaultId, BetIds420.ACTION_VAULT_QUEUE_WITHDRAWAL, amount);
        uint64 nowTs = uint64(block.timestamp);
        if (claimableAt < nowTs) claimableAt = nowTs;
        uint256 next = ++nonce;
        requestId = keccak256(abi.encode(address(this), vaultId, beneficiary, next));
        _requests[requestId] = WithdrawalRequest(requestId, vaultId, beneficiary, amount, nowTs, claimableAt, false);
        emit WithdrawalRequested(requestId, vaultId, beneficiary, amount, claimableAt);
    }

    function consume(bytes32 requestId, address claimant) external returns (uint256 amount) {
        WithdrawalRequest storage r = _get(requestId);
        if (r.claimed) revert AlreadyClaimed();
        if (claimant != r.beneficiary || block.timestamp < r.claimableAt) revert NotClaimable();
        _requireAuth(r.vaultId, BetIds420.ACTION_VAULT_CLAIM_WITHDRAWAL, r.amount);
        r.claimed = true;
        amount = r.amount;
        emit WithdrawalClaimed(requestId, r.vaultId, claimant, amount);
    }

    function getRequest(bytes32 requestId) external view returns (WithdrawalRequest memory) { return _get(requestId); }

    function _get(bytes32 requestId) private view returns (WithdrawalRequest storage r) {
        r = _requests[requestId];
        if (r.requestId == bytes32(0)) revert NotFound();
    }

    function _requireAuth(bytes32 vaultId, bytes32 action, uint256 amount) private view {
        if (!authorization.isAuthorized(msg.sender, action, authorization.scopeForVault(vaultId), amount)) revert Unauthorized();
    }
}
