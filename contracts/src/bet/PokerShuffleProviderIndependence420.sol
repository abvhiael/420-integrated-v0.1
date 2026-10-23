// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Sole-governance approval with independently inspectable provider evidence.
/// @dev Only governance may approve/revoke. Providers prove custody of their distinct
///      submission keys by originating their own bound claims. Outside observers can
///      publish immutable audit references but never gain an approval or veto role.
///      Beneficial-control claims still require off-chain verification by governance.
contract PokerShuffleProviderIndependence420 {
    address public immutable governance;
    bytes32 public constant CLAIM_DOMAIN = keccak256("420.BET.POKER.PROVIDER.CONTROL.CLAIM.V2");
    struct Attestation {
        bytes32 controller;
        bytes32 evidenceHash;
        uint64 validUntil;
        bool revoked;
        bytes32 auditId;
    }
    struct ProviderClaim {
        bytes32 controller;
        bytes32 evidenceHash;
        uint64 validUntil;
        uint64 nonce;
    }
    mapping(address => Attestation) public attestations;
    mapping(address => ProviderClaim) public claims;
    mapping(address => uint64) public nextNonce;
    struct AuditRecord {
        address provider;
        address auditor;
        bytes32 controller;
        bytes32 evidenceHash;
        bytes32 reportHash;
        bytes32 reportLocationHash;
    }
    mapping(bytes32 => AuditRecord) public audits;

    error Unauthorized();
    error InvalidAttestation();
    event ProviderAttested(address indexed provider,bytes32 indexed controller,bytes32 indexed evidenceHash,uint64 validUntil,bytes32 auditId);
    event ProviderRevoked(address indexed provider);
    event ProviderClaimed(address indexed provider,bytes32 indexed controller,bytes32 indexed evidenceHash,uint64 validUntil,uint64 nonce,bytes32 claimDigest);
    event EvidenceAuditRecorded(bytes32 indexed auditId,address indexed provider,address indexed auditor,bytes32 controller,bytes32 reportHash,bytes32 evidenceHash,bytes32 reportLocationHash);

    constructor(address governance_) {
        if(governance_==address(0)) revert InvalidAttestation();
        governance=governance_;
    }
    /// @notice Domain-separated, chain- and contract-bound custody evidence.
    function claimDigest(address provider,bytes32 controller,bytes32 evidenceHash,uint64 validUntil,uint64 nonce)
        public view returns(bytes32) {
        return keccak256(abi.encode(CLAIM_DOMAIN,block.chainid,address(this),provider,controller,evidenceHash,validUntil,nonce));
    }
    /// @notice Provider originates an on-chain claim from its own signing authority.
    ///         No external reviewer receives governance power.
    function claim(bytes32 controller,bytes32 evidenceHash,uint64 validUntil) external {
        if(msg.sender==governance || controller==bytes32(0)||evidenceHash==bytes32(0)
            ||validUntil<=block.timestamp) revert InvalidAttestation();
        uint64 nonce=nextNonce[msg.sender]++;
        claims[msg.sender]=ProviderClaim(controller,evidenceHash,validUntil,nonce);
        emit ProviderClaimed(msg.sender,controller,evidenceHash,validUntil,nonce,
            claimDigest(msg.sender,controller,evidenceHash,validUntil,nonce));
    }
    /// @notice Only the sole governance authority accepts validated operator evidence.
    function attest(address provider,bytes32 controller,bytes32 evidenceHash,uint64 validUntil,bytes32 auditId) external {
        if(msg.sender!=governance) revert Unauthorized();
        if(provider==address(0)||provider==governance||controller==bytes32(0)
            ||evidenceHash==bytes32(0)||validUntil<=block.timestamp) revert InvalidAttestation();
        ProviderClaim memory c=claims[provider];
        if(c.controller!=controller||c.evidenceHash!=evidenceHash||c.validUntil<validUntil
            ||c.validUntil<=block.timestamp) revert InvalidAttestation();
        AuditRecord memory a=audits[auditId];
        if(a.provider!=provider||a.controller!=controller||a.evidenceHash!=evidenceHash
            ||a.auditor==address(0)||a.auditor==governance||a.auditor==provider) revert InvalidAttestation();
        attestations[provider]=Attestation(controller,evidenceHash,validUntil,false,auditId);
        emit ProviderAttested(provider,controller,evidenceHash,validUntil,auditId);
    }
    function revoke(address provider) external {
        if(msg.sender!=governance) revert Unauthorized();
        attestations[provider].revoked=true;
        emit ProviderRevoked(provider);
    }
    /// @notice Independent auditors publish authenticated report commitments.
    ///         Governance selects which valid report to rely on for its approval.
    ///         Report authors receive no ability to approve, reject or revoke.
    function recordAudit(address provider,bytes32 controller,bytes32 reportHash,
        bytes32 evidenceHash,bytes32 reportLocationHash) external returns(bytes32 id) {
        if(provider==address(0)||provider==governance||provider==msg.sender
            ||msg.sender==governance||controller==bytes32(0)||reportHash==bytes32(0)
            ||evidenceHash==bytes32(0)||reportLocationHash==bytes32(0)) revert InvalidAttestation();
        id=keccak256(abi.encode(block.chainid,address(this),provider,msg.sender,
            controller,reportHash,evidenceHash,reportLocationHash));
        if(audits[id].auditor!=address(0)) revert InvalidAttestation();
        audits[id]=AuditRecord(provider,msg.sender,controller,evidenceHash,reportHash,reportLocationHash);
        emit EvidenceAuditRecorded(id,provider,msg.sender,controller,reportHash,evidenceHash,reportLocationHash);
    }
    function independentlyEligible(address a,address b) external view returns(bool) {
        Attestation memory x=attestations[a];
        Attestation memory y=attestations[b];
        ProviderClaim memory cx=claims[a];
        ProviderClaim memory cy=claims[b];
        AuditRecord memory ax=audits[x.auditId];
        AuditRecord memory ay=audits[y.auditId];
        return a!=address(0)&&b!=address(0)&&a!=b&&a!=governance&&b!=governance
            &&x.controller!=bytes32(0)&&y.controller!=bytes32(0)&&x.controller!=y.controller
            &&x.evidenceHash!=bytes32(0)&&y.evidenceHash!=bytes32(0)
            &&ax.provider==a&&ay.provider==b
            &&ax.controller==x.controller&&ay.controller==y.controller
            &&ax.evidenceHash==x.evidenceHash&&ay.evidenceHash==y.evidenceHash
            &&ax.auditor!=address(0)&&ay.auditor!=address(0)
            &&ax.auditor!=governance&&ay.auditor!=governance
            &&ax.auditor!=a&&ax.auditor!=b&&ay.auditor!=a&&ay.auditor!=b
            &&cx.controller==x.controller&&cy.controller==y.controller
            &&cx.evidenceHash==x.evidenceHash&&cy.evidenceHash==y.evidenceHash
            &&cx.validUntil>=x.validUntil&&cy.validUntil>=y.validUntil
            &&cx.validUntil>block.timestamp&&cy.validUntil>block.timestamp
            &&!x.revoked&&!y.revoked
            &&x.validUntil>block.timestamp&&y.validUntil>block.timestamp;
    }
}
