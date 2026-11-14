// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./vendor/Sha512.sol";
/// @notice Strict Ed25519 verification using extended Edwards coordinates and
/// existing Cancun modular exponentiation. No Ed25519 precompile is assumed.
contract SolanaSha512420 {
 function digest(bytes memory input) external pure returns(bytes memory){uint64[8] memory h=Sha512.hash(input);return abi.encodePacked(h[0],h[1],h[2],h[3],h[4],h[5],h[6],h[7]);}
}
contract SolanaEd25519420 {
 SolanaSha512420 public immutable sha;
 mapping(bytes32=>bool) public certifiedSignatures;
 error InvalidSignature();
 constructor(){sha=new SolanaSha512420();}
 uint256 private constant P=2**255-19;
 uint256 private constant L=2**252+27742317777372353535851937790883648493;
 uint256 private constant D=37095705934669439343138083508754565189542113879843219016388785533085940283555;
 uint256 private constant I=19681161376707505956807079304988542015446066515923890162744021073123829784752;
 struct Point {uint256 x;uint256 y;uint256 z;uint256 t;}
 function little(bytes memory b,uint256 at,uint256 n) private pure returns(uint256 v){for(uint256 i;i<n;++i)v|=uint256(uint8(b[at+i]))<<(8*i);}
 function power(uint256 b,uint256 e) private view returns(uint256 v){bool ok;uint256 p=P;assembly("memory-safe"){let m:=mload(0x40) mstore(m,32) mstore(add(m,32),32) mstore(add(m,64),32) mstore(add(m,96),b) mstore(add(m,128),e) mstore(add(m,160),p) ok:=staticcall(gas(),5,m,192,m,32) ok:=and(ok,eq(returndatasize(),32)) v:=mload(m)}require(ok,"modexp unavailable");}
 function identity() private pure returns(Point memory){return Point(0,1,1,0);}
 function same(Point memory a,Point memory b) private pure returns(bool){return mulmod(a.x,b.z,P)==mulmod(b.x,a.z,P) && mulmod(a.y,b.z,P)==mulmod(b.y,a.z,P);}
 function add(Point memory a,Point memory b) private pure returns(Point memory q){
  uint256 aa=mulmod(addmod(a.y,P-a.x,P),addmod(b.y,P-b.x,P),P);uint256 bb=mulmod(addmod(a.y,a.x,P),addmod(b.y,b.x,P),P);
  uint256 cc=mulmod(mulmod(a.t,b.t,P),2*D%P,P);uint256 dd=mulmod(2,mulmod(a.z,b.z,P),P);
  uint256 e=addmod(bb,P-aa,P);uint256 f=addmod(dd,P-cc,P);uint256 g=addmod(dd,cc,P);uint256 h=addmod(bb,aa,P);
  return Point(mulmod(e,f,P),mulmod(g,h,P),mulmod(f,g,P),mulmod(e,h,P));
 }
 function multiply(Point memory a,uint256 scalar) private pure returns(Point memory q){q=identity();while(scalar!=0){if(scalar&1!=0)q=add(q,a);a=add(a,a);scalar>>=1;}}
 function decode(bytes memory b,uint256 at) private view returns(bool valid,Point memory q){
  uint256 v=little(b,at,32);uint256 sign=v>>255;uint256 y=v&((uint256(1)<<255)-1);if(y>=P)return(false,q);
  uint256 yy=mulmod(y,y,P);uint256 den=addmod(mulmod(D,yy,P),1,P);if(den==0)return(false,q);
  uint256 xx=mulmod(addmod(yy,P-1,P),power(den,P-2),P);uint256 x=power(xx,(P+3)/8);if(mulmod(x,x,P)!=xx)x=mulmod(x,I,P);if(mulmod(x,x,P)!=xx || (x==0 && sign!=0))return(false,q);if(x&1!=sign)x=P-x;
  q=Point(x,y,1,mulmod(x,y,P));return(true,q);
 }
 function identifier(bytes32 publicKey,bytes memory message,bytes memory signature) public pure returns(bytes32){return keccak256(abi.encode(publicKey,message,signature));}
 function certify(bytes32 publicKey,bytes memory message,bytes memory signature) external returns(bytes32 id){id=identifier(publicKey,message,signature);if(!certifiedSignatures[id]){if(!_verify(publicKey,message,signature))revert InvalidSignature();certifiedSignatures[id]=true;}}
 function verify(bytes32 publicKey,bytes memory message,bytes memory signature) external view returns(bool){return certifiedSignatures[identifier(publicKey,message,signature)] || _verify(publicKey,message,signature);}
 function _verify(bytes32 publicKey,bytes memory message,bytes memory signature) private view returns(bool){
  if(signature.length!=64 || message.length>4096)return false;uint256 scalar=little(signature,32,32);if(scalar>=L)return false;
  (bool ok,Point memory a)=decode(abi.encodePacked(publicKey),0);if(!ok || same(a,identity()) || !same(multiply(a,L),identity()))return false;
  Point memory r;(ok,r)=decode(signature,0);if(!ok || same(r,identity()))return false;
  bytes memory digest=sha.digest(abi.encodePacked(bytes32(signature),publicKey,message));uint256 h;
  for(uint256 i=64;i>0;--i)h=addmod(mulmod(h,256,L),uint8(digest[i-1]),L);
  Point memory base=Point(15112221349535400772501151409588531511454012693041857206046113283949847762202,46316835694926478169428394003475163141307993866256225615783033603165251855960,1,46827403850823179245072216630277197565144205554125654976674165829533817101731);
  return same(multiply(base,scalar),add(r,multiply(a,h)));
 }
}
