package shuffle
import (
 "github.com/consensys/gnark/frontend"
 ecccurve "github.com/consensys/gnark-crypto/ecc/twistededwards"
 "github.com/consensys/gnark/std/algebra/native/twistededwards"
)
// ThresholdKeyAggregateV1 proves that the two provider public keys truly
// form the key used by the authenticated final 52-card shuffle. No EOA or
// governance attestation may substitute for the curve equation.
type ThresholdKeyAggregateV1 struct {
 Scope frontend.Variable `gnark:",public"`
 ProviderAX frontend.Variable `gnark:",public"`
 ProviderAY frontend.Variable `gnark:",public"`
 ProviderBX frontend.Variable `gnark:",public"`
 ProviderBY frontend.Variable `gnark:",public"`
 AggregateX frontend.Variable `gnark:",public"`
 AggregateY frontend.Variable `gnark:",public"`
}
func(c *ThresholdKeyAggregateV1)Define(api frontend.API)error{
 api.AssertIsDifferent(c.Scope,0)
 curve,err:=twistededwards.NewEdCurve(api,ecccurve.BN254);if err!=nil{return err}
 a:=twistededwards.Point{X:c.ProviderAX,Y:c.ProviderAY}
 b:=twistededwards.Point{X:c.ProviderBX,Y:c.ProviderBY}
 sum:=twistededwards.Point{X:c.AggregateX,Y:c.AggregateY}
 curve.AssertIsOnCurve(a);curve.AssertIsOnCurve(b);curve.AssertIsOnCurve(sum)
 api.AssertIsDifferent(a.X,0);api.AssertIsDifferent(b.X,0)
 api.AssertIsDifferent(sum.X,0)
 expected:=curve.Add(a,b)
 api.AssertIsEqual(expected.X,sum.X)
 api.AssertIsEqual(expected.Y,sum.Y)
 return nil
}
