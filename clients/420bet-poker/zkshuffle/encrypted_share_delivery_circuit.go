package shuffle

import (
 "github.com/consensys/gnark/frontend"
 ecccurve "github.com/consensys/gnark-crypto/ecc/twistededwards"
 "github.com/consensys/gnark/std/algebra/native/twistededwards"
)

// EncryptedShareDeliveryV1 proves that a recipient's encrypted threshold
// share corresponds to the exact ciphertext at a verified final-deck slot.
// No card plaintext, secret provider scalar or ephemeral encryption nonce
// is a public input. The Solidity adapter MUST bind every public input to
// the authoritative hand, deck root, seat, provider key, recipient key,
// assignment and version before accepting a proof.
type EncryptedShareDeliveryV1 struct {
 HandScope frontend.Variable `gnark:",public"`
 DeckRoot frontend.Variable `gnark:",public"`
 Position frontend.Variable `gnark:",public"`
 Seat frontend.Variable `gnark:",public"`
 ProviderIndex frontend.Variable `gnark:",public"`
 // On-chain domain-separated context commitment, reduced canonically into Fr.
 DeliveryContext frontend.Variable `gnark:",public"`
 CipherC1X frontend.Variable `gnark:",public"`
 CipherC1Y frontend.Variable `gnark:",public"`
 CipherC2X frontend.Variable `gnark:",public"`
 CipherC2Y frontend.Variable `gnark:",public"`
 ProviderPKX frontend.Variable `gnark:",public"`
 ProviderPKY frontend.Variable `gnark:",public"`
 RecipientPKX frontend.Variable `gnark:",public"`
 RecipientPKY frontend.Variable `gnark:",public"`
 EnvelopeUX frontend.Variable `gnark:",public"`
 EnvelopeUY frontend.Variable `gnark:",public"`
 EnvelopeVX frontend.Variable `gnark:",public"`
 EnvelopeVY frontend.Variable `gnark:",public"`
 MerklePath [6]frontend.Variable
 ProviderSecret frontend.Variable
 EncryptionNonce frontend.Variable
}
func(c *EncryptedShareDeliveryV1)Define(api frontend.API)error{
 api.AssertIsDifferent(c.HandScope,0)
 api.AssertIsDifferent(c.DeckRoot,0)
 api.AssertIsDifferent(c.DeliveryContext,0)
 api.AssertIsLessOrEqual(c.Position,51)
 api.AssertIsLessOrEqual(c.Seat,8)
 api.AssertIsLessOrEqual(c.ProviderIndex,1)
 api.AssertIsDifferent(c.ProviderSecret,0)
 api.AssertIsDifferent(c.EncryptionNonce,0)
 curve,err:=twistededwards.NewEdCurve(api,ecccurve.BN254)
 if err!=nil{return err}
 g:=twistededwards.Point{X:curve.Params().Base[0],Y:curve.Params().Base[1]}
 c1:=twistededwards.Point{X:c.CipherC1X,Y:c.CipherC1Y}
 c2:=twistededwards.Point{X:c.CipherC2X,Y:c.CipherC2Y}
 pk:=twistededwards.Point{X:c.ProviderPKX,Y:c.ProviderPKY}
 recipient:=twistededwards.Point{X:c.RecipientPKX,Y:c.RecipientPKY}
 u:=twistededwards.Point{X:c.EnvelopeUX,Y:c.EnvelopeUY}
 v:=twistededwards.Point{X:c.EnvelopeVX,Y:c.EnvelopeVY}
 curve.AssertIsOnCurve(c1);curve.AssertIsOnCurve(c2)
 curve.AssertIsOnCurve(pk);curve.AssertIsOnCurve(recipient)
 curve.AssertIsOnCurve(u);curve.AssertIsOnCurve(v)
 api.AssertIsDifferent(c1.X,0)
 api.AssertIsDifferent(pk.X,0)
 api.AssertIsDifferent(recipient.X,0)
 api.AssertIsDifferent(u.X,0)
 if err:=verifyCiphertextMembership(api,c.HandScope,c.Position,c.DeckRoot,
  ElGamalCipher{C1X:c.CipherC1X,C1Y:c.CipherC1Y,C2X:c.CipherC2X,C2Y:c.CipherC2Y},
  c.MerklePath);err!=nil{return err}
 actualPK:=curve.ScalarMul(g,c.ProviderSecret)
 api.AssertIsEqual(actualPK.X,pk.X)
 api.AssertIsEqual(actualPK.Y,pk.Y)
 share:=curve.ScalarMul(c1,c.ProviderSecret)
 expectedU:=curve.ScalarMul(g,c.EncryptionNonce)
 expectedV:=curve.Add(share,curve.ScalarMul(recipient,c.EncryptionNonce))
 api.AssertIsEqual(expectedU.X,u.X)
 api.AssertIsEqual(expectedU.Y,u.Y)
 api.AssertIsEqual(expectedV.X,v.X)
 api.AssertIsEqual(expectedV.Y,v.Y)
 return nil
}
