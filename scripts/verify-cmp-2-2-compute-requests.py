#!/usr/bin/env python3
"""CMP-2.2 scope/schema/qualification wiring gate; behavior is proven by Foundry + SDK tests."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]

def main():
    errors = []
    cfg = json.loads((ROOT / 'contracts/config/compute-market/cmp-2.2-compute-requests.json').read_text())
    expected = {
        'step': 'CMP-2.2',
        'canonical_definition': 'Express required resource class, runtime, verification, replication, privacy, deadline and maximum price.',
        'next_canonical_step': 'CMP-2.3 — Replaceable matching engine',
    }
    for key, value in expected.items():
        if cfg.get(key) != value:
            errors.append(f'{key} drift')
    if cfg['qualification'] != {'level': 1, 'level_2_required_now': False, 'level_3_deferred_to': 'CMP-2.8 — Phase closeout'}:
        errors.append('qualification boundary drift')
    required = {
        'contracts/src/compute/ComputeRequestRegistry420.sol': [
            'ComputeJobSignedRequestAuthority420 public immutable signedRequests',
            'bytes32 resourceClass', 'bytes32 runtimeHash', 'PolicyRef verification',
            'uint32 replicationFactor', 'PolicyRef privacy', 'uint64 deadline', 'uint256 maximumPrice',
            'function createRequest(', 'function updateRequest(', 'function cancelRequest(',
            'function expireRequest(', 'function revision(', 'function commitment(',
            'creationApprovals[signedRequestId][msg.sender] != keccak256(abi.encode(terms))',
            'terms.maximumPrice > r.terms.maximumPrice', 't.maximumPrice > a.maxSpend',
            'authorization.scopeRequest(id)', 'd.revision != r.revision',
            'signedRequestUsed[signedRequestId] = true', '_history[id][r.revision] = r',
        ],
        'contracts/src/compute/ComputeAuthorization420.sol': ['ACTION_UPDATE_REQUEST','ACTION_CANCEL_REQUEST'],
        'contracts/test/ComputeRequests420.t.sol': [
            'testCanonicalRequestIdentityAndConstraintsAreReconstructable',
            'testDelegatedCreationRequiresExactOwnerApprovedTermsAndScopedGrant',
            'testRevisionHistoryAndStaleUpdates',
            'testOutsiderAndSignedAuthorizationReuseFailAtomically',
            'testMalformedPolicyPlanWindowBudgetAndOverflowRejectWithoutAllocation',
            'testBudgetCannotIncreaseEvenInsidePayerSignedCeiling',
            'testDelegationNeedsOwnerConsentExactScopeActionAndPriceAndExpiresOnRevision',
            'testCancellationTerminalAndStillAvailableAfterExpiry',
            'testPermissionlessExpiryBoundaryAndTerminalHistory',
            'testIndependentStaticAbiEncodingVector',
        ],
        'packages/420-sdk/src/compute.ts': ['ComputeRequest420','validateComputeRequest420',
            'encodeComputeRequestId420','encodeComputeRequestCommitment420', 'request aggregate capacity overflows uint256'],
        'packages/420-sdk/test/compute-sdk.test.mjs': ['CMP-2.2 request validation and independent canonical ABI vectors'],
        'docs/compute-market/CMP-2.2-COMPUTE-REQUESTS.md': ['# CMP-2.2 — Compute requests', 'CMP-2.3 — Replaceable matching engine'],
        'docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md': ['## CMP-2.2 — Compute requests', expected['canonical_definition']],
        '.github/workflows/contracts-foundry.yml': ['scope_files=','done < "$scope_files"', 'git fetch --no-tags origin'],
        '.github/workflows/compute-market.yml': ['python scripts/verify-cmp-2-2-compute-requests.py','npm test'],
    }
    for path, needles in required.items():
        content = (ROOT / path).read_text()
        for needle in needles:
            if needle not in content:
                errors.append(f'{path}: missing {needle}')
    vector = json.loads((ROOT / 'packages/420-sdk/test/fixtures/compute-request-vector.json').read_text())
    solidity = (ROOT / 'contracts/test/ComputeRequests420.t.sol').read_text()
    for key in ('requestDomain', 'commitmentDomain', 'requestId', 'commitment'):
        if vector[key] not in solidity:
            errors.append(f'encoding vector not asserted in Solidity: {key}')
    print(json.dumps({'step': 'CMP-2.2', 'pass': not errors, 'errors': errors, 'qualification_level': 1}, indent=2))
    if errors:
        raise SystemExit(1)

if __name__ == '__main__':
    main()
