package shuffle

import (
  "github.com/consensys/gnark/frontend"
  ecccurve "github.com/consensys/gnark-crypto/ecc/twistededwards"
  "github.com/consensys/gnark/std/algebra/native/twistededwards"
)

// ElGamalCipher represents (rG, M+rPK), with elliptic-curve points encoded
// in the BN254 Baby-Jubjub coordinate field. Coordinates are public, while
// the permutation and rerandomization nonces remain private witnesses.
type ElGamalCipher struct {
 C1X frontend.Variable
 C1Y frontend.Variable
 C2X frontend.Variable
 C2Y frontend.Variable
}
type Reencrypt2 struct {
 Input [2]ElGamalCipher `gnark:",public"`
 Output [2]ElGamalCipher `gnark:",public"`
 HandScope frontend.Variable `gnark:",public"`
 PublicKeyX frontend.Variable `gnark:",public"`
 PublicKeyY frontend.Variable `gnark:",public"`
 Indices [2]frontend.Variable
 Nonces [2]frontend.Variable
}
type Reencrypt52 struct {
 InputRoot frontend.Variable `gnark:",public"`
 OutputRoot frontend.Variable `gnark:",public"`
 Input [52]ElGamalCipher
 Output [52]ElGamalCipher
 HandScope frontend.Variable `gnark:",public"`
 PublicKeyX frontend.Variable `gnark:",public"`
 PublicKeyY frontend.Variable `gnark:",public"`
 Indices [52]frontend.Variable
 Nonces [52]frontend.Variable
}
func proveReencryption(api frontend.API, input,output []ElGamalCipher,
   keyX,keyY,scope frontend.Variable,indices,nonces []frontend.Variable) error {
 api.AssertIsDifferent(scope,0)
 curve,err:=twistededwards.NewEdCurve(api,ecccurve.BN254)
 if err!=nil{return err}
 publicKey:=twistededwards.Point{X:keyX,Y:keyY}
 curve.AssertIsOnCurve(publicKey)
 api.AssertIsDifferent(publicKey.X,0)
 generator:=twistededwards.Point{X:curve.Params().Base[0],Y:curve.Params().Base[1]}
 n:=len(indices)
 for i:=0;i<n;i++ {
  var chosenX1 frontend.Variable=0
  var chosenY1 frontend.Variable=0
  var chosenX2 frontend.Variable=0
  var chosenY2 frontend.Variable=0
  var selected frontend.Variable=0
  for j:=0;j<n;j++ {
   bit:=api.IsZero(api.Sub(indices[i],j))
   selected=api.Add(selected,bit)
   chosenX1=api.Add(chosenX1,api.Mul(bit,input[j].C1X))
   chosenY1=api.Add(chosenY1,api.Mul(bit,input[j].C1Y))
   chosenX2=api.Add(chosenX2,api.Mul(bit,input[j].C2X))
   chosenY2=api.Add(chosenY2,api.Mul(bit,input[j].C2Y))
  }
  api.AssertIsEqual(selected,1)
  for j:=0;j<i;j++ {api.AssertIsDifferent(indices[i],indices[j])}
  api.AssertIsDifferent(nonces[i],0)
  sourceC1:=twistededwards.Point{X:chosenX1,Y:chosenY1}
  sourceC2:=twistededwards.Point{X:chosenX2,Y:chosenY2}
  curve.AssertIsOnCurve(sourceC1)
  api.AssertIsDifferent(sourceC1.X,0)
  curve.AssertIsOnCurve(sourceC2)
  randomG:=curve.ScalarMul(generator,nonces[i])
  randomK:=curve.ScalarMul(publicKey,nonces[i])
  outC1:=curve.Add(sourceC1,randomG)
  api.AssertIsDifferent(outC1.X,0)
  outC2:=curve.Add(sourceC2,randomK)
  api.AssertIsEqual(outC1.X,output[i].C1X)
  api.AssertIsEqual(outC1.Y,output[i].C1Y)
  api.AssertIsEqual(outC2.X,output[i].C2X)
  api.AssertIsEqual(outC2.Y,output[i].C2Y)
 }
 return nil
}
func(c *Reencrypt2)Define(api frontend.API)error{
 return proveReencryption(api,c.Input[:],c.Output[:],c.PublicKeyX,c.PublicKeyY,c.HandScope,c.Indices[:],c.Nonces[:])
}
func(c *Reencrypt52)Define(api frontend.API)error{
 if err:=proveReencryption(api,c.Input[:],c.Output[:],c.PublicKeyX,c.PublicKeyY,c.HandScope,c.Indices[:],c.Nonces[:]);err!=nil{return err}
 inputRoot,err:=ciphertextMerkleRoot(api,c.HandScope,c.Input[:]);if err!=nil{return err}
 outputRoot,err:=ciphertextMerkleRoot(api,c.HandScope,c.Output[:]);if err!=nil{return err}
 api.AssertIsEqual(inputRoot,c.InputRoot)
 api.AssertIsEqual(outputRoot,c.OutputRoot)
 return nil
}
