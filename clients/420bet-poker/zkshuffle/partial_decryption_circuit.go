package shuffle

import (
 "github.com/consensys/gnark/frontend"
 ecccurve "github.com/consensys/gnark-crypto/ecc/twistededwards"
 "github.com/consensys/gnark/std/algebra/native/twistededwards"
)

// PartialDecryptCircuit is a genuine ZK proof of a single correct ElGamal
// threshold decryption share. The secret share NEVER becomes public.
//
// IMPORTANT: production integration must prove that C1 is the exact ciphertext
// at the accepted shuffled deck position, that the provider's PK is registered
// to this hand, and that the street/seat is currently authorized to reveal.
// These public context fields make replay against a different hand impossible,
// but their semantic enforcement belongs to the blockchain protocol contract.
type PartialDecryptCircuit struct {
 HandScope frontend.Variable `gnark:",public"`
 DeckRoot frontend.Variable `gnark:",public"`
 CipherC2X frontend.Variable `gnark:",public"`
 CipherC2Y frontend.Variable `gnark:",public"`
 Position frontend.Variable `gnark:",public"`
 Street frontend.Variable `gnark:",public"`
 ProviderIndex frontend.Variable `gnark:",public"`
 CipherC1X frontend.Variable `gnark:",public"`
 CipherC1Y frontend.Variable `gnark:",public"`
 ProviderPKX frontend.Variable `gnark:",public"`
 ProviderPKY frontend.Variable `gnark:",public"`
 ShareDX frontend.Variable `gnark:",public"`
 ShareDY frontend.Variable `gnark:",public"`
 MerklePath [6]frontend.Variable
 SecretShare frontend.Variable
}
func(c *PartialDecryptCircuit)Define(api frontend.API)error{
 api.AssertIsDifferent(c.HandScope,0)
 api.AssertIsLessOrEqual(c.Position,51)
 api.AssertIsLessOrEqual(c.Street,3)
 api.AssertIsLessOrEqual(c.ProviderIndex,1)
 api.AssertIsDifferent(c.SecretShare,0)
 curve,err:=twistededwards.NewEdCurve(api,ecccurve.BN254)
 if err!=nil{return err}
 generator:=twistededwards.Point{X:curve.Params().Base[0],Y:curve.Params().Base[1]}
 pk:=twistededwards.Point{X:c.ProviderPKX,Y:c.ProviderPKY}
 c1:=twistededwards.Point{X:c.CipherC1X,Y:c.CipherC1Y}
 share:=twistededwards.Point{X:c.ShareDX,Y:c.ShareDY}
 curve.AssertIsOnCurve(pk)
 api.AssertIsDifferent(pk.X,0)
 curve.AssertIsOnCurve(c1)
 api.AssertIsDifferent(c1.X,0)
 curve.AssertIsOnCurve(share)
 if err:=verifyCiphertextMembership(api,c.HandScope,c.Position,c.DeckRoot,
    ElGamalCipher{C1X:c.CipherC1X,C1Y:c.CipherC1Y,C2X:c.CipherC2X,C2Y:c.CipherC2Y},c.MerklePath);err!=nil{return err}
 actualPK:=curve.ScalarMul(generator,c.SecretShare)
 actualShare:=curve.ScalarMul(c1,c.SecretShare)
 api.AssertIsEqual(pk.X,actualPK.X)
 api.AssertIsEqual(pk.Y,actualPK.Y)
 api.AssertIsEqual(share.X,actualShare.X)
 api.AssertIsEqual(share.Y,actualShare.Y)
 return nil
}
