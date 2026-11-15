#!/usr/bin/env python3
"""Differential OpenSSL/libsecp256k1 verification, including native high-s policy."""
import argparse,hashlib,json,subprocess,tempfile
from pathlib import Path
from coincurve import PrivateKey,ecdsa
N=0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141
CPP=r'''
#include <openssl/ec.h>
#include <openssl/ecdsa.h>
#include <openssl/obj_mac.h>
#include <secp256k1.h>
extern "C" int compare(const unsigned char* pub,int plen,const unsigned char* msg,const unsigned char* sig,int slen,int fast) {
 EC_KEY* key=EC_KEY_new_by_curve_name(NID_secp256k1);const unsigned char* cursor=pub;
 if(!o2i_ECPublicKey(&key,&cursor,plen)){EC_KEY_free(key);return 0;}
 if(fast){
  static auto ctx=secp256k1_context_create(SECP256K1_CONTEXT_VERIFY);
  unsigned char normalizedKey[65];unsigned char* out=normalizedKey;int size=i2o_ECPublicKey(key,&out);
  secp256k1_pubkey pk;secp256k1_ecdsa_signature s,n;
  if(slen && secp256k1_ec_pubkey_parse(ctx,&pk,normalizedKey,size) && secp256k1_ecdsa_signature_parse_der(ctx,&s,sig,slen)) {
   secp256k1_ecdsa_signature_normalize(ctx,&n,&s);
   if(secp256k1_ecdsa_verify(ctx,&n,msg,&pk)){EC_KEY_free(key);return 1;}
  }
 }
 int result=ECDSA_verify(0,msg,32,sig,slen,key)==1;EC_KEY_free(key);return result;
}
'''
CPP+=r"""
#include <iostream>
#include <vector>
#include <string>
std::vector<unsigned char> unhex(const std::string& s){std::vector<unsigned char> b;for(size_t i=0;i<s.size();i+=2)b.push_back(std::stoi(s.substr(i,2),nullptr,16));return b;}
int main(){std::string p,m,s;while(std::cin>>p>>m>>s){auto pub=unhex(p),msg=unhex(m),sig=unhex(s);std::cout<<compare(pub.data(),pub.size(),msg.data(),sig.data(),sig.size(),0)<<" "<<compare(pub.data(),pub.size(),msg.data(),sig.data(),sig.size(),1)<<"\n";}return 0;}
"""
def main():
 p=argparse.ArgumentParser();p.add_argument('--secp',type=Path,required=True);a=p.parse_args();total=0
 with tempfile.TemporaryDirectory(prefix='curecoin-crypto-') as d:
  cpp=Path(d)/'compare.cpp';cpp.write_text(CPP);so=Path(d)/'compare'
  subprocess.run(['g++','-O2','-Wno-deprecated-declarations','-I'+str(a.secp/'include'),str(cpp),str(a.secp/'lib/libsecp256k1.a'),'-lcrypto','-o',str(so)],check=True)
  inputs=[];expected=[]
  for i in range(1000):
   key=PrivateKey(hashlib.sha256(b'CURE/CRYPTO/TEST/'+i.to_bytes(4,'little')).digest());msg=hashlib.sha256(b'CURE/BLOCK/'+i.to_bytes(4,'little')).digest();sig=key.sign(msg,hasher=None);raw=ecdsa.serialize_compact(ecdsa.der_to_cdata(sig));high=ecdsa.cdata_to_der(ecdsa.deserialize_compact(raw[:32]+(N-int.from_bytes(raw[32:],'big')).to_bytes(32,'big')))
   for public in (key.public_key.format(),key.public_key.format(False)):
    for packet in (sig,high,sig[:-1]+bytes([sig[-1]^1]),sig+b'\x00',b'\x30\x00'):
     inputs.append(public.hex()+' '+msg.hex()+' '+packet.hex());expected.append(packet in (sig,high))
     total+=1
  result=subprocess.run([str(so)],input='\n'.join(inputs)+'\n',capture_output=True,text=True,check=True);rows=result.stdout.splitlines()
  if len(rows)!=len(inputs):raise ValueError('comparison count')
  for i,(row,valid) in enumerate(zip(rows,expected)):
   left,right=map(int,row.split())
   if left!=right or (valid and left!=1):raise ValueError(('ECDSA acceptance disagreement',i,row))
 print(json.dumps({'pass':True,'comparisons':total,'cases':'compressed/uncompressed, low/high-s, invalid scalar/digest mutations and DER/trailing bytes; exact OpenSSL fallback preserved'},indent=2))
if __name__=='__main__':main()
