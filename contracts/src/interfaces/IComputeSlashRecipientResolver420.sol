// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IComputeSlashRecipientResolver420 {
    struct Recipients {
        address harmedPayer;
        address replacementWorker;
        address challenger;
    }

    function resolve(
        bytes32 authorizationRef,
        bytes32 evidenceRef,
        address evidenceAdapter,
        bytes32 subjectRef,
        address subjectAccount
    ) external view returns (Recipients memory recipients);
}
