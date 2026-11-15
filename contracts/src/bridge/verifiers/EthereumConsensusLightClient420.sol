// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../interfaces/IEthereumFinalityOracle420.sol";
import "./vendor/sp1/v6.1.0/SP1VerifierGroth16.sol";
import "./EthereumExecutionHeader420.sol";
import "./EthereumSSZ420.sol";

/// @notice Ethereum-mainnet consensus light client using an immutable SP1/Helios
/// program and real Groth16 verification over Cancun's BN254 precompiles.
/// The ZK guest verifies BLS sync-committee signatures, committee rotation and
/// finality SSZ branches; execution hashes additionally receive a direct SSZ proof.
contract EthereumConsensusLightClient420 is IEthereumFinalityOracle420 {
    uint256 public constant GENESIS_TIME=1606824023;
    bytes32 public constant GENESIS_VALIDATORS_ROOT=0x4b363db94e286120d76eb905340fdd4e54bfe9f06bf33ff6cf5ad27f511bfe95;
    bytes32 public constant PROGRAM_VKEY=0x009677367b726fbff9493b3cb72e5d6d218cf4e453f92b7ca1bfce64fe005f1b;
    uint256 public constant MAX_CHECKPOINT_AGE=14 days;
    SP1Verifier public immutable proofVerifier;
    uint64 public head;
    mapping(uint64=>bytes32) public headers;
    mapping(uint256=>bytes32) public syncCommittees;
    mapping(uint64=>EthereumExecutionHeader420.Header) private executions;
    struct StorageSlot {bytes32 key; bytes32 value; address contractAddress;}
    // Exact ABI journal for the pinned Across SP1-Helios program.
    struct ProofOutputs {bytes32 executionStateRoot; bytes32 newHeader; bytes32 nextSyncCommitteeHash; uint256 newHead; bytes32 prevHeader; uint256 prevHead; bytes32 syncCommitteeHash; bytes32 startSyncCommitteeHash; StorageSlot[] slots;}
    error InvalidConsensusProof();
    error StaleCheckpoint();
    error InvalidExecutionProof();
    event FinalityAdvanced(uint64 indexed slot,bytes32 indexed headerRoot,bytes32 committeeRoot);
    event ExecutionAuthenticated(uint64 indexed number,bytes32 indexed blockHash,bytes32 receiptsRoot);
    constructor(bytes32 trustedCheckpoint,EthereumSSZ420.BeaconHeader memory checkpoint,bytes32 committeeRoot,bytes32[] memory committeeBranch){
        if(trustedCheckpoint==0 || committeeRoot==0 || EthereumSSZ420.beaconRoot(checkpoint)!=trustedCheckpoint)revert InvalidConsensusProof();
        requireFresh(checkpoint.slot);
        EthereumSSZ420.verify(committeeRoot,checkpoint.stateRoot,uint256(checkpoint.slot)/32>=364032?86:54,committeeBranch);
        head=checkpoint.slot;headers[head]=trustedCheckpoint;syncCommittees[uint256(head)/8192]=committeeRoot;
        proofVerifier=new SP1Verifier();
        emit FinalityAdvanced(head,trustedCheckpoint,committeeRoot);
    }
    function requireFresh(uint256 slot) private view {
        uint256 timestamp=GENESIS_TIME+slot*12;
        if(timestamp>block.timestamp || block.timestamp-timestamp>MAX_CHECKPOINT_AGE)revert StaleCheckpoint();
    }
    function submitFinality(bytes calldata proof,bytes calldata publicValues) external {
        if(proof.length!=356 || publicValues.length>131072)revert InvalidConsensusProof();
        ProofOutputs memory po=abi.decode(publicValues,(ProofOutputs));
        if(keccak256(publicValues)!=keccak256(abi.encode(po)) || po.slots.length>64 || po.prevHead!=head || po.prevHeader!=headers[head]
            || po.startSyncCommitteeHash!=syncCommittees[uint256(head)/8192] || po.newHead<=head || po.newHead>type(uint64).max
            || po.newHeader==0 || po.executionStateRoot==0 || po.syncCommitteeHash==0)revert InvalidConsensusProof();
        requireFresh(head);requireFresh(po.newHead);
        uint256 period=po.newHead/8192;uint256 oldPeriod=uint256(head)/8192;
        if(period==oldPeriod && po.syncCommitteeHash!=po.startSyncCommitteeHash)revert InvalidConsensusProof();
        if(syncCommittees[period]!=0 && syncCommittees[period]!=po.syncCommitteeHash)revert InvalidConsensusProof();
        if(po.nextSyncCommitteeHash!=0 && syncCommittees[period+1]!=0 && syncCommittees[period+1]!=po.nextSyncCommitteeHash)revert InvalidConsensusProof();
        proofVerifier.verifyProof(PROGRAM_VKEY,publicValues,proof);
        head=uint64(po.newHead);headers[head]=po.newHeader;syncCommittees[period]=po.syncCommitteeHash;
        if(po.nextSyncCommitteeHash!=0)syncCommittees[period+1]=po.nextSyncCommitteeHash;
        emit FinalityAdvanced(head,po.newHeader,po.syncCommitteeHash);
    }
    function authenticateExecution(EthereumSSZ420.BeaconHeader calldata beacon,bytes calldata rawHeader,bytes32[] calldata branch) external {
        if(headers[beacon.slot]==0 || headers[beacon.slot]!=EthereumSSZ420.beaconRoot(beacon))revert InvalidExecutionProof();
        EthereumExecutionHeader420.Header memory h=EthereumExecutionHeader420.parse(rawHeader);
        if(h.timestamp!=GENESIS_TIME+uint256(beacon.slot)*12)revert InvalidExecutionProof();
        EthereumSSZ420.verify(h.blockHash,beacon.bodyRoot,EthereumSSZ420.executionHashIndex(beacon.slot),branch);
        storeExecution(h);
    }
    /// @notice Authenticate older execution blocks by exact parent hashes, never by a supplied state root alone.
    function authenticateAncestor(bytes calldata childHeader,bytes calldata parentHeader) external {
        EthereumExecutionHeader420.Header memory child=EthereumExecutionHeader420.parse(childHeader);
        if(executions[child.number].blockHash!=child.blockHash || executions[child.number].blockHash==0)revert InvalidExecutionProof();
        EthereumExecutionHeader420.Header memory parent=EthereumExecutionHeader420.parse(parentHeader);
        if(parent.number+1!=child.number || parent.blockHash!=child.parentHash || parent.timestamp>=child.timestamp)revert InvalidExecutionProof();
        storeExecution(parent);
    }
    function storeExecution(EthereumExecutionHeader420.Header memory h) private {
        bytes32 previous=executions[h.number].blockHash;
        if(previous!=0 && previous!=h.blockHash)revert InvalidExecutionProof();
        executions[h.number]=h;emit ExecutionAuthenticated(h.number,h.blockHash,h.receiptsRoot);
    }
    function getExecution(uint64 number) external view returns(EthereumExecutionHeader420.Header memory){return executions[number];}
    function isFinalizedExecutionBlock(uint64 number,bytes32 blockHash,bytes32 receiptsRoot) external view returns(bool){
        EthereumExecutionHeader420.Header storage h=executions[number];return blockHash!=0 && receiptsRoot!=0 && h.blockHash==blockHash && h.receiptsRoot==receiptsRoot;
    }
}
