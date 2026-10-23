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
    mapping(bytes32 => bool) public auditRecords;

    error Unauthorized();
    error InvalidAttestation();
    event ProviderAttested(address indexed provider,bytes32 indexed controller,bytes32 indexed evidenceHash,uint64 validUntil);
    event ProviderRevoked(address indexed provider);
    event ProviderClaimed(address indexed provider,bytes32 indexed controller,bytes32 indexed evidenceHash,uint64 validUntil,uint64 nonce,bytes32 claimDigest);
    event EvidenceAuditRecorded(address indexed provider,address indexed publisher,bytes32 indexed reportHash,bytes32 evidenceHash,bytes32 reportLocationHash);

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
    function attest(address provider,bytes32 controller,bytes32 evidenceHash,uint64 validUntil) external {
        if(msg.sender!=governance) revert Unauthorized();
        if(provider==address(0)||provider==governance||controller==bytes32(0)
            ||evidenceHash==bytes32(0)||validUntil<=block.timestamp) revert InvalidAttestation();
        ProviderClaim memory c=claims[provider];
        if(c.controller!=controller||c.evidenceHash!=evidenceHash||c.validUntil<validUntil
            ||c.validUntil<=block.timestamp) revert InvalidAttestation();
        attestations[provider]=Attestation(controller,evidenceHash,validUntil,false);
        emit ProviderAttested(provider,controller,evidenceHash,validUntil);
    }
    function revoke(address provider) external {
        if(msg.sender!=governance) revert Unauthorized();
        attestations[provider].revoked=true;
        emit ProviderRevoked(provider);
    }
    /// @notice Permissionless, append-only audit trail: reporters cannot alter eligibility.
    ///         Auditors publish signed content-addressed reports separately; consumers
    ///         verify the report bytes and signatures against this event.
    function recordAudit(address provider,bytes32 reportHash,bytes32 evidenceHash,bytes32 reportLocationHash) external {
        if(provider==address(0)||reportHash==bytes32(0)||evidenceHash==bytes32(0)
            ||reportLocationHash==bytes32(0)) revert InvalidAttestation();
        bytes32 id=keccak256(abi.encode(block.chainid,address(this),provider,msg.sender,reportHash,evidenceHash,reportLocationHash));
        if(auditRecords[id]) revert InvalidAttestation();
        auditRecords[id]=true;
        emit EvidenceAuditRecorded(provider,msg.sender,reportHash,evidenceHash,reportLocationHash);
    }
    function independentlyEligible(address a,address b) external view returns(bool) {
        Attestation memory x=attestations[a];
        Attestation memory y=attestations[b];
        ProviderClaim memory cx=claims[a];
        ProviderClaim memory cy=claims[b];
        return a!=address(0)&&b!=address(0)&&a!=b&&a!=governance&&b!=governance
            &&x.controller!=bytes32(0)&&y.controller!=bytes32(0)&&x.controller!=y.controller
            &&x.evidenceHash!=bytes32(0)&&y.evidenceHash!=bytes32(0)
            &&cx.controller==x.controller&&cy.controller==y.controller
            &&cx.evidenceHash==x.evidenceHash&&cy.evidenceHash==y.evidenceHash
            &&cx.validUntil>=x.validUntil&&cy.validUntil>=y.validUntil
            &&cx.validUntil>block.timestamp&&cy.validUntil>block.timestamp
            &&!x.revoked&&!y.revoked
            &&x.validUntil>block.timestamp&&y.validUntil>block.timestamp;
    }
}
