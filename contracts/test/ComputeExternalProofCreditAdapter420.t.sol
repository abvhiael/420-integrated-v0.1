// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeExternalProofCreditAdapter420.sol";
import "../src/compute/ComputeFoldingAtHomeAdapter420.sol";
import "../src/compute/ComputeBoincAdapter420.sol";
import "../src/compute/ComputeResearchClusterAdapter420.sol";
import "../src/compute/ComputeUniversityHpcGateway420.sol";

contract ComputeExternalProofCreditAdapter420Test {
    ComputeExternalProofCreditAdapter420 private adapter;

    function setUp() public {
        adapter = new ComputeExternalProofCreditAdapter420();
    }

    function _source() private pure returns (ComputeExternalProofCreditAdapter420.ExternalSource memory s) {
        s = ComputeExternalProofCreditAdapter420.ExternalSource({
            adapterKind: keccak256("adapter"),
            externalSystemId: keccak256("system"),
            contributionId: keccak256("contribution")
        });
    }

    function _proof() private pure returns (ComputeExternalProofCreditAdapter420.ProofRecord memory r) {
        r = ComputeExternalProofCreditAdapter420.ProofRecord({
            source: _source(),
            proofSchemeCommitment: keccak256("proof-scheme"),
            issuerIdentityCommitment: keccak256("issuer"),
            proofCommitment: keccak256("proof"),
            observedAt: 1760000000,
            expiresAt: 1760086400,
            evidenceCommitment: keccak256("proof-evidence")
        });
    }

    function _credit() private pure returns (ComputeExternalProofCreditAdapter420.CreditRecord memory r) {
        r = ComputeExternalProofCreditAdapter420.CreditRecord({
            source: _source(),
            creditSchemeCommitment: keccak256("credit-scheme"),
            issuerIdentityCommitment: keccak256("issuer"),
            creditUnitCommitment: keccak256("points"),
            creditAmount: 42000,
            observedAt: 1760000000,
            evidenceCommitment: keccak256("credit-evidence")
        });
    }

    function testNormalizesProofAndCreditDeterministically() public {
        ComputeExternalProofCreditAdapter420.ProofRecord memory p = _proof();
        ComputeExternalProofCreditAdapter420.CreditRecord memory c = _credit();
        (bytes32 proofId_, bytes32 proofRecord_) = adapter.normalizeProof(p);
        (bytes32 creditId_, bytes32 creditRecord_) = adapter.normalizeCredit(c);

        require(proofId_ == adapter.proofId(p), "proof id drift");
        require(proofRecord_ == adapter.proofRecordCommitment(p), "proof record drift");
        require(creditId_ == adapter.creditId(c), "credit id drift");
        require(creditRecord_ == adapter.creditRecordCommitment(c), "credit record drift");
        require(adapter.protocolCommitment() != bytes32(0), "protocol missing");
    }

    function testSourceBindingRejectsSubstitution() public {
        ComputeExternalProofCreditAdapter420.ExternalSource memory base = _source();
        bytes32 expected = adapter.sourceBinding(base);

        ComputeExternalProofCreditAdapter420.ExternalSource memory changed = base;
        changed.adapterKind = keccak256("other-adapter");
        require(adapter.sourceBinding(changed) != expected, "adapter substitution");

        changed = base;
        changed.externalSystemId = keccak256("other-system");
        require(adapter.sourceBinding(changed) != expected, "system substitution");

        changed = base;
        changed.contributionId = keccak256("other-contribution");
        require(adapter.sourceBinding(changed) != expected, "contribution substitution");
    }

    function testProofRecordBindsSchemeIssuerProofTimingExpiryAndEvidence() public {
        ComputeExternalProofCreditAdapter420.ProofRecord memory base = _proof();
        bytes32 expectedId = adapter.proofId(base);
        bytes32 expectedRecord = adapter.proofRecordCommitment(base);

        ComputeExternalProofCreditAdapter420.ProofRecord memory changed = base;
        changed.proofSchemeCommitment = keccak256("other-scheme");
        require(adapter.proofId(changed) != expectedId, "scheme not identity-bound");

        changed = base;
        changed.issuerIdentityCommitment = keccak256("other-issuer");
        require(adapter.proofId(changed) != expectedId, "issuer not identity-bound");

        changed = base;
        changed.proofCommitment = keccak256("other-proof");
        require(adapter.proofId(changed) != expectedId, "proof not identity-bound");

        changed = base;
        changed.observedAt += 1;
        require(adapter.proofId(changed) == expectedId, "time changed proof id");
        require(adapter.proofRecordCommitment(changed) != expectedRecord, "time not bound");

        changed = base;
        changed.expiresAt += 1;
        require(adapter.proofRecordCommitment(changed) != expectedRecord, "expiry not bound");

        changed = base;
        changed.evidenceCommitment = keccak256("other-evidence");
        require(adapter.proofRecordCommitment(changed) != expectedRecord, "evidence not bound");
    }

    function testCreditRecordBindsSchemeIssuerUnitAmountTimeAndEvidence() public {
        ComputeExternalProofCreditAdapter420.CreditRecord memory base = _credit();
        bytes32 expectedId = adapter.creditId(base);
        bytes32 expectedRecord = adapter.creditRecordCommitment(base);

        ComputeExternalProofCreditAdapter420.CreditRecord memory changed = base;
        changed.creditSchemeCommitment = keccak256("other-scheme");
        require(adapter.creditId(changed) != expectedId, "scheme not identity-bound");

        changed = base;
        changed.issuerIdentityCommitment = keccak256("other-issuer");
        require(adapter.creditId(changed) != expectedId, "issuer not identity-bound");

        changed = base;
        changed.creditUnitCommitment = keccak256("gpu-seconds");
        require(adapter.creditId(changed) != expectedId, "unit not identity-bound");

        changed = base;
        changed.creditAmount += 1;
        require(adapter.creditId(changed) == expectedId, "amount changed credit id");
        require(adapter.creditRecordCommitment(changed) != expectedRecord, "amount not bound");

        changed = base;
        changed.observedAt += 1;
        require(adapter.creditRecordCommitment(changed) != expectedRecord, "time not bound");

        changed = base;
        changed.evidenceCommitment = keccak256("other-evidence");
        require(adapter.creditRecordCommitment(changed) != expectedRecord, "evidence not bound");
    }

    function testRejectsMissingSourceAndRequiredProofCreditBindings() public {
        ComputeExternalProofCreditAdapter420.ProofRecord memory p = _proof();
        p.source.adapterKind = bytes32(0);
        _expectProofInvalid(p);

        p = _proof();
        p.source.externalSystemId = bytes32(0);
        _expectProofInvalid(p);

        p = _proof();
        p.source.contributionId = bytes32(0);
        _expectProofInvalid(p);

        p = _proof();
        p.proofSchemeCommitment = bytes32(0);
        _expectProofInvalid(p);

        p = _proof();
        p.issuerIdentityCommitment = bytes32(0);
        _expectProofInvalid(p);

        p = _proof();
        p.proofCommitment = bytes32(0);
        _expectProofInvalid(p);

        p = _proof();
        p.evidenceCommitment = bytes32(0);
        _expectProofInvalid(p);

        ComputeExternalProofCreditAdapter420.CreditRecord memory c = _credit();
        c.creditSchemeCommitment = bytes32(0);
        _expectCreditInvalid(c);

        c = _credit();
        c.issuerIdentityCommitment = bytes32(0);
        _expectCreditInvalid(c);

        c = _credit();
        c.creditUnitCommitment = bytes32(0);
        _expectCreditInvalid(c);

        c = _credit();
        c.creditAmount = 0;
        _expectCreditInvalid(c);

        c = _credit();
        c.evidenceCommitment = bytes32(0);
        _expectCreditInvalid(c);
    }

    function testProofExpiryAndObservationBoundariesFailClosed() public {
        ComputeExternalProofCreditAdapter420.ProofRecord memory p = _proof();
        p.observedAt = 0;
        _expectProofInvalid(p);

        p = _proof();
        p.expiresAt = p.observedAt - 1;
        _expectProofInvalid(p);

        p = _proof();
        p.expiresAt = 0;
        require(adapter.proofRecordCommitment(p) != bytes32(0), "non-expiring proof rejected");

        ComputeExternalProofCreditAdapter420.CreditRecord memory c = _credit();
        c.observedAt = 0;
        _expectCreditInvalid(c);
    }

    function testFourAdapterFamiliesProduceDistinctExternalSourceBindings() public {
        ComputeFoldingAtHomeAdapter420 folding = new ComputeFoldingAtHomeAdapter420();
        ComputeBoincAdapter420 boinc = new ComputeBoincAdapter420();
        ComputeResearchClusterAdapter420 cluster = new ComputeResearchClusterAdapter420();
        ComputeUniversityHpcGateway420 hpc = new ComputeUniversityHpcGateway420();

        bytes32 contribution = keccak256("same-logical-external-contribution");
        bytes32 f = adapter.sourceBinding(ComputeExternalProofCreditAdapter420.ExternalSource(
            folding.ADAPTER_KIND(), folding.EXTERNAL_SYSTEM_ID(), contribution
        ));
        bytes32 b = adapter.sourceBinding(ComputeExternalProofCreditAdapter420.ExternalSource(
            boinc.ADAPTER_KIND(), boinc.EXTERNAL_SYSTEM_ID(), contribution
        ));
        bytes32 c = adapter.sourceBinding(ComputeExternalProofCreditAdapter420.ExternalSource(
            cluster.ADAPTER_KIND(), cluster.EXTERNAL_SYSTEM_ID(), contribution
        ));
        bytes32 h = adapter.sourceBinding(ComputeExternalProofCreditAdapter420.ExternalSource(
            hpc.ADAPTER_KIND(), hpc.EXTERNAL_SYSTEM_ID(), contribution
        ));

        require(f != b && f != c && f != h && b != c && b != h && c != h, "source collision");
    }

    function _expectProofInvalid(ComputeExternalProofCreditAdapter420.ProofRecord memory r) private {
        (bool ok,) = address(adapter).call(abi.encodeCall(adapter.normalizeProof, (r)));
        require(!ok, "invalid proof accepted");
    }

    function _expectCreditInvalid(ComputeExternalProofCreditAdapter420.CreditRecord memory r) private {
        (bool ok,) = address(adapter).call(abi.encodeCall(adapter.normalizeCredit, (r)));
        require(!ok, "invalid credit accepted");
    }
}
