package shuffle

import (
 "github.com/consensys/gnark/frontend"
 "github.com/consensys/gnark/std/hash/mimc"
)

// Circuit proves knowledge of a unique permutation of 52 card indices
// whose salted commitments match 52 publicly committed outputs.
// It does NOT prove threshold re-encryption or hide cards from the prover.
type Circuit struct {
 HandDomain frontend.Variable `gnark:",public"`
 Outputs [52]frontend.Variable `gnark:",public"`
 Cards [52]frontend.Variable
 Salts [52]frontend.Variable
}
func (c *Circuit) Define(api frontend.API) error {
 for i:=0;i<52;i++ {
  // A private card is a member of 0..51.
  // The 52 distinct values thus form exactly one deck permutation.
  product := frontend.Variable(1)
  for k:=0;k<52;k++ {product=api.Mul(product,api.Sub(c.Cards[i],k))}
  api.AssertIsEqual(product,0)
  for j:=0;j<i;j++ {api.AssertIsDifferent(c.Cards[i],c.Cards[j])}
  hash,err:=mimc.NewMiMC(api);if err!=nil{return err}
  // Domain separation prevents combining commitments from different hands.
  hash.Write(c.HandDomain,i,c.Cards[i],c.Salts[i])
  api.AssertIsEqual(hash.Sum(),c.Outputs[i])
 }
 return nil
}
