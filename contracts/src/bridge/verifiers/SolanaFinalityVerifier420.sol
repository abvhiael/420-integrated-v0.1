// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../interfaces/ISolanaFinalityVerifier420.sol";
import "../../system/SystemAccess.sol";
import "./solana/SolanaValidatorQuorum420.sol";
import "./solana/SolanaTransaction420.sol";
/// @notice Solana mainnet transfer verification through an explicitly trusted
/// stake-weighted validator oracle plus independent native signature/instruction
/// verification. CPI trace/committed effects require the validator certificate.
/// RPC execution metadata alone is never a proof.
contract SolanaFinalityVerifier420 is ISolanaFinalityVerifier420,SystemAccess {
 bytes32 public constant GENESIS=0x45296998a6f8e2a784db5d9f95e18fc23f70441a1039446801089879b08c7ef0;
 bytes32 public constant NATIVE=keccak256("420/BRIDGE/SOLANA/NATIVE/SOL");
 bytes32 public constant TOKEN_PROGRAM=0x06ddf6e1d765a193d9cbe146ceeb79ac1cb485ed5f5b37913a8cf5857eff00a9;
 uint256 public immutable destinationChainId;
 address public immutable destinationRouter;
 SolanaValidatorQuorum420 public immutable quorum;
 struct Execution {bytes32 genesisHash;bytes32 bankHash;uint64 slot;bytes32 gatewayProgram;bytes32 gatewayCodeHash;bytes32 sourceAsset;bytes32 sourceOwner;address recipient;uint64 amount;uint64 nonce;uint256 destinationChainId;address destinationRouter;bytes32 routeId;uint32 instructionIndex;bool success;bytes32[] loadedWritable;bytes32[] loadedReadonly;bytes innerInstruction;uint32 innerIndex;}
 struct Proof {Execution execution;bytes transaction;}
 mapping(bytes32=>bytes32) public programCodeHashes;
 mapping(bytes32=>bytes32) public routes;
 mapping(bytes32=>bytes32) public vaults;
 mapping(bytes32=>bytes32) public depositStates;
 error InvalidProof();error Uncertified();error InvalidInstruction();
 constructor(address governance,address quorum_,address router) SystemAccess(governance){if(quorum_.code.length==0 || router.code.length==0)revert InvalidProof();quorum=SolanaValidatorQuorum420(quorum_);if(quorum.GENESIS()!=GENESIS || quorum.destinationChainId()!=block.chainid)revert InvalidProof();destinationChainId=block.chainid;destinationRouter=router;}
 function setProgram(bytes32 program,bytes32 codeHash) external onlyGovernance {if(program==0)revert InvalidProof();programCodeHashes[program]=codeHash;}
 function setAsset(bytes32 asset,bytes32 route) external onlyGovernance {if(asset==0)revert InvalidProof();routes[asset]=route;}
 function setVault(bytes32 program,bytes32 asset,bytes32 vault) external onlyGovernance {if(program==0 || asset==0)revert InvalidProof();vaults[keccak256(abi.encode(program,asset))]=vault;}
 function setDepositState(bytes32 program,bytes32 asset,bytes32 state) external onlyGovernance {if(program==0 || asset==0)revert InvalidProof();depositStates[keccak256(abi.encode(program,asset))]=state;}
 function claim(Proof memory p) public pure returns(SolanaValidatorQuorum420.Claim memory){return SolanaValidatorQuorum420.Claim(p.execution.slot/432000,p.execution.slot,p.execution.bankHash,sha256(p.transaction),sha256(abi.encode(p.execution)));}
 function little64(uint64 v) private pure returns(bytes memory b){b=new bytes(8);for(uint256 i;i<8;++i)b[i]=bytes1(uint8(v>>(i*8)));}
 function instructionData(Execution memory e) public pure returns(bytes memory){return abi.encodePacked(bytes8("420SOLV1"),little64(e.amount),e.sourceAsset,e.recipient,e.destinationChainId,e.destinationRouter,e.routeId,little64(e.nonce));}
 function messageId(Execution memory e) public pure returns(bytes32){return sha256(abi.encode("420/SOLANA/DEPOSIT/V1",e.genesisHash,e.gatewayProgram,e.sourceOwner,e.sourceAsset,e.recipient,e.amount,e.nonce,e.destinationChainId,e.destinationRouter,e.routeId));}
 function verifyFinalizedTransfer(bytes calldata encoded) external view returns(FinalizedTransfer memory out){
  if(encoded.length>50000 || block.chainid!=destinationChainId)revert InvalidProof();Proof memory p=abi.decode(encoded,(Proof));Execution memory e=p.execution;
  if(keccak256(encoded)!=keccak256(abi.encode(p)) || e.genesisHash!=GENESIS || e.bankHash==0 || e.slot==0 || e.sourceOwner==0 || e.recipient==address(0) || e.amount==0 || e.nonce==0 || !e.success || e.destinationChainId!=destinationChainId || e.destinationRouter!=destinationRouter || e.routeId==0 || routes[e.sourceAsset]!=e.routeId || e.gatewayCodeHash==0 || programCodeHashes[e.gatewayProgram]!=e.gatewayCodeHash)revert InvalidProof();
  if(!quorum.isCertified(claim(p)))revert Uncertified();SolanaTransaction420.Transaction memory t=SolanaTransaction420.parse(p.transaction,e.loadedWritable,e.loadedReadonly,quorum.ed());
  if(e.instructionIndex>=t.instructions.length)revert InvalidInstruction();bool inner=e.innerInstruction.length!=0;SolanaTransaction420.Instruction memory ix;
  if(inner){ix=abi.decode(e.innerInstruction,(SolanaTransaction420.Instruction));if(keccak256(e.innerInstruction)!=keccak256(abi.encode(ix)) || ix.programIndex>=t.keys.length)revert InvalidInstruction();for(uint256 i;i<ix.accounts.length;++i)if(uint8(ix.accounts[i])>=t.keys.length)revert InvalidInstruction();}
  else {if(e.innerIndex!=0)revert InvalidInstruction();ix=t.instructions[e.instructionIndex];}if(t.keys[ix.programIndex]!=e.gatewayProgram || t.writable[ix.programIndex] || keccak256(ix.data)!=keccak256(instructionData(e)))revert InvalidInstruction();
  uint256 n=ix.accounts.length;if(n!=(e.sourceAsset==NATIVE?3:6))revert InvalidInstruction();uint256 owner=uint8(ix.accounts[0]);uint256 vault=uint8(ix.accounts[1]);bytes32 expectedVault=vaults[keccak256(abi.encode(e.gatewayProgram,e.sourceAsset))];
  if((!inner && owner>=t.required) || t.keys[owner]!=e.sourceOwner || expectedVault==0 || t.keys[vault]!=expectedVault || !t.writable[vault])revert InvalidInstruction();
  if(e.sourceAsset==NATIVE){if(!t.writable[owner] || t.keys[uint8(ix.accounts[2])]!=0)revert InvalidInstruction();}
  else if(depositStates[keccak256(abi.encode(e.gatewayProgram,e.sourceAsset))]==0 || t.keys[uint8(ix.accounts[5])]!=depositStates[keccak256(abi.encode(e.gatewayProgram,e.sourceAsset))] || !t.writable[uint8(ix.accounts[5])] || t.keys[uint8(ix.accounts[2])]!=e.sourceAsset || !t.writable[uint8(ix.accounts[3])] || t.keys[uint8(ix.accounts[4])]!=TOKEN_PROGRAM)revert InvalidInstruction();
  out=FinalizedTransfer(e.genesisHash,e.slot,t.id,messageId(e),e.gatewayProgram,e.sourceAsset,e.sourceOwner,e.recipient,e.amount,true,e.destinationChainId,e.destinationRouter,e.routeId);
 }
}
