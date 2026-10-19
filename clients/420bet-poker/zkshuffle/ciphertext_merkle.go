package shuffle

import (
 "github.com/consensys/gnark/frontend"
 "github.com/consensys/gnark/std/hash/mimc"
)

const cipherLeafDomain=4204201
const cipherNodeDomain=4204202

// cipherLeaf commits the hand, exact physical slot and all four affine
// coordinates. A noncanonical point/invalid card must fail the associated
// shuffle/initial-encryption relation, not just pass a hash.
func cipherLeaf(api frontend.API,scope,position frontend.Variable,
 cipher ElGamalCipher)(frontend.Variable,error){
 h,err:=mimc.NewMiMC(api);if err!=nil{return nil,err}
 h.Write(cipherLeafDomain,scope,position,cipher.C1X,cipher.C1Y,cipher.C2X,cipher.C2Y)
 return h.Sum(),nil
}
func cipherNode(api frontend.API,depth int,left,right frontend.Variable)(frontend.Variable,error){
 h,err:=mimc.NewMiMC(api);if err!=nil{return nil,err}
 h.Write(cipherNodeDomain,depth,left,right)
 return h.Sum(),nil
}
func ciphertextMerkleRoot(api frontend.API,scope frontend.Variable,
 cards []ElGamalCipher)(frontend.Variable,error){
 if len(cards)!=52 {panic("canonical deck must have exactly 52 ciphertexts")}
 nodes:=make([]frontend.Variable,64)
 for i:=0;i<52;i++{
  leaf,err:=cipherLeaf(api,scope,i,cards[i]);if err!=nil{return nil,err}
  nodes[i]=leaf
 }
 for i:=52;i<64;i++ {nodes[i]=0}
 width:=64
 for depth:=0;depth<6;depth++{
  for i:=0;i<width/2;i++ {
   h,err:=cipherNode(api,depth,nodes[2*i],nodes[2*i+1])
   if err!=nil{return nil,err}
   nodes[i]=h
  }
  width/=2
 }
 return nodes[0],nil
}
func verifyCiphertextMembership(api frontend.API,scope,index,root frontend.Variable,
 card ElGamalCipher,path [6]frontend.Variable)error{
 bits:=api.ToBinary(index,6)
 api.AssertIsLessOrEqual(index,51)
 node,err:=cipherLeaf(api,scope,index,card);if err!=nil{return err}
 for depth:=0;depth<6;depth++ {
  left:=api.Select(bits[depth],path[depth],node)
  right:=api.Select(bits[depth],node,path[depth])
  node,err=cipherNode(api,depth,left,right);if err!=nil{return err}
 }
 api.AssertIsEqual(node,root)
 return nil
}
