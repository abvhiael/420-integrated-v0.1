// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {BnbBlsMath420 as M} from "./BnbBlsMath420.sol";
import "./BnbBlsHash420.sol";
/// @notice Fully computed BLS12-381 POP verification on Cancun. Permissionless
/// bounded work advances exact subgroup/Miller/final-exponent computations.
/// No alleged result, relayer signature, or unavailable BLS precompile is trusted.
contract BnbBlsVerifier420 {
 struct Witness {M.F[] publicY;M.F2 signatureY;M.F2[2] hashY;}
 struct Job {
  bool started;bool complete;bool accepted;uint8 phase;uint16 remaining;uint16 keyIndex;uint8 round;
  M.P1 pk;M.P2 sig;M.P2 q;M.P1 acc1;M.P2 acc2;M.P1[] keys;bytes32[] keyHashes;
  M.P2 ra;M.P2 rb;M.E numerator;M.E denominator;M.E outN;M.E outD;
 }
 mapping(bytes32=>Job) private jobs;
 mapping(bytes32=>bool) public validatedKeys;
 BnbBlsHash420 public immutable hasher;
 error InvalidBLS();
 event Progress(bytes32 indexed id,uint8 phase,uint16 remaining);
 constructor(){hasher=new BnbBlsHash420();}
 function identifier(bytes[] memory keys,bytes32 message,bytes memory signature) public pure returns(bytes32){return keccak256(abi.encode(keys,message,signature));}
 function field(bytes memory raw,uint256 at,bool flags) private pure returns(M.F memory x){
  for(uint256 i;i<16;++i)x.h=(x.h<<8)|uint8(i==0 && flags?raw[at+i]&0x1f:raw[at+i]);
  for(uint256 i;i<32;++i)x.l=(x.l<<8)|uint8(raw[at+16+i]);if(!M.valid(x))revert InvalidBLS();
 }
 function keyPoint(bytes memory compressed,M.F memory y) private view returns(M.P1 memory p){
  if(compressed.length!=48 || compressed[0]&0xc0!=0x80 || !M.valid(y))revert InvalidBLS();M.F memory x=field(compressed,0,true);
  if(!M.eq(M.square(y),M.a(M.m(M.square(x),x),M.c(4))) || M.large(y)!=(compressed[0]&0x20!=0))revert InvalidBLS();return M.P1(x,y,M.c(1));
 }
 function signaturePoint(bytes memory compressed,M.F2 memory y) private view returns(M.P2 memory p){
  if(compressed.length!=96 || compressed[0]&0xc0!=0x80 || !M.valid(y.c0)||!M.valid(y.c1))revert InvalidBLS();
  M.F2 memory x=M.F2(field(compressed,48,false),field(compressed,0,true));
  bool sign=M.zero(y.c1)?M.large(y.c0):M.large(y.c1);
  if(!M.e2(M.m2(y,y),M.a2(M.m2(M.m2(x,x),x),M.F2(M.c(4),M.c(4)))) || sign!=(compressed[0]&0x20!=0))revert InvalidBLS();return M.P2(x,y,M.c2(1));
 }
 function begin(bytes[] calldata keys,bytes32 message,bytes calldata signature,Witness calldata w) external returns(bytes32 id){
  if(keys.length==0 || keys.length>64 || w.publicY.length!=keys.length)revert InvalidBLS();id=identifier(keys,message,signature);Job storage j=jobs[id];if(j.started)return id;
  M.P1 memory sum=M.inf1();
  for(uint256 i;i<keys.length;++i){M.P1 memory p=keyPoint(keys[i],w.publicY[i]);sum=M.add1(sum,p);bytes32 kh=keccak256(keys[i]);if(!validatedKeys[kh]){j.keys.push(p);j.keyHashes.push(kh);}}
  if(M.zero(sum.z))revert InvalidBLS();M.F memory zi=M.inv(sum.z);j.pk=M.P1(M.m(sum.x,zi),M.m(sum.y,zi),M.c(1));
  j.sig=signaturePoint(signature,w.signatureY);j.q=hasher.hashBeforeCofactor(message,w.hashY);j.acc2=M.inf2();j.remaining=636;j.started=true;
  emit Progress(id,0,j.remaining);
 }
 function scalarBit(uint256 bit,bool cofactor) private pure returns(bool){bytes memory data;if(cofactor)data=hex"0bc69f08f2ee75b3584c6a0ea91b352888e2a8e9145ad7689986ff031508ffe1329c2f178731db956d82bf015d1212b02ec0ec69d7477c1ae954cbc06689f6a359894c0adebbf6b4e8020005aaa95551";else data=hex"73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001";return (uint8(data[data.length-1-bit/8])>>(bit%8))&1!=0;}
 function finalBit(uint256 bit) private pure returns(bool){bytes memory data=hex"02ee1db5dcc825b7e1bda9c0496a1c0a89ee0193d4977b3f7d4507d07363baa13f8d14a917848517badc3a43d1073776ab353f2c30698e8cc7deada9c0aadff5e9cfee9a074e43b9a660835cc872ee83ff3a0f0f1c0ad0d6106feaf4e347aa68ad49466fa927e7bb9375331807a0dce2630d9aa4b113f414386b0e8819328148978e2b0dd39099b86e1ab656d2670d93e4d7acdd350da5359bc73ab61a0c5bf24c374693c49f570bcd2b01f3077ffb10bf24dde41064837f27611212596bc293c8d4c01f25118790f4684d0b9c40a68eb74bb22a40ee7169cdc1041296532fef459f12438dfc8e2886ef965e61a474c5c85b0129127a1b5ad0463434724538411d1676a53b5a62eb34c05739334f46c02c3f0bd0c55d3109cd15948d0a1fad20044ce6ad4c6bec3ec03ef19592004cedd556952c6d8823b19dadd7c2498345c6e5308f1c511291097db60b1749bf9b71a9f9e0100418a3ef0bc627751bbd81367066bca6a4c1b6dcfc5cceb73fc56947a403577dfa9e13c24ea820b09c1d9f7c31759c3635de3f7a3639991708e88adce88177456c49637fd7961be1a4c7e79fb02faa732e2f3ec2bea83d196283313492caa9d4aff1c910e9622d2a73f62537f2701aaef6539314043f7bbce5b78c7869aeb2181a67e49eeed2161daf3f881bd88592d767f67c4717489119226c2f011d4cab803e9d71650a6f80698e2f8491d12191a04406fbc8fbd5f48925f98630e68bfb24c0bcb9b55df57510";return (uint8(data[data.length-1-bit/8])>>(bit%8))&1!=0;}
 function startMiller(Job storage j) private {j.phase=3;j.remaining=63;j.ra=j.q;j.rb=j.sig;j.numerator=M.oneE();j.denominator=M.oneE();}
 /// @notice One deterministic bit/round per call. No caller-supplied intermediate state.
 function advance(bytes32 id) external {
  Job storage j=jobs[id];if(!j.started || j.complete)revert InvalidBLS();uint256 bit=j.phase==3?j.remaining-1:--j.remaining;
  if(j.phase<=1){
   M.P2 memory value=M.double2(j.acc2);if(scalarBit(bit,j.phase==0))value=M.add2(value,j.phase==0?j.q:j.sig);j.acc2=value;
   if(bit==0){
    if(j.phase==0){if(M.z2(value.z))revert InvalidBLS();j.q=value;j.phase=1;j.remaining=255;j.acc2=M.inf2();}
    else{if(!M.z2(value.z))revert InvalidBLS();if(j.keys.length==0)startMiller(j);else{j.phase=2;j.remaining=255;j.acc1=M.inf1();}}
   }
  }else if(j.phase==2){
   M.P1 memory value=M.double1(j.acc1);if(scalarBit(bit,false))value=M.add1(value,j.keys[j.keyIndex]);j.acc1=value;
   if(bit==0){if(!M.zero(value.z))revert InvalidBLS();validatedKeys[j.keyHashes[j.keyIndex]]=true;++j.keyIndex;if(j.keyIndex==j.keys.length)startMiller(j);else{j.remaining=255;j.acc1=M.inf1();}}
  }else if(j.phase==3){
   M.P2 memory ra=j.ra;M.P2 memory rb=j.rb;
   M.E memory num=j.numerator;M.E memory den=j.denominator;
   if(j.round==0){
    (M.E memory an,M.E memory ad)=M.line(M.twist(ra),M.twist(ra),M.cast(j.pk));
    num=M.mulE(M.sqE(num),an);den=M.mulE(M.sqE(den),ad);j.round=1;
   }else if(j.round==1){
    (M.E memory bn,M.E memory bd)=M.line(M.twist(rb),M.twist(rb),M.cast(generator()));
    num=M.mulE(num,bd);den=M.mulE(den,bn);j.ra=M.double2(ra);j.rb=M.double2(rb);
    j.round=(uint64(0xd201000000010000)>>bit)&1!=0?2:0;
   }else if(j.round==2){
    (M.E memory an,M.E memory ad)=M.line(M.twist(ra),M.twist(j.q),M.cast(j.pk));
    num=M.mulE(num,an);den=M.mulE(den,ad);j.round=3;
   }else{
    (M.E memory bn,M.E memory bd)=M.line(M.twist(rb),M.twist(j.sig),M.cast(generator()));
    num=M.mulE(num,bd);den=M.mulE(den,bn);j.ra=M.add2(ra,j.q);j.rb=M.add2(rb,j.sig);j.round=0;
   }
   j.numerator=num;j.denominator=den;
   if(j.round==0){--j.remaining;if(bit==0){if(M.zeroE(num)||M.zeroE(den))revert InvalidBLS();j.phase=4;j.remaining=4314;j.outN=M.oneE();j.outD=M.oneE();}}
  }else{
   M.E memory n=M.sqE(j.outN);M.E memory d=M.sqE(j.outD);if(finalBit(bit)){n=M.mulE(n,j.numerator);d=M.mulE(d,j.denominator);}j.outN=n;j.outD=d;
   if(bit==0){j.complete=true;j.accepted=M.eqE(n,d);}
  }
  emit Progress(id,j.phase,j.remaining);
 }
 function generator() private pure returns(M.P1 memory){return M.P1(M.F(31827880280837800241567138048534752271,88385725958748408079899006800036250932223001591707578097800747617502997169851),M.F(11568204302792691131076548377920244452,114417265404584670498511149331300188430316142484413708742216858159411894806497),M.c(1));}
 function status(bytes32 id) external view returns(bool complete,bool accepted,uint8 phase,uint16 remaining){Job storage j=jobs[id];return(j.complete,j.accepted,j.phase,j.remaining);}
 function result(bytes32 id) external view returns(bool){Job storage j=jobs[id];return j.complete && j.accepted;}
}
