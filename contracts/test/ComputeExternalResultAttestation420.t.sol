// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeExternalResultAttestation420.sol";

contract ExternalResultAttesterHarness420 {
    function attest(
        ComputeExternalResultAttestation420 registry,
        ComputeExternalResultAttestation420.ResultClaim calldata claim
    ) external returns (bytes32) {
        return registry.attest(claim);
    }

    function revoke(
        ComputeExternalResultAttestation420 registry,
        bytes32 attestationId
    ) external {
        registry.revoke(attestationId);
    }

    function setAttester(
        ComputeExternalResultAttestation420 registry,
        address attester,
        bool trusted
    ) external {
        registry.setAttester(attester, trusted);
    }
}

contract ComputeExternalResultAttestation420Test {
    ComputeExternalProofCreditAdapter420 private adapter;
    ComputeExternalResultAttestation420 private registry;
    ExternalResultAttesterHarness420 private attester;
    ExternalResultAttesterHarness420 private otherAttester;

    function setUp() public {
        adapter = new ComputeExternalProofCreditAdapter420();
        registry = new ComputeExternalResultAttestation420(address(this), address(adapter));
        attester = new ExternalResultAttesterHarness420();
        otherAttester = new ExternalResultAttesterHarness420();
        registry.setAttester(address(attester), true);
    }

    function _source(bytes32 salt)
        private pure
        returns (ComputeExternalProofCreditAdapter420.ExternalSource memory s)
    {
        s = ComputeExternalProofCreditAdapter420.ExternalSource({
            adapterKind: keccak256(abi.encode("adapter", salt)),
            externalSystemId: keccak256(abi.encode("system", salt)),
            contributionId: keccak256(abi.encode("contribution", salt))
        });
    }

    function _claim(bytes32 salt, bytes32 canonicalWork)
        private view
        returns (ComputeExternalResultAttestation420.ResultClaim memory c)
    {
        uint64 nowTs = uint64(block.timestamp);
        c = ComputeExternalResultAttestation420.ResultClaim({
            source: _source(salt),
            resultCommitment: keccak256(abi.encode("result", salt)),
            proofRecordCommitment: keccak256(abi.encode("proof", salt)),
            creditRecordCommitment: bytes32(0),
            canonicalWorkCommitment: canonicalWork,
            attestationSchemeCommitment: keccak256("trusted-external-result-v1"),
            evidenceCommitment: keccak256(abi.encode("evidence", salt)),
            observedAt: nowTs,
            validAfter: nowTs,
            expiresAt: nowTs + 1000
        });
    }

    function testTrustedAttesterResolvesCanonicalExternalWork() public {
        bytes32 work = keccak256("canonical-work");
        ComputeExternalResultAttestation420.ResultClaim memory claim = _claim("a", work);

        bytes32 id = attester.attest(registry, claim);
        require(registry.isAcceptable(id), "attestation not acceptable");

        (
            bytes32 resolvedWork,
            bytes32 sourceBinding,
            bytes32 resultCommitment,
            bytes32 evidenceCommitment
        ) = registry.resolve(id);

        require(resolvedWork == work, "work mismatch");
        require(sourceBinding == adapter.sourceBinding(claim.source), "source mismatch");
        require(resultCommitment == claim.resultCommitment, "result mismatch");
        require(evidenceCommitment == claim.evidenceCommitment, "evidence mismatch");
    }

    function testEquivalentSourceWrappersMayMapToSameCanonicalWork() public {
        bytes32 work = keccak256("same-real-work");
        bytes32 first = attester.attest(registry, _claim("wrapper-a", work));
        bytes32 second = attester.attest(registry, _claim("wrapper-b", work));

        require(first != second, "distinct wrappers collapsed");
        require(registry.isAcceptable(first), "first wrapper invalid");
        require(registry.isAcceptable(second), "second wrapper invalid");
    }

    function testSourceCannotEquivocateAcrossCanonicalWork() public {
        ComputeExternalResultAttestation420.ResultClaim memory first =
            _claim("same-source", keccak256("work-a"));
        attester.attest(registry, first);

        ComputeExternalResultAttestation420.ResultClaim memory changed =
            _claim("same-source", keccak256("work-b"));

        (bool ok,) = address(attester).call(
            abi.encodeCall(attester.attest, (registry, changed))
        );
        require(!ok, "source equivocation accepted");
    }

    function testEvidenceCannotEquivocateAcrossCanonicalWork() public {
        ComputeExternalResultAttestation420.ResultClaim memory first =
            _claim("a", keccak256("work-a"));
        attester.attest(registry, first);

        ComputeExternalResultAttestation420.ResultClaim memory changed =
            _claim("b", keccak256("work-b"));
        changed.proofRecordCommitment = first.proofRecordCommitment;
        changed.creditRecordCommitment = first.creditRecordCommitment;

        (bool ok,) = address(attester).call(
            abi.encodeCall(attester.attest, (registry, changed))
        );
        require(!ok, "evidence equivocation accepted");
    }

    function testIdenticalAttestationIsIdempotent() public {
        bytes32 work = keccak256("canonical-work");
        ComputeExternalResultAttestation420.ResultClaim memory claim = _claim("a", work);

        bytes32 first = attester.attest(registry, claim);
        bytes32 second = attester.attest(registry, claim);
        require(first == second, "identical attestation replay changed identity");
    }

    function testUntrustedAttesterCannotPublish() public {
        ComputeExternalResultAttestation420.ResultClaim memory claim =
            _claim("a", keccak256("work"));

        (bool ok,) = address(otherAttester).call(
            abi.encodeCall(otherAttester.attest, (registry, claim))
        );
        require(!ok, "untrusted attester accepted");
    }

    function testOnlyGovernanceCanManageAttesters() public {
        (bool ok,) = address(otherAttester).call(
            abi.encodeCall(
                otherAttester.setAttester,
                (registry, address(otherAttester), true)
            )
        );
        require(!ok, "outsider changed attester trust");
        require(!registry.trustedAttester(address(otherAttester)), "trust mutated");
    }

    function testRevocationMakesAttestationUnacceptable() public {
        ComputeExternalResultAttestation420.ResultClaim memory claim =
            _claim("a", keccak256("work"));
        bytes32 id = attester.attest(registry, claim);

        attester.revoke(registry, id);
        require(!registry.isAcceptable(id), "revoked attestation accepted");

        (bool ok,) = address(registry).call(
            abi.encodeCall(registry.resolve, (id))
        );
        require(!ok, "revoked attestation resolved");
    }

    function testTrustWithdrawalMakesAttestationUnacceptable() public {
        ComputeExternalResultAttestation420.ResultClaim memory claim =
            _claim("a", keccak256("work"));
        bytes32 id = attester.attest(registry, claim);

        registry.setAttester(address(attester), false);
        require(!registry.isAcceptable(id), "untrusted historical attestation accepted");
    }

    function testAtLeastOneNormalizedProofOrCreditCommitmentRequired() public {
        ComputeExternalResultAttestation420.ResultClaim memory claim =
            _claim("a", keccak256("work"));
        claim.proofRecordCommitment = bytes32(0);
        claim.creditRecordCommitment = bytes32(0);

        (bool ok,) = address(attester).call(
            abi.encodeCall(attester.attest, (registry, claim))
        );
        require(!ok, "evidence-free claim accepted");
    }

    function testCreditOnlyEvidenceIsAccepted() public {
        ComputeExternalResultAttestation420.ResultClaim memory claim =
            _claim("a", keccak256("work"));
        claim.proofRecordCommitment = bytes32(0);
        claim.creditRecordCommitment = keccak256("credit-record");

        bytes32 id = attester.attest(registry, claim);
        require(registry.isAcceptable(id), "credit-only evidence rejected");
    }

    function testInvalidAndZeroBindingsFailClosed() public {
        ComputeExternalResultAttestation420.ResultClaim memory claim =
            _claim("a", keccak256("work"));

        claim.resultCommitment = bytes32(0);
        (bool zeroResult,) = address(attester).call(
            abi.encodeCall(attester.attest, (registry, claim))
        );
        require(!zeroResult, "zero result accepted");

        claim = _claim("b", bytes32(0));
        (bool zeroWork,) = address(attester).call(
            abi.encodeCall(attester.attest, (registry, claim))
        );
        require(!zeroWork, "zero canonical work accepted");

        claim = _claim("c", keccak256("work-c"));
        claim.evidenceCommitment = bytes32(0);
        (bool zeroEvidence,) = address(attester).call(
            abi.encodeCall(attester.attest, (registry, claim))
        );
        require(!zeroEvidence, "zero evidence accepted");

        claim = _claim("d", keccak256("work-d"));
        claim.source.contributionId = bytes32(0);
        (bool invalidSource,) = address(attester).call(
            abi.encodeCall(attester.attest, (registry, claim))
        );
        require(!invalidSource, "invalid source accepted");
    }

    function testTimingBoundariesFailClosed() public {
        ComputeExternalResultAttestation420.ResultClaim memory claim =
            _claim("a", keccak256("work-a"));
        claim.observedAt = uint64(block.timestamp) + 1;
        claim.validAfter = claim.observedAt;
        claim.expiresAt = claim.observedAt + 10;
        (bool futureObserved,) = address(attester).call(
            abi.encodeCall(attester.attest, (registry, claim))
        );
        require(!futureObserved, "future observation accepted");

        claim = _claim("b", keccak256("work-b"));
        claim.validAfter = claim.observedAt == 0 ? 0 : claim.observedAt - 1;
        if (claim.observedAt == 0) {
            claim.observedAt = 1;
            claim.validAfter = 0;
            claim.expiresAt = 10;
        }
        (bool invalidWindow,) = address(attester).call(
            abi.encodeCall(attester.attest, (registry, claim))
        );
        require(!invalidWindow, "invalid validity window accepted");

        claim = _claim("c", keccak256("work-c"));
        claim.expiresAt = claim.validAfter;
        (bool zeroWindow,) = address(attester).call(
            abi.encodeCall(attester.attest, (registry, claim))
        );
        require(!zeroWindow, "zero validity window accepted");
    }

    function testAttesterCannotRevokeAnotherAttestersRecord() public {
        registry.setAttester(address(otherAttester), true);
        bytes32 id = attester.attest(registry, _claim("a", keccak256("work")));

        (bool ok,) = address(otherAttester).call(
            abi.encodeCall(otherAttester.revoke, (registry, id))
        );
        require(!ok, "foreign attester revoked record");
        require(registry.isAcceptable(id), "record mutated");
    }
}
