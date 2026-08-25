// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IMetadataCommitment420 {
    struct MetadataCommitment {
        bytes32 schemaId;
        bytes32 contentHash;
        bytes32 encryptionOrReferenceHash;
        uint32 version;
    }

    function metadataCommitment(bytes32 objectId) external view returns(MetadataCommitment memory);
}
