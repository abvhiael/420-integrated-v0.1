// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../interfaces/IDobbscoinFinalityVerifier420.sol";
import "./AuthenticatedCheckpoint420.sol";
import "./dobbscoin/DobbscoinConsensus420.sol";

/// @notice Authenticated native-replay integration, NOT a permissionless scrypt light
/// client. The checkpoint authority authenticates native full validation, scrypt,
/// difficulty history, ancestry and selected chain. RPC status alone is unsupported.
contract DobbscoinFinalityVerifier420 is IDobbscoinFinalityVerifier420,SystemAccess {
    bytes32 public constant NETWORK=keccak256("DOBBSCOIN/MAINNET");
    bytes32 public constant GENESIS=0x6d2d7d525900712451b9697d0b5b2304ebae6efb349540da445bf575c0159969;
    bytes32 public constant CONSENSUS_SOURCE=bytes32(bytes20(hex"1a300eb0f469e5a3cb0d8337f20adbab83a512e3"));
    AuthenticatedCheckpoint420 public immutable checkpoints;
    uint256 public immutable destinationChainId;address public immutable destinationRouter;
    uint64 public immutable minimumDepositHeight;
    mapping(bytes32=>bytes32) public gatewayRoutes;
    struct State {
        bytes32 genesis;bytes32 consensusSource;uint64 height;bytes32 blockHash;bytes32 parentHash;
        bytes32 headerSha256;bytes32 workHeaderSha256;bytes32 scryptHash;
        uint256 parentWork;uint256 chainWork;uint32 expectedBits;uint32 parentTime;uint32 medianTimePast;
    }
    struct Proof {
        State state;uint32 stateIndex;bytes32[] stateBranch;bytes header;DobbscoinConsensus420.AuxPow aux;
        bytes transaction;uint32 transactionIndex;bytes32[] transactionBranch;
        uint32 paymentIndex;uint32 commitmentIndex;address recipient;bytes32 route;
    }
    error InvalidProof();error Unauthenticated();error NotSettled();
    constructor(address governance,address checkpoint,address router,uint64 minimumHeight) SystemAccess(governance){
        if(checkpoint.code.length==0||router.code.length==0||minimumHeight==0)revert InvalidProof();checkpoints=AuthenticatedCheckpoint420(checkpoint);
        if(checkpoints.network()!=NETWORK)revert InvalidProof();destinationChainId=block.chainid;destinationRouter=router;minimumDepositHeight=minimumHeight;
    }
    function setGateway(bytes memory script,bytes32 route) external onlyGovernance {
        bool standard=(script.length==25&&script[0]==0x76&&script[1]==0xa9&&script[2]==0x14&&script[23]==0x88&&script[24]==0xac)||(script.length==23&&script[0]==0xa9&&script[1]==0x14&&script[22]==0x87);
        if(!standard)revert InvalidProof();gatewayRoutes[keccak256(script)]=route;
    }
    function stateLeaf(State memory s) public pure returns(bytes32){return sha256(abi.encode("420/BOB/NATIVE-REPLAY-STATE/V1",s));}
    function depositDomain(bytes32 route,bytes32 scriptHash) public view returns(bytes32){return keccak256(abi.encode("420/BOB/DEPOSIT/V1",destinationChainId,destinationRouter,route,scriptHash));}
    function commitmentScript(bytes32 route,bytes32 scriptHash,uint32 index,address recipient,uint64 amount) public view returns(bytes memory){return abi.encodePacked(hex"6a20",keccak256(abi.encode(depositDomain(route,scriptHash),index,recipient,amount)));}
    function authenticate(Proof memory p) private view returns(uint32 conf){
        State memory s=p.state;
        if(block.chainid!=destinationChainId||s.genesis!=GENESIS||s.consensusSource!=CONSENSUS_SOURCE||s.height==0||p.header.length!=80||sha256(p.header)!=s.headerSha256||DobbscoinConsensus420.reverse(BridgeCrypto420.sha256d(p.header))!=s.blockHash||DobbscoinConsensus420.reverse(DobbscoinWire420.hashAt(p.header,4))!=s.parentHash)revert InvalidProof();
        AuthenticatedCheckpoint420.Checkpoint memory c=checkpoints.current();
        if(s.height>c.height||uint256(c.height)-s.height+1<288||uint256(c.height)-s.height+1>type(uint32).max)revert NotSettled();conf=uint32(uint256(c.height)-s.height+1);
        bytes32 root=stateLeaf(s);uint256 index=p.stateIndex;if(p.stateBranch.length>32)revert InvalidProof();
        for(uint256 i;i<p.stateBranch.length;++i){root=index&1==0?sha256(abi.encodePacked(root,p.stateBranch[i])):sha256(abi.encodePacked(p.stateBranch[i],root));index>>=1;}
        if(index!=0||root!=c.stateRoot)revert Unauthenticated();
        bool aux=DobbscoinConsensus420.activation(p.header,s.height);
        bytes memory workHeader=p.header;
        if(aux){DobbscoinConsensus420.checkAux(p.header,p.aux);workHeader=p.aux.parentHeader;}
        else if(p.aux.coinbase.length!=0||p.aux.parentHeader.length!=0||p.aux.parentBranch.length!=0||p.aux.chainBranch.length!=0||p.aux.parentIndex!=0||p.aux.chainIndex!=0)revert InvalidProof();
        uint32 bits=uint32(BridgeWire420.readLE(p.header,72,4));uint32 time=uint32(BridgeWire420.readLE(p.header,68,4));
        bool emergency=s.height>=1_888_888&&int256(uint256(time))-int256(uint256(s.parentTime))>21600&&bits==0x1e0fffff;
        if((bits!=s.expectedBits&&!emergency)||time<=s.medianTimePast||uint256(time)>block.timestamp+7200||sha256(workHeader)!=s.workHeaderSha256||uint256(DobbscoinConsensus420.reverse(s.scryptHash))>DobbscoinConsensus420.target(bits))revert InvalidProof();
        uint256 ownWork=DobbscoinConsensus420.work(bits);if(s.parentWork>type(uint256).max-ownWork||s.chainWork!=s.parentWork+ownWork)revert InvalidProof();
    }
    function decode(bytes calldata encoded) private pure returns(Proof memory p){if(encoded.length>1_200_000)revert InvalidProof();p=abi.decode(encoded,(Proof));if(keccak256(encoded)!=keccak256(abi.encode(p)))revert InvalidProof();}
    /// @notice Read-only historical block evidence, never a transfer authorization.
    function verifyFinalizedBlock(bytes calldata encoded) external view returns(uint64,bytes32){Proof memory p=decode(encoded);authenticate(p);return(p.state.height,p.state.blockHash);}
    function verifyFinalizedTransfer(bytes calldata encoded) external view returns(FinalizedTransfer memory out){
        Proof memory p=decode(encoded);uint32 conf=authenticate(p);
        if(p.state.height<minimumDepositHeight||p.recipient==address(0)||p.transactionIndex==0||p.paymentIndex==p.commitmentIndex||p.route==0)revert InvalidProof();
        DobbscoinWire420.Transaction memory t=DobbscoinWire420.parse(p.transaction,false);
        if(t.coinbase||p.transaction.length==64||p.paymentIndex>=t.outputs.length||p.commitmentIndex>=t.outputs.length||t.commitments!=1||DobbscoinConsensus420.branch(t.id,p.transactionIndex,p.transactionBranch)!=DobbscoinWire420.hashAt(p.header,36))revert InvalidProof();
        DobbscoinWire420.Output memory payment=t.outputs[p.paymentIndex];DobbscoinWire420.Output memory memo=t.outputs[p.commitmentIndex];bytes32 scriptHash=keccak256(payment.script);
        if(payment.amount==0||gatewayRoutes[scriptHash]!=p.route||memo.amount!=0||keccak256(memo.script)!=keccak256(commitmentScript(p.route,scriptHash,p.paymentIndex,p.recipient,payment.amount)))revert InvalidProof();
        bytes32 source=keccak256(abi.encode("420/BOB/OUTPOINT/V1",GENESIS,t.id,p.paymentIndex));
        out=FinalizedTransfer(GENESIS,0xa0fb1783,p.state.height,p.state.blockHash,DobbscoinConsensus420.reverse(t.id),keccak256(abi.encode(depositDomain(p.route,scriptHash),source)),scriptHash,source,p.recipient,payment.amount,conf,true,p.state.height>=2_000_000,destinationChainId,destinationRouter,p.route);
    }
}
