// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../../system/SystemAccess.sol";
import "./SolanaEd25519420.sol";
/// @notice Explicit stake-weighted validator attestation oracle. This is NOT a
/// native Alpenglow/Tower light client. Authorized validators attest independently
/// replayed finalized-bank/execution evidence under a bridge-specific domain.
/// RPC commitment labels and ordinary Solana votes are not accepted certificates.
contract SolanaValidatorQuorum420 is SystemAccess {
 bytes32 public constant GENESIS=0x45296998a6f8e2a784db5d9f95e18fc23f70441a1039446801089879b08c7ef0;
 uint256 public immutable destinationChainId;
 SolanaEd25519420 public immutable ed;
 struct Epoch {bytes32 root;bytes32 snapshotHash;uint64 totalStake;bool disabled;}
 struct Claim {uint64 epoch;uint64 slot;bytes32 bankHash;bytes32 transactionHash;bytes32 executionHash;}
 struct Vote {bytes32 voteAccount;bytes32 authorizedVoter;uint64 stake;uint32 index;bytes32[] branch;bytes signature;}
 struct Certificate {uint128 stake;bool accepted;}
 mapping(uint64=>Epoch) public epochs;
 mapping(bytes32=>Certificate) public certificates;
 mapping(bytes32=>mapping(bytes32=>bool)) public voted;
 mapping(uint64=>bytes32) public finalizedBanks;
 error InvalidEpoch();error InvalidVote();error ConflictingBank();
 event EpochInstalled(uint64 indexed epoch,bytes32 root,bytes32 snapshotHash,uint64 totalStake);
 event EpochDisabled(uint64 indexed epoch);
 event VoteAccepted(bytes32 indexed claim,bytes32 indexed voteAccount,uint64 stake);
 event Certified(bytes32 indexed claim,uint64 indexed slot,bytes32 bankHash);
 constructor(address governance) SystemAccess(governance){destinationChainId=block.chainid;ed=new SolanaEd25519420();}
 /// @dev The trusted manifest must derive vote authorities AND effective stake
 /// from the same authenticated replayed epoch bank. JSON-RPC alone cannot supply
 /// that trust. An epoch root is immutable once installed; unknown epochs fail closed.
 function installEpoch(uint64 epoch,bytes32 root,bytes32 snapshotHash,uint64 totalStake) external onlyGovernance {if(epoch<1 || root==0 || snapshotHash==0 || totalStake==0 || epochs[epoch].root!=0)revert InvalidEpoch();epochs[epoch]=Epoch(root,snapshotHash,totalStake,false);emit EpochInstalled(epoch,root,snapshotHash,totalStake);}
 function disableEpoch(uint64 epoch) external onlyGovernance {if(epochs[epoch].root==0)revert InvalidEpoch();epochs[epoch].disabled=true;emit EpochDisabled(epoch);}
 function digest(Claim memory c) public view returns(bytes32){Epoch storage e=epochs[c.epoch];return sha256(abi.encode("420/SOLANA/VALIDATOR-ATTESTATION/V1",GENESIS,destinationChainId,address(this),c,e.root,e.snapshotHash,e.totalStake));}
 function leaf(uint64 epoch,Vote memory v) public pure returns(bytes32){return sha256(abi.encode(GENESIS,epoch,v.voteAccount,v.authorizedVoter,v.stake));}
 function submitVote(Claim calldata c,Vote calldata v) external {
  Epoch storage e=epochs[c.epoch];if(block.chainid!=destinationChainId || e.root==0 || e.disabled || c.slot==0 || c.slot/432000!=c.epoch || c.bankHash==0 || c.transactionHash==0 || c.executionHash==0)revert InvalidEpoch();
  if(v.voteAccount==0 || v.authorizedVoter==0 || v.stake==0 || v.stake>e.totalStake || v.branch.length>32)revert InvalidVote();
  uint256 index=v.index;bytes32 h=leaf(c.epoch,v);for(uint256 i;i<v.branch.length;++i){h=index&1==0?sha256(abi.encodePacked(h,v.branch[i])):sha256(abi.encodePacked(v.branch[i],h));index>>=1;}if(index!=0 || h!=e.root)revert InvalidVote();
  bytes32 id=digest(c);if(voted[id][v.voteAccount] || !ed.verify(v.authorizedVoter,abi.encodePacked(id),v.signature))revert InvalidVote();
  if(finalizedBanks[c.slot]!=0 && finalizedBanks[c.slot]!=c.bankHash)revert ConflictingBank();Certificate storage certificate=certificates[id];uint128 weight=certificate.stake+v.stake;if(weight>e.totalStake)revert InvalidVote();voted[id][v.voteAccount]=true;certificate.stake=weight;emit VoteAccepted(id,v.voteAccount,v.stake);
  if(weight*3>uint128(e.totalStake)*2 && !certificate.accepted){certificate.accepted=true;finalizedBanks[c.slot]=c.bankHash;emit Certified(id,c.slot,c.bankHash);}
 }
 function isCertified(Claim memory c) external view returns(bool){Epoch storage e=epochs[c.epoch];return block.chainid==destinationChainId && !e.disabled && e.root!=0 && c.slot/432000==c.epoch && certificates[digest(c)].accepted && finalizedBanks[c.slot]==c.bankHash;}
}
