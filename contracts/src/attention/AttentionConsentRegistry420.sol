// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./AttentionAuthorization420.sol";
import "./AttentionIds420.sol";

contract AttentionConsentRegistry420 is I420System {
    struct Consent {
        bool enabled;
        uint64 revision;
        bytes32 policyHash;
    }

    AttentionAuthorization420 public immutable authorization;
    mapping(address => Consent) private _global;
    mapping(address => mapping(bytes32 => Consent)) private _campaign;

    error Unauthorized();
    error InvalidInput();

    event GlobalConsentSet(address indexed account, bool enabled, uint64 revision, bytes32 policyHash);
    event CampaignConsentSet(address indexed account, bytes32 indexed campaignId, bool enabled, uint64 revision, bytes32 policyHash);

    constructor(address authorization_) {
        if (authorization_ == address(0)) revert InvalidInput();
        authorization = AttentionAuthorization420(authorization_);
    }

    function systemName() external pure returns (string memory) { return "AttentionConsentRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function setGlobal(address account, bool enabled, bytes32 policyHash) external {
        if (account == address(0) || policyHash == bytes32(0)) revert InvalidInput();
        if (msg.sender != account && !authorization.isAuthorized(msg.sender, account, AttentionIds420.ACTION_MANAGE_CONSENT)) revert Unauthorized();
        Consent storage c = _global[account];
        c.enabled = enabled;
        c.revision += 1;
        c.policyHash = policyHash;
        emit GlobalConsentSet(account, enabled, c.revision, policyHash);
    }

    function setCampaign(address account, bytes32 campaignId, bool enabled, bytes32 policyHash) external {
        if (account == address(0) || campaignId == bytes32(0) || policyHash == bytes32(0)) revert InvalidInput();
        if (msg.sender != account && !authorization.isAuthorized(msg.sender, account, AttentionIds420.ACTION_MANAGE_CONSENT)) revert Unauthorized();
        Consent storage c = _campaign[account][campaignId];
        c.enabled = enabled;
        c.revision += 1;
        c.policyHash = policyHash;
        emit CampaignConsentSet(account, campaignId, enabled, c.revision, policyHash);
    }

    function globalConsent(address account) external view returns (Consent memory) { return _global[account]; }
    function campaignConsent(address account, bytes32 campaignId) external view returns (Consent memory) { return _campaign[account][campaignId]; }

    function isOptedIn(address account, bytes32 campaignId) external view returns (bool) {
        Consent storage specific = _campaign[account][campaignId];
        if (specific.revision != 0) return specific.enabled;
        return _global[account].enabled;
    }
}
