package shuffle

import (
 "github.com/consensys/gnark/frontend"
 ecccurve "github.com/consensys/gnark-crypto/ecc/twistededwards"
 "github.com/consensys/gnark/std/algebra/native/twistededwards"
)

// CardUnmaskCircuit enforces that two separately proven public threshold
// decryption shares yield exactly the published canonical card from the
// authenticated ciphertext, and that both share public keys sum to the
// hand-registered aggregate encryption key. It exposes no other card.
type CardUnmaskCircuit struct {
 HandScope frontend.Variable `gnark:",public"`
 DeckRoot frontend.Variable `gnark:",public"`
 Position frontend.Variable `gnark:",public"`
 Street frontend.Variable `gnark:",public"`
 CardIndex frontend.Variable `gnark:",public"`
 CipherC2X frontend.Variable `gnark:",public"`
 CipherC2Y frontend.Variable `gnark:",public"`
 ShareAX frontend.Variable `gnark:",public"`
 ShareAY frontend.Variable `gnark:",public"`
 ShareBX frontend.Variable `gnark:",public"`
 ShareBY frontend.Variable `gnark:",public"`
 ProviderAX frontend.Variable `gnark:",public"`
 ProviderAY frontend.Variable `gnark:",public"`
 ProviderBX frontend.Variable `gnark:",public"`
 ProviderBY frontend.Variable `gnark:",public"`
 AggregatePKX frontend.Variable `gnark:",public"`
 AggregatePKY frontend.Variable `gnark:",public"`
}
func(c *CardUnmaskCircuit)Define(api frontend.API)error{
 api.AssertIsDifferent(c.HandScope,0)
 api.AssertIsDifferent(c.DeckRoot,0)
 api.AssertIsLessOrEqual(c.Position,51)
 api.AssertIsLessOrEqual(c.Street,3)
 api.AssertIsLessOrEqual(c.CardIndex,51)
 curve,err:=twistededwards.NewEdCurve(api,ecccurve.BN254)
 if err!=nil{return err}
 g:=twistededwards.Point{X:curve.Params().Base[0],Y:curve.Params().Base[1]}
 a:=twistededwards.Point{X:c.ProviderAX,Y:c.ProviderAY}
 b:=twistededwards.Point{X:c.ProviderBX,Y:c.ProviderBY}
 total:=twistededwards.Point{X:c.AggregatePKX,Y:c.AggregatePKY}
 shareA:=twistededwards.Point{X:c.ShareAX,Y:c.ShareAY}
 shareB:=twistededwards.Point{X:c.ShareBX,Y:c.ShareBY}
 c2:=twistededwards.Point{X:c.CipherC2X,Y:c.CipherC2Y}
 curve.AssertIsOnCurve(a);curve.AssertIsOnCurve(b)
 curve.AssertIsOnCurve(total);curve.AssertIsOnCurve(c2)
 curve.AssertIsOnCurve(shareA);curve.AssertIsOnCurve(shareB)
 api.AssertIsDifferent(total.X,0)
 aggregate:=curve.Add(a,b)
 api.AssertIsEqual(aggregate.X,total.X)
 api.AssertIsEqual(aggregate.Y,total.Y)
 canonicalCard:=curve.ScalarMul(g,api.Add(c.CardIndex,1))
 recovered:=curve.Add(curve.Add(canonicalCard,shareA),shareB)
 api.AssertIsEqual(recovered.X,c2.X)
 api.AssertIsEqual(recovered.Y,c2.Y)
 return nil
}
