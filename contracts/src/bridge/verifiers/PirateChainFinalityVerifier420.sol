// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../interfaces/IPirateChainFinalityVerifier420.sol";
import "./AuthenticatedCheckpoint420.sol";
import "./pirate/PirateEquihash420.sol";

/// @notice Authenticated native Pirate/KMD/anchor and isolated shielded-crypto
/// integration. Not a permissionless cross-chain light client. RPC flags alone
/// never establish native execution, ownership or dPoW authority.
contract PirateChainFinalityVerifier420 is IPirateChainFinalityVerifier420,SystemAccess {
    bytes32 public constant NETWORK=keccak256("PIRATE/MAINNET");
    bytes32 public constant SOURCE=bytes32(bytes20(hex"b14db80bfc1a819b958e36d1e0127e94c395d445"));
    bytes32 public constant GENESIS=0x027e3758c3a65b12aa1046462b486d0a63bfa1beae327897f56c5cfb7daaae71;
    bytes32 public constant RESTART=0x00000007cf016224dc6e7b7101dc3d7e4cd792f7dbbce18003ff577e399acca1;
    AuthenticatedCheckpoint420 public immutable checkpoints;
    address public immutable destinationRouter;uint256 public immutable destinationChainId;
    struct Gateway {bytes32 route;uint8 pool;bool enabled;}
    mapping(bytes32=>Gateway) public gatewayKeys;
    // Validation bits authenticate actual native contexts, not caller assertions:
    // 1=consensus/ancestry/work, 2=full transaction execution, 4=notary identities/
    // quorum, 8=canonical cross-chain notarization anchor, 16=shielded proofs and
    // signatures, 32=full-viewing-key ownership/decryption, 64=note witness/nullifier.
    struct Record {
        bytes32 genesis;bytes32 source;uint64 height;bytes32 blockHash;bytes32 headerSha256;
        bytes32 transactionHash;bytes32 rawTransactionSha256;uint256 chainWork;uint256 parentWork;
        bytes32 saplingRoot;bytes32 ironwoodRoot;bytes32 recoveryAnchor;
        uint64 notarizedHeight;bytes32 notarizedHash;bytes32 notarizationTransaction;
        bytes32 notarySetHash;bytes32 anchorEvidenceDigest;bytes32 nativeExecutionDigest;
        bytes32 gatewayKeyId;uint8 pool;uint32 outputIndex;uint64 notePosition;bytes32 noteCommitment;
        bytes32 nullifier;bytes32 noteRoot;bytes32 memoHash;address recipient;uint64 amount;uint8 validation;
    }
    struct Proof {Record record;uint32 index;bytes32[] branch;bytes header;bytes transaction;bytes memo;}
    error InvalidProof();error Unauthenticated();error NotSettled();
    constructor(address governance,address checkpoint,address router) SystemAccess(governance){
        if(checkpoint.code.length==0||router.code.length==0)revert InvalidProof();checkpoints=AuthenticatedCheckpoint420(checkpoint);
        if(checkpoints.network()!=NETWORK)revert InvalidProof();destinationRouter=router;destinationChainId=block.chainid;
    }
    function setGateway(bytes32 keyId,bytes32 route,uint8 pool,bool enabled) external onlyGovernance {
        if(keyId==0||pool>1||(enabled&&route==0))revert InvalidProof();gatewayKeys[keyId]=Gateway(route,pool,enabled);
    }
    function recordLeaf(Record memory r) public pure returns(bytes32){return sha256(abi.encode("420/ARRR/NATIVE-SHIELDED-STATE/V1",r));}
    function depositDomain(bytes32 route,bytes32 keyId,uint8 pool) public view returns(bytes32){return keccak256(abi.encode("420/ARRR/DEPOSIT/V1",NETWORK,destinationChainId,destinationRouter,route,keyId,pool));}
    function reverse(bytes32 x) private pure returns(bytes32 y){for(uint256 i;i<32;++i)y|=bytes32(uint256(uint8(x[i]))<<(8*i));}
    function verifyFinalizedTransfer(bytes calldata encoded) external view returns(FinalizedTransfer memory out){
        if(encoded.length>4_100_000||block.chainid!=destinationChainId)revert InvalidProof();Proof memory p=abi.decode(encoded,(Proof));
        if(keccak256(encoded)!=keccak256(abi.encode(p)))revert InvalidProof();Record memory r=p.record;
        if(r.genesis!=GENESIS||r.source!=SOURCE||r.height==0||r.blockHash==0||r.transactionHash==0||r.rawTransactionSha256!=sha256(p.transaction)||r.headerSha256!=sha256(p.header)||r.validation!=127||r.chainWork<=r.parentWork||r.pool>1||r.nativeExecutionDigest==0)revert InvalidProof();
        AuthenticatedCheckpoint420.Checkpoint memory c=checkpoints.current();
        if(r.height>c.height||uint256(c.height)-r.height+1<3||uint256(c.height)-r.height+1>type(uint32).max)revert NotSettled();
        bytes32 root=recordLeaf(r);uint256 index=p.index;if(p.branch.length>32)revert InvalidProof();
        for(uint256 i;i<p.branch.length;++i){root=index&1==0?sha256(abi.encodePacked(root,p.branch[i])):sha256(abi.encodePacked(p.branch[i],root));index>>=1;}
        if(index!=0||root!=c.stateRoot)revert Unauthenticated();
        // The October 2026 abandoned branch must never be credited after restart.
        if(r.height>=4_176_945&&r.recoveryAnchor!=RESTART)revert InvalidProof();
        if(r.height==4_176_945&&r.blockHash!=RESTART)revert InvalidProof();
        // Native dPoW requires STRICT coverage. It returns a raw-confirmation
        // fallback before notarization exists; that fallback is not bridge finality.
        if(r.notarizedHeight<=r.height||r.notarizedHeight>c.height||r.notarizedHash==0||r.notarizationTransaction==0||r.notarySetHash==0||r.anchorEvidenceDigest==0)revert NotSettled();
        if(r.chainWork-r.parentWork!=PirateEquihash420.blockWork(p.header))revert InvalidProof();
        if(reverse(PirateEquihash420.verify(p.header))!=r.blockHash)revert InvalidProof();
        Gateway memory g=gatewayKeys[r.gatewayKeyId];if(!g.enabled||g.pool!=r.pool||r.recipient==address(0)||r.amount==0||r.amount>200_000_000*100_000_000||r.noteCommitment==0||r.nullifier==0||r.notePosition>type(uint32).max)revert InvalidProof();
        if(r.noteRoot==0||r.noteRoot!=(r.pool==0?r.saplingRoot:r.ironwoodRoot))revert InvalidProof();
        if(p.memo.length!=512||sha256(p.memo)!=r.memoHash)revert InvalidProof();
        if(bytes8(uint64(BridgeWire420.readBE(p.memo,0,8)))!=bytes8("420ARRR1")||bytes32(BridgeWire420.readBE(p.memo,8,32))!=depositDomain(g.route,r.gatewayKeyId,r.pool)||address(uint160(BridgeWire420.readBE(p.memo,40,20)))!=r.recipient||BridgeWire420.readLE(p.memo,60,8)!=r.amount)revert InvalidProof();
        for(uint256 i=68;i<512;++i)if(p.memo[i]!=0)revert InvalidProof();
        bytes32 message=keccak256(abi.encode("420/ARRR/NOTE/V1",NETWORK,r.pool,r.transactionHash,r.outputIndex,r.noteCommitment));
        out=FinalizedTransfer(NETWORK,r.height,r.blockHash,r.transactionHash,message,r.nullifier,r.noteCommitment,r.memoHash,r.recipient,r.amount,uint32(uint256(c.height)-r.height+1),r.pool,true,true,true,destinationChainId,destinationRouter,g.route,r.gatewayKeyId);
    }
}
