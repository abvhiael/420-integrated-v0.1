// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
/// @notice BLS12-381 field/curve arithmetic using Cancun's real modular-exponentiation precompile.
/// Polynomial Fp12 basis and homogeneous curve formulas follow py_ecc 8.0.0.
library BnbBlsMath420 {
 struct F {uint256 h;uint256 l;}
 struct F2 {F c0;F c1;}
 struct P1 {F x;F y;F z;}
 struct P2 {F2 x;F2 y;F2 z;}
 struct E {F[12] c;}
 error InvalidField();
 function prime() internal pure returns(F memory){return F(34565483545414906068789196026815425751,45442060874369865957053122457065728162598490762543039060009208264153100167851);}
 function c(uint256 n) internal pure returns(F memory){return F(0,n);}
 function zero(F memory x) internal pure returns(bool){return x.h==0 && x.l==0;}
 function eq(F memory x,F memory y) internal pure returns(bool){return x.h==y.h && x.l==y.l;}
 function ge(F memory x,F memory y) internal pure returns(bool){return x.h>y.h || (x.h==y.h && x.l>=y.l);}
 function valid(F memory x) internal pure returns(bool){return !ge(x,prime());}
 function rawSub(F memory x,F memory y) private pure returns(F memory z){unchecked{z.l=x.l-y.l;z.h=x.h-y.h-(x.l<y.l?1:0);}}
 function a(F memory x,F memory y) internal pure returns(F memory z){unchecked{z.l=x.l+y.l;z.h=x.h+y.h+(z.l<x.l?1:0);}if(ge(z,prime()))z=rawSub(z,prime());}
 function s(F memory x,F memory y) internal pure returns(F memory){return ge(x,y)?rawSub(x,y):rawSub(prime(),rawSub(y,x));}
 function neg(F memory x) internal pure returns(F memory){return zero(x)?x:rawSub(prime(),x);}
 function half(F memory x) private pure returns(F memory){if(x.l&1!=0){unchecked{uint256 low=x.l+prime().l;x.h+=prime().h+(low<x.l?1:0);x.l=low;}}return F(x.h>>1,(x.l>>1)|(x.h<<255));}
 function modexp(F memory base,F memory exponent) internal view returns(F memory out){
  uint256[9] memory input=[uint256(64),64,64,base.h,base.l,exponent.h,exponent.l,prime().h,prime().l];uint256[2] memory result;bool ok;
  assembly("memory-safe"){ok:=staticcall(gas(),5,input,288,result,64) if iszero(eq(returndatasize(),64)){ok:=0}}
  if(!ok)revert InvalidField();out=F(result[0],result[1]);
 }
 function square(F memory x) internal view returns(F memory){return zero(x)?x:modexp(x,c(2));}
 function m(F memory x,F memory y) internal view returns(F memory){if(zero(x)||zero(y))return c(0);return half(half(s(square(a(x,y)),square(s(x,y)))));}
 function inv(F memory x) internal view returns(F memory){if(zero(x))revert InvalidField();return modexp(x,rawSub(prime(),c(2)));}
 function c2(uint256 n) internal pure returns(F2 memory){return F2(c(n),c(0));}
 function z2(F2 memory x) internal pure returns(bool){return zero(x.c0)&&zero(x.c1);}
 function e2(F2 memory x,F2 memory y) internal pure returns(bool){return eq(x.c0,y.c0)&&eq(x.c1,y.c1);}
 function a2(F2 memory x,F2 memory y) internal pure returns(F2 memory){return F2(a(x.c0,y.c0),a(x.c1,y.c1));}
 function s2(F2 memory x,F2 memory y) internal pure returns(F2 memory){return F2(s(x.c0,y.c0),s(x.c1,y.c1));}
 function n2(F2 memory x) internal pure returns(F2 memory){return F2(neg(x.c0),neg(x.c1));}
 function m2(F2 memory x,F2 memory y) internal view returns(F2 memory){F memory ac=m(x.c0,y.c0);F memory bd=m(x.c1,y.c1);return F2(s(ac,bd),s(s(m(a(x.c0,x.c1),a(y.c0,y.c1)),ac),bd));}
 function i2(F2 memory x) internal view returns(F2 memory){F memory den=inv(a(square(x.c0),square(x.c1)));return F2(m(x.c0,den),neg(m(x.c1,den)));}
 function sg2(F2 memory x) internal pure returns(bool){return x.c0.l&1!=0 || (zero(x.c0)&&x.c1.l&1!=0);}
 function large(F memory x) internal pure returns(bool){return ge(x,F(17282741772707453034394598013407712875,80617075055843030690312053732876818007934237714091801549733396136033114903894));}
 function inf1() internal pure returns(P1 memory){return P1(c(1),c(1),c(0));}
 function inf2() internal pure returns(P2 memory){return P2(c2(1),c2(1),c2(0));}
 function double1(P1 memory p) internal view returns(P1 memory){F memory x=p.x;F memory y=p.y;F memory z=p.z;
F memory W=m(m(c(3),x),x);
F memory S=m(y,z);
F memory B=m(m(x,y),S);
F memory H=s(m(W,W),m(c(8),B));
F memory S2=m(S,S);
F memory nx=m(m(c(2),H),S);
F memory ny=s(m(W,s(m(c(4),B),H)),m(m(m(c(8),y),y),S2));
F memory nz=m(m(c(8),S),S2);
return P1(nx,ny,nz);}
 function add1(P1 memory p,P1 memory q) internal view returns(P1 memory){if(zero(p.z))return q;if(zero(q.z))return p;
F memory U1=m(q.y,p.z);
F memory U2=m(p.y,q.z);
F memory V1=m(q.x,p.z);
F memory V2=m(p.x,q.z);
if(eq(V1,V2))return eq(U1,U2)?double1(p):inf1();
F memory U=s(U1,U2);
F memory V=s(V1,V2);
F memory V2sq=m(V,V);
F memory V2v=m(V2sq,V2);
F memory V3=m(V,V2sq);
F memory W=m(p.z,q.z);
F memory A=s(s(m(m(U,U),W),V3),m(c(2),V2v));
F memory nx=m(V,A);
F memory ny=s(m(U,s(V2v,A)),m(V3,U2));
F memory nz=m(V3,W);
return P1(nx,ny,nz);}
 function double2(P2 memory p) internal view returns(P2 memory){F2 memory x=p.x;F2 memory y=p.y;F2 memory z=p.z;
F2 memory W=m2(m2(c2(3),x),x);
F2 memory S=m2(y,z);
F2 memory B=m2(m2(x,y),S);
F2 memory H=s2(m2(W,W),m2(c2(8),B));
F2 memory S2=m2(S,S);
F2 memory nx=m2(m2(c2(2),H),S);
F2 memory ny=s2(m2(W,s2(m2(c2(4),B),H)),m2(m2(m2(c2(8),y),y),S2));
F2 memory nz=m2(m2(c2(8),S),S2);
return P2(nx,ny,nz);}
 function add2(P2 memory p,P2 memory q) internal view returns(P2 memory){if(z2(p.z))return q;if(z2(q.z))return p;
F2 memory U1=m2(q.y,p.z);
F2 memory U2=m2(p.y,q.z);
F2 memory V1=m2(q.x,p.z);
F2 memory V2=m2(p.x,q.z);
if(e2(V1,V2))return e2(U1,U2)?double2(p):inf2();
F2 memory U=s2(U1,U2);
F2 memory V=s2(V1,V2);
F2 memory V2sq=m2(V,V);
F2 memory V2v=m2(V2sq,V2);
F2 memory V3=m2(V,V2sq);
F2 memory W=m2(p.z,q.z);
F2 memory A=s2(s2(m2(m2(U,U),W),V3),m2(c2(2),V2v));
F2 memory nx=m2(V,A);
F2 memory ny=s2(m2(U,s2(V2v,A)),m2(V3,U2));
F2 memory nz=m2(V3,W);
return P2(nx,ny,nz);}

 function oneE() internal pure returns(E memory x){x.c[0]=c(1);}
 function zeroE(E memory x) internal pure returns(bool){for(uint256 i;i<12;++i)if(!zero(x.c[i]))return false;return true;}
 function eqE(E memory x,E memory y) internal pure returns(bool){for(uint256 i;i<12;++i)if(!eq(x.c[i],y.c[i]))return false;return true;}
 function aE(E memory x,E memory y) internal pure returns(E memory r){for(uint256 i;i<12;++i)r.c[i]=a(x.c[i],y.c[i]);}
 function sE(E memory x,E memory y) internal pure returns(E memory r){for(uint256 i;i<12;++i)r.c[i]=s(x.c[i],y.c[i]);}
 function mulE(E memory x,E memory y) internal view returns(E memory r){F[23] memory t;
  for(uint256 i;i<12;++i){if(zero(x.c[i]))continue;for(uint256 j;j<12;++j)if(!zero(y.c[j]))t[i+j]=a(t[i+j],m(x.c[i],y.c[j]));}
  for(uint256 i=23;i>12;){--i;F memory twice=a(t[i],t[i]);t[i-6]=a(t[i-6],twice);t[i-12]=s(t[i-12],twice);}
  for(uint256 i;i<12;++i)r.c[i]=t[i];
 }
 function sqE(E memory x) internal view returns(E memory r){F[23] memory t;
  for(uint256 i;i<12;++i){if(zero(x.c[i]))continue;t[i*2]=a(t[i*2],square(x.c[i]));for(uint256 j=i+1;j<12;++j)if(!zero(x.c[j])){F memory prod=m(x.c[i],x.c[j]);t[i+j]=a(t[i+j],a(prod,prod));}}
  for(uint256 i=23;i>12;){--i;F memory twice=a(t[i],t[i]);t[i-6]=a(t[i-6],twice);t[i-12]=s(t[i-12],twice);}for(uint256 i;i<12;++i)r.c[i]=t[i];
 }
 function twist(P2 memory p) internal pure returns(E[3] memory r){r[0].c[1]=s(p.x.c0,p.x.c1);r[0].c[7]=p.x.c1;r[1].c[0]=s(p.y.c0,p.y.c1);r[1].c[6]=p.y.c1;r[2].c[3]=s(p.z.c0,p.z.c1);r[2].c[9]=p.z.c1;}
 function cast(P1 memory p) internal pure returns(E[3] memory r){r[0].c[0]=p.x;r[1].c[0]=p.y;r[2].c[0]=p.z;}
 function line(E[3] memory p,E[3] memory q,E[3] memory t) internal view returns(E memory num,E memory den){
  E memory mn=sE(mulE(q[1],p[2]),mulE(p[1],q[2]));E memory md=sE(mulE(q[0],p[2]),mulE(p[0],q[2]));
  if(zeroE(md)){
   if(!zeroE(mn))return(sE(mulE(t[0],p[2]),mulE(p[0],t[2])),mulE(p[2],t[2]));
   mn=sqE(p[0]);mn=aE(aE(mn,mn),mn);md=mulE(p[1],p[2]);md=aE(md,md);
  }
  num=sE(mulE(mn,sE(mulE(t[0],p[2]),mulE(p[0],t[2]))),mulE(md,sE(mulE(t[1],p[2]),mulE(p[1],t[2]))));den=mulE(md,mulE(t[2],p[2]));
 }
}
