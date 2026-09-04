// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/CannaseurCampaignRegistry.sol";
import "./AttentionConsentRegistry420.sol";

contract AttentionProofRegistry420 is I420System {
    struct ProofRecord {
        bytes32 campaignId;
        address account;
        address verifier;
        uint64 observedAt;
        uint64 attentionUnits;
        bytes32 evidenceHash;
        bool exists;
    }

    CannaseurCampaignRegistry public immutable campaigns;
    AttentionConsentRegistry420 public immutable consent;
    mapping(bytes32 => ProofRecord) private _proofs;
    mapping(bytes32 => bool) public nullifierUsed;

    error InvalidInput();
    error UnauthorizedVerifier();
    error ConsentRequired();
    error CampaignNotAcceptingProofs();
    error Replay();

    event AttentionProofCommitted(bytes32 indexed proofId, bytes32 indexed campaignId, address indexed account, uint64 attentionUnits, bytes32 evidenceHash);

    constructor(address campaigns_, address consent_) {
        if (campaigns_ == address(0) || consent_ == address(0)) revert InvalidInput();
        campaigns = CannaseurCampaignRegistry(campaigns_);
        consent = AttentionConsentRegistry420(consent_);
    }

    function systemName() external pure returns (string memory) { return "AttentionProofRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function commitProof(
        bytes32 campaignId,
        address account,
        uint64 observedAt,
        uint64 attentionUnits,
        bytes32 evidenceHash,
        bytes32 nullifier
    ) external returns (bytes32 proofId) {
        if (campaignId == bytes32(0) || account == address(0) || attentionUnits == 0 || evidenceHash == bytes32(0) || nullifier == bytes32(0)) revert InvalidInput();
        CannaseurCampaignRegistry.Campaign memory c = campaigns.campaign(campaignId);
        if (msg.sender != c.verifier) revert UnauthorizedVerifier();
        if (!consent.isOptedIn(account, campaignId)) revert ConsentRequired();
        if (!campaigns.acceptsProof(campaignId, observedAt)) revert CampaignNotAcceptingProofs();
        if (nullifierUsed[nullifier]) revert Replay();
        nullifierUsed[nullifier] = true;
        proofId = keccak256(abi.encode("420/ATTENTION/PROOF/V1", block.chainid, campaignId, account, observedAt, attentionUnits, evidenceHash, nullifier));
        if (_proofs[proofId].exists) revert Replay();
        _proofs[proofId] = ProofRecord(campaignId, account, msg.sender, observedAt, attentionUnits, evidenceHash, true);
        emit AttentionProofCommitted(proofId, campaignId, account, attentionUnits, evidenceHash);
    }

    function proof(bytes32 proofId) external view returns (ProofRecord memory) { return _proofs[proofId]; }
}
