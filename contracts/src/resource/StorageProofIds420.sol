// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library StorageProofIds420 {
    bytes32 internal constant PROOF_REPLICA_COMMITMENT = keccak256("420/STORAGE/PROOF/REPLICA_COMMITMENT/V1");
    bytes32 internal constant PROOF_AVAILABILITY_WINDOW = keccak256("420/STORAGE/PROOF/AVAILABILITY_WINDOW/V1");
    bytes32 internal constant PROOF_AUDIT_RESPONSE = keccak256("420/STORAGE/PROOF/AUDIT_RESPONSE/V1");

    bytes32 internal constant ACTION_REGISTER_PROOF_SCHEME = keccak256("420/STORAGE/ACTION/REGISTER_PROOF_SCHEME/V1");
    bytes32 internal constant ACTION_SET_PROOF_SCHEME_STATE = keccak256("420/STORAGE/ACTION/SET_PROOF_SCHEME_STATE/V1");
    bytes32 internal constant ACTION_REGISTER_STORAGE_COMMITMENT = keccak256("420/STORAGE/ACTION/REGISTER_STORAGE_COMMITMENT/V1");

    function validProofClass(bytes32 proofClass) internal pure returns (bool) {
        return proofClass == PROOF_REPLICA_COMMITMENT
            || proofClass == PROOF_AVAILABILITY_WINDOW
            || proofClass == PROOF_AUDIT_RESPONSE;
    }
}
