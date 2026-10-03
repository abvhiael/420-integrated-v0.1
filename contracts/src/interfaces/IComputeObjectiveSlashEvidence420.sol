// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IComputeObjectiveSlashEvidence420 {
    struct Evidence {
        uint8 subjectKind;
        bytes32 subjectRef;
        address subjectAccount;
        bytes32 stakePolicyId;
        bytes32 verificationPolicyId;
        uint32 verificationPolicyRevision;
        bytes32 verificationPolicyCommitment;
        bytes32 violationCode;
        bytes32 misconductKey;
        bytes32 evidenceCommitment;
        uint64 evidenceAt;
        bool finalObjective;
    }

    function slashEvidence(bytes32 evidenceRef) external view returns (Evidence memory evidence);
}
