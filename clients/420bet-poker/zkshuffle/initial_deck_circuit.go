package shuffle

import (
 "github.com/consensys/gnark/frontend"
 ecccurve "github.com/consensys/gnark-crypto/ecc/twistededwards"
 "github.com/consensys/gnark/std/algebra/native/twistededwards"
)

// InitialDeck52 proves that the input to the first private shuffle encrypts
// each of the fifty-two distinct canonical cards EXACTLY ONCE, in a known order.
// Card i is encoded as (i+1)*G; the random encryption nonces are private.
// The public ciphertext list, PK and hand scope must be bound to an immutable
// deck commitment by the on-chain verifier adapter before live deployment.
type InitialDeck52 struct {
 DeckRoot frontend.Variable `gnark:",public"`
 Cards [52]ElGamalCipher
 HandScope frontend.Variable `gnark:",public"`
 PublicKeyX frontend.Variable `gnark:",public"`
 PublicKeyY frontend.Variable `gnark:",public"`
 Randomness [52]frontend.Variable
}
type InitialDeck2 struct {
 Cards [2]ElGamalCipher `gnark:",public"`
 HandScope frontend.Variable `gnark:",public"`
 PublicKeyX frontend.Variable `gnark:",public"`
 PublicKeyY frontend.Variable `gnark:",public"`
 Randomness [2]frontend.Variable
}
func initialDeckRelation(api frontend.API,cards []ElGamalCipher,scope,pkX,pkY frontend.Variable,
 randomness []frontend.Variable) error {
 api.AssertIsDifferent(scope,0)
 curve,err:=twistededwards.NewEdCurve(api,ecccurve.BN254)
 if err!=nil{return err}
 generator:=twistededwards.Point{X:curve.Params().Base[0],Y:curve.Params().Base[1]}
 pk:=twistededwards.Point{X:pkX,Y:pkY}
 curve.AssertIsOnCurve(pk)
 api.AssertIsDifferent(pk.X,0) // excludes identity and low-order x=0 keys
 for i:=range cards {
  api.AssertIsDifferent(randomness[i],0)
  randomG:=curve.ScalarMul(generator,randomness[i])
  api.AssertIsDifferent(randomG.X,0) // zero nonce modulo subgroup would expose plaintext
  randomPK:=curve.ScalarMul(pk,randomness[i])
  cardPoint:=curve.ScalarMul(generator,i+1)
  expected2:=curve.Add(cardPoint,randomPK)
  api.AssertIsEqual(randomG.X,cards[i].C1X)
  api.AssertIsEqual(randomG.Y,cards[i].C1Y)
  api.AssertIsEqual(expected2.X,cards[i].C2X)
  api.AssertIsEqual(expected2.Y,cards[i].C2Y)
 }
 return nil
}
func(c *InitialDeck52)Define(api frontend.API)error {
 if err:=initialDeckRelation(api,c.Cards[:],c.HandScope,c.PublicKeyX,c.PublicKeyY,c.Randomness[:]);err!=nil{return err}
 root,err:=ciphertextMerkleRoot(api,c.HandScope,c.Cards[:]);if err!=nil{return err}
 api.AssertIsEqual(root,c.DeckRoot)
 return nil
}
func(c *InitialDeck2)Define(api frontend.API)error {
 return initialDeckRelation(api,c.Cards[:],c.HandScope,c.PublicKeyX,c.PublicKeyY,c.Randomness[:])
}
