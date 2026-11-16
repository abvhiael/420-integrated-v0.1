// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BnbHeader420.sol";
import "./BnbBlsVerifier420.sol";
/// @notice BSC mainnet fast-finality certificate client (Maxwell and later).
/// Bootstrap commits to the checkpoint AND both epoch snapshots. A newly announced
/// committee cannot authenticate itself: its epoch must first be finalized by the old set.
contract BnbConsensusLightClient420 {
 struct Epoch {uint64 number;uint64 active;uint8 turn;address[] validators;bytes[] keys;}
 struct Execution {bytes32 hash;bytes32 transactionsRoot;bytes32 receiptsRoot;}
 struct Vote {uint64 source;bytes32 sourceHash;uint64 target;bytes32 targetHash;bytes32 job;}
 BnbBlsVerifier420 public immutable bls;
 uint64 public finalizedNumber;
 bytes32 public finalizedHash;
 Epoch[] private epochs;
 mapping(uint64=>Execution) public execution;
 mapping(bytes32=>BnbHeader420.Header) private parsedHeaders;
 error InvalidProof();
 event Finalized(uint64 indexed number,bytes32 indexed hash);
 event CommitteeAuthenticated(uint64 indexed epoch,uint64 activation);
 constructor(address bls_,bytes32 trustedSnapshot,bytes memory checkpoint,bytes memory previousEpoch,bytes memory currentEpoch){
  if(bls_.code.length==0 || trustedSnapshot==0 || trustedSnapshot!=keccak256(abi.encode(uint256(56),keccak256(checkpoint),keccak256(previousEpoch),keccak256(currentEpoch))))revert InvalidProof();
  bls=BnbBlsVerifier420(bls_);BnbHeader420.Header memory p=BnbHeader420.parse(previousEpoch);BnbHeader420.Header memory e=BnbHeader420.parse(currentEpoch);BnbHeader420.Header memory c=BnbHeader420.parse(checkpoint);
  if(p.number+1000!=e.number || c.number<e.number || c.number>=e.number+1000)revert InvalidProof();
  _epoch(p,0);_seal(e);_epoch(e,p.number);if(c.number<epochs[1].active)revert InvalidProof();_seal(c);_store(c);finalizedNumber=c.number;finalizedHash=c.hash;
 }
 /// @notice Permissionless parsing cache: only exact canonical header bytes keyed
 /// by their computed hash. This grants no finality or committee authority.
 function cacheHeader(bytes calldata raw) external returns(bytes32 hash){BnbHeader420.Header memory h=BnbHeader420.parse(raw);hash=h.hash;if(parsedHeaders[hash].hash==0)parsedHeaders[hash]=h;}
 function committee(uint256 index) external view returns(Epoch memory){return epochs[index];}
 function epochCount() external view returns(uint256){return epochs.length;}
 function isFinalizedExecutionBlock(uint64 n,bytes32 h,bytes32 receipts) external view returns(bool){Execution storage e=execution[n];return h!=0 && e.hash==h && e.receiptsRoot==receipts;}
 function _index(uint64 height) private view returns(uint256 i){
  i=epochs.length-1;Epoch storage last=epochs[i];uint64 limit=last.number+1000+uint64((last.validators.length/2+1)*last.turn-1);
  if(height>=limit)revert InvalidProof();while(height<epochs[i].active){if(i==0)revert InvalidProof();--i;}
 }
 function _seal(BnbHeader420.Header memory h) private view {if(h.timestamp<1751250600)revert InvalidProof();Epoch storage e=epochs[_index(h.number-1)];address signer=BnbHeader420.signer(h);for(uint256 i;i<e.validators.length;++i)if(e.validators[i]==signer)return;revert InvalidProof();}
 function _epoch(BnbHeader420.Header memory h,uint64 prior) private {
  if(h.number%1000!=0 || h.timestamp<1751250600 || h.extra.length<99)revert InvalidProof();uint256 n=uint8(h.extra[32]);if(n==0 || n>64 || h.extra.length<34+n*68+65)revert InvalidProof();
  uint8 turn=uint8(h.extra[33+n*68]);if(turn==0 || turn>64)revert InvalidProof();
  uint64 active;
  if(epochs.length>0){Epoch storage old=epochs[epochs.length-1];if(old.number!=prior || h.number!=old.number+1000)revert InvalidProof();active=h.number+uint64((old.validators.length/2+1)*old.turn-1);}
  epochs.push();Epoch storage e=epochs[epochs.length-1];e.number=h.number;e.active=active;e.turn=turn;
  for(uint256 i;i<n;++i){uint256 at=33+i*68;address a;for(uint256 j;j<20;++j)a=address((uint160(a)<<8)|uint8(h.extra[at+j]));bytes memory k=EthereumRLP420.slice(h.extra,at+20,48);if(a==address(0) || k[0]&0xc0!=0x80)revert InvalidProof();
   for(uint256 j;j<i;++j)if(e.validators[j]==a || keccak256(e.keys[j])==keccak256(k))revert InvalidProof();e.validators.push(a);e.keys.push(k);
  }
  // Vote bits refer to address order, not the order of epoch records.
  for(uint256 i=1;i<n;++i){uint256 j=i;while(j>0 && e.validators[j]<e.validators[j-1]){(e.validators[j],e.validators[j-1])=(e.validators[j-1],e.validators[j]);bytes memory tmp=e.keys[j];e.keys[j]=e.keys[j-1];e.keys[j-1]=tmp;--j;}}
  emit CommitteeAuthenticated(h.number,active);
 }
 function certificate(bytes memory raw) public view returns(Vote memory v){
  EthereumRLP420.validate(raw);EthereumRLP420.Item[] memory a=EthereumRLP420.children(raw,EthereumRLP420.item(raw,0));if(a.length!=4 || a[3].list || a[3].length>256)revert InvalidProof();uint256 mask=EthereumRLP420.integer(raw,a[0]);if(mask>type(uint64).max)revert InvalidProof();bytes memory signature=EthereumRLP420.data(raw,a[1]);if(signature.length!=96)revert InvalidProof();
  EthereumRLP420.Item[] memory d=EthereumRLP420.children(raw,a[2]);if(d.length!=4)revert InvalidProof();uint256 source=EthereumRLP420.integer(raw,d[0]);uint256 target=EthereumRLP420.integer(raw,d[2]);if(source>=target || target>type(uint64).max)revert InvalidProof();v.source=uint64(source);v.target=uint64(target);v.sourceHash=EthereumRLP420.word(raw,d[1]);v.targetHash=EthereumRLP420.word(raw,d[3]);
  Epoch storage e=epochs[_index(v.target-1)];uint256 n=e.keys.length;if(n<64 && mask>>n!=0)revert InvalidProof();uint256 count;for(uint256 i;i<n;++i)if(mask&(uint256(1)<<i)!=0)++count;if(count<(2*n+2)/3)revert InvalidProof();bytes[] memory keys=new bytes[](count);count=0;for(uint256 i;i<n;++i)if(mask&(uint256(1)<<i)!=0)keys[count++]=e.keys[i];
  v.job=bls.identifier(keys,keccak256(EthereumRLP420.encoded(raw,a[2])),signature);
 }
 function finalize(bytes calldata first,bytes calldata child,bytes[] calldata ancestors,bytes calldata certificateA,bytes calldata certificateB) external {
  BnbHeader420.Header memory a=BnbHeader420.parse(first);BnbHeader420.Header memory b=BnbHeader420.parse(child);if(a.number<=finalizedNumber || b.number!=a.number+1 || b.parent!=a.hash || b.milli<=a.milli || ancestors.length!=a.number-finalizedNumber-1)revert InvalidProof();
  Vote memory va=certificate(certificateA);Vote memory vb=certificate(certificateB);
  if(va.target!=a.number || va.targetHash!=a.hash || vb.source!=a.number || vb.sourceHash!=a.hash || vb.target!=b.number || vb.targetHash!=b.hash || !bls.result(va.job) || !bls.result(vb.job))revert InvalidProof();_seal(a);_seal(b);
  bytes32 parent=a.parent;uint64 milli=a.milli;bool sourceFound=va.source==finalizedNumber && va.sourceHash==finalizedHash;
  // Descending ancestors bind finality to the immutable existing checkpoint.
  BnbHeader420.Header[] memory chain=new BnbHeader420.Header[](ancestors.length);
  for(uint256 i;i<ancestors.length;++i){BnbHeader420.Header memory h=parsedHeaders[keccak256(ancestors[i])];if(h.hash==0)h=BnbHeader420.parse(ancestors[i]);if(h.hash!=parent || h.number!=a.number-i-1 || h.milli>=milli)revert InvalidProof();chain[i]=h;parent=h.parent;milli=h.milli;if(h.number==va.source && h.hash==va.sourceHash)sourceFound=true;}
  if(parent!=finalizedHash || !sourceFound)revert InvalidProof();
  for(uint256 i=chain.length;i>0;--i){_store(chain[i-1]);if(chain[i-1].number%1000==0)_epoch(chain[i-1],epochs[epochs.length-1].number);}
  _store(a);if(a.number%1000==0)_epoch(a,epochs[epochs.length-1].number);finalizedNumber=a.number;finalizedHash=a.hash;emit Finalized(a.number,a.hash);
 }
 function _store(BnbHeader420.Header memory h) private {if(execution[h.number].hash!=0 && execution[h.number].hash!=h.hash)revert InvalidProof();execution[h.number]=Execution(h.hash,h.transactionsRoot,h.receiptsRoot);}
}
