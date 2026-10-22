package shuffle
import (
 "github.com/consensys/gnark/frontend"
 ecccurve "github.com/consensys/gnark-crypto/ecc/twistededwards"
 "github.com/consensys/gnark/std/algebra/native/twistededwards"
)
// RecipientKeyPossessionV1 proves knowledge of the registered BabyJubjub
// decryption scalar. Scope is a public domain commitment tied by the chain
// adapter to owner, table, seat epoch, chain and key-registry contract.
type RecipientKeyPossessionV1 struct {
 Scope frontend.Variable `gnark:",public"`
 KeyX frontend.Variable `gnark:",public"`
 KeyY frontend.Variable `gnark:",public"`
 Secret frontend.Variable
}
func(c *RecipientKeyPossessionV1)Define(api frontend.API)error{
 api.AssertIsDifferent(c.Scope,0)
 api.AssertIsDifferent(c.Secret,0)
 curve,err:=twistededwards.NewEdCurve(api,ecccurve.BN254);if err!=nil{return err}
 g:=twistededwards.Point{X:curve.Params().Base[0],Y:curve.Params().Base[1]}
 pk:=curve.ScalarMul(g,c.Secret)
 api.AssertIsEqual(pk.X,c.KeyX);api.AssertIsEqual(pk.Y,c.KeyY)
 api.AssertIsDifferent(pk.X,0)
 return nil
}
