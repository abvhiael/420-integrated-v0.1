// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../interfaces/ICurecoinFinalityVerifier420.sol";
import "../../system/SystemAccess.sol";
import "./AuthenticatedCheckpoint420.sol";
import "./curecoin/CurecoinConsensus420.sol";
import "./curecoin/CurecoinWire420.sol";
import "./curecoin/CurecoinSignature420.sol";

/// @notice Native-CURE replay-checkpoint consumer with independent kernel/eligibility,
/// block-signature and transaction/output checks. NOT a permissionless UTXO light client.
/// A qualified full native replay must authenticate the checkpoint state record;
/// raw RPC metadata or standalone header proofs never establish that authority.
contract CurecoinFinalityVerifier420 is ICurecoinFinalityVerifier420,SystemAccess {
    bytes32 public constant NETWORK=keccak256("CURECOIN/MAINNET");
    bytes32 public constant GENESIS=0x00000ce427729d5393dbf9f464e7a1d2c039e393e881f93448516b1530b688fc;
    bytes32 public constant CONSENSUS_SOURCE=bytes32(bytes20(hex"a3eb106715638e316eb03af383dc27aad2e89536"));
    AuthenticatedCheckpoint420 public immutable checkpoints;
    uint256 public immutable destinationChainId;
    address public immutable destinationRouter;
    uint32 public immutable confirmations;
    mapping(bytes32=>bytes32) public gatewayRoutes;
    struct State {
        bytes32 genesis;bytes32 consensusSource;uint64 height;bytes32 blockHash;bytes32 headerSha256;
        uint256 parentTrust;uint256 chainTrust;uint8 previousStakeCount;uint32 previousStakeBits;uint32 previousStakeTime;uint32 olderStakeTime;
        uint32 medianTimePast;uint32 parentTime;uint64 kernelModifier;bytes32 originTransaction;uint32 originIndex;
        uint64 originAmount;bytes32 originScriptHash;uint32 originHeight;uint32 originBlockTime;uint32 originTxTime;uint32 originTxOffset;
        bool originMint;bool originUnspent;uint32 minimumStakeAge;
    }
    struct Proof {
        State state;uint32 stateIndex;bytes32[] stateBranch;bytes header;bytes coinstake;bytes blockSignature;bytes originTransaction;
        uint32 transactionCount;bytes32[] coinstakeBranch;bytes transaction;uint32 transactionIndex;bytes32[] transactionBranch;
        uint32 outputIndex;bytes32 route;
    }
    error InvalidProof();error Unauthenticated();error NotSettled();
    constructor(address governance,address checkpoint,address router,uint32 depth) SystemAccess(governance){
        if(checkpoint.code.length==0||router.code.length==0||depth==0)revert InvalidProof();
        checkpoints=AuthenticatedCheckpoint420(checkpoint);if(checkpoints.network()!=NETWORK)revert InvalidProof();
        destinationChainId=block.chainid;destinationRouter=router;confirmations=depth;
    }
    function setGateway(bytes32 scriptHash,bytes32 route) external onlyGovernance{if(scriptHash==0)revert InvalidProof();gatewayRoutes[scriptHash]=route;}
    function stateLeaf(State memory s) public pure returns(bytes32){return sha256(abi.encode("420/CURE/NATIVE-REPLAY-STATE/V1",s));}
    function authenticate(Proof memory p) private view {
        if(block.chainid!=destinationChainId||p.state.genesis!=GENESIS||p.state.consensusSource!=CONSENSUS_SOURCE||p.state.height==0||p.header.length!=80||sha256(p.header)!=p.state.headerSha256||sha256(abi.encodePacked(sha256(p.header)))!=bytes32(CurecoinConsensus420.reverse(p.state.blockHash)))revert InvalidProof();
        AuthenticatedCheckpoint420.Checkpoint memory c=checkpoints.current();
        if(p.state.height>c.height||uint256(c.height)-p.state.height+1<confirmations)revert NotSettled();
        bytes32 root=stateLeaf(p.state);uint256 index=p.stateIndex;if(p.stateBranch.length>32)revert InvalidProof();
        for(uint256 i;i<p.stateBranch.length;++i){root=index&1==0?sha256(abi.encodePacked(root,p.stateBranch[i])):sha256(abi.encodePacked(p.stateBranch[i],root));index>>=1;}
        if(index!=0||root!=c.stateRoot)revert Unauthenticated();
        if(p.state.height==c.height&&p.state.blockHash!=c.blockHash)revert Unauthenticated();
    }
    function verifyStake(Proof memory p) private view {
        State memory s=p.state;uint32 time=uint32(CurecoinWire420.le(p.header,68,4));uint32 bits=uint32(CurecoinWire420.le(p.header,72,4));
        CurecoinWire420.Transaction memory origin=CurecoinWire420.parse(p.originTransaction);
        if(origin.id!=s.originTransaction||origin.time!=s.originTxTime||s.originIndex>=origin.outputs.length||origin.outputs[s.originIndex].amount!=s.originAmount||sha256(origin.outputs[s.originIndex].script)!=s.originScriptHash)revert InvalidProof();
        bool originCoinbase=origin.inputs.length==1&&origin.inputs[0].txid==0&&origin.inputs[0].index==type(uint32).max;
        bool originStake=!originCoinbase&&origin.outputs.length>=2&&origin.outputs[0].amount==0&&origin.outputs[0].script.length==0;
        if(s.originMint!=(originCoinbase||originStake))revert InvalidProof();
        uint32 expected=s.previousStakeCount<2?CurecoinConsensus420.compact(CurecoinConsensus420.limit(s.height,true)):CurecoinConsensus420.nextBits(s.previousStakeBits,s.previousStakeTime,s.olderStakeTime,true,s.height,s.height-1);
        if(s.previousStakeCount>2||CurecoinWire420.le(p.header,0,4)<(s.height>14060?3:1)||CurecoinWire420.le(p.header,0,4)>4||bits!=expected||!s.originUnspent||s.originHeight>=s.height||
            (s.originMint&&uint256(s.originHeight)+10>s.height))revert InvalidProof();
        CurecoinConsensus420.kind(s.height,true);CurecoinConsensus420.timestamp(time,s.parentTime,s.medianTimePast,block.timestamp);
        if(s.parentTrust>type(uint256).max-CurecoinConsensus420.trust(bits,true,s.height)||s.chainTrust!=s.parentTrust+CurecoinConsensus420.trust(bits,true,s.height))revert InvalidProof();
        CurecoinConsensus420.checkKernel(bits,s.kernelModifier,s.originBlockTime,s.originTxOffset,s.originTxTime,s.originIndex,time,s.originAmount,s.height,s.minimumStakeAge);
        CurecoinWire420.Transaction memory t=CurecoinWire420.parse(p.coinstake);
        if(t.time!=time||t.inputs[0].txid!=s.originTransaction||t.inputs[0].index!=s.originIndex||t.outputs.length<2||t.outputs[0].amount!=0||t.outputs[0].script.length!=0)revert InvalidProof();
        CurecoinWire420.merkle(t.id,1,p.transactionCount,p.coinstakeBranch,CurecoinWire420.hashAt(p.header,36));
        bytes memory script=t.outputs[1].script;
        if(!((script.length==35&&script[0]==0x21&&script[34]==0xac)||(script.length==67&&script[0]==0x41&&script[66]==0xac)))revert InvalidProof();
        CurecoinSignature420.verify(bytes32(CurecoinConsensus420.reverse(s.blockHash)),p.blockSignature,CurecoinWire420.cut(script,1,script.length-2));
    }
    /// @notice Authenticated block evidence only; this does not authorize a transfer.
    function verifyFinalizedBlock(bytes calldata encoded) external view returns(uint64 height,bytes32 blockHash){
        if(encoded.length>200000)revert InvalidProof();Proof memory p=abi.decode(encoded,(Proof));if(keccak256(encoded)!=keccak256(abi.encode(p)))revert InvalidProof();authenticate(p);verifyStake(p);return(p.state.height,p.state.blockHash);
    }
    function verifyFinalizedTransfer(bytes calldata encoded) external view returns(FinalizedTransfer memory out){
        if(encoded.length>200000)revert InvalidProof();Proof memory p=abi.decode(encoded,(Proof));if(keccak256(encoded)!=keccak256(abi.encode(p)))revert InvalidProof();
        authenticate(p);verifyStake(p);CurecoinWire420.Transaction memory t=CurecoinWire420.parse(p.transaction);
        if((t.inputs.length==1&&t.inputs[0].txid==0&&t.inputs[0].index==type(uint32).max)||(t.outputs.length>=2&&t.outputs[0].amount==0&&t.outputs[0].script.length==0)||p.transactionIndex<2||p.outputIndex>=t.outputs.length||t.time>CurecoinWire420.le(p.header,68,4))revert InvalidProof();
        CurecoinWire420.merkle(t.id,p.transactionIndex,p.transactionCount,p.transactionBranch,CurecoinWire420.hashAt(p.header,36));
        CurecoinWire420.Output memory output=t.outputs[p.outputIndex];bytes32 scriptHash=sha256(output.script);
        if(output.amount==0||p.route==0||gatewayRoutes[scriptHash]!=p.route)revert InvalidProof();
        // Curecoin serializes a signed transaction comment (standard size <=268).
        // Its legacy standard-script policy does not provide an OP_RETURN carrier.
        bytes32 domain=sha256(abi.encode("420/CURE/DESTINATION/V1",destinationChainId,destinationRouter,p.route));
        bytes memory memo=t.comment;if(memo.length!=61)revert InvalidProof();bytes9 tag;bytes32 bound;address recipient;
        assembly{tag:=mload(add(memo,32)) bound:=mload(add(memo,41)) recipient:=shr(96,mload(add(memo,73)))}
        if(tag!=bytes9("420CUREV1")||bound!=domain)revert InvalidProof();
        if(recipient==address(0))revert InvalidProof();bytes32 source=sha256(abi.encode("420/CURE/OUTPOINT/V1",GENESIS,t.id,p.outputIndex));
        bytes32 message=sha256(abi.encode("420/CURE/DEPOSIT/V1",source,scriptHash,output.amount,recipient,domain));
        out=FinalizedTransfer(GENESIS,0xe4e8e9e5,p.state.height,p.state.blockHash,t.id,message,scriptHash,source,recipient,output.amount,true,true,destinationChainId,destinationRouter,p.route);
    }
}
