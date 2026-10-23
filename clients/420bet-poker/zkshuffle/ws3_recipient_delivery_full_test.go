package shuffle

import (
 "encoding/hex"
 "encoding/json"
 "math/big"
 "os"
 "path/filepath"
 "testing"

 "github.com/consensys/gnark-crypto/ecc"
 native "github.com/consensys/gnark-crypto/ecc/bn254/twistededwards"
 "github.com/consensys/gnark/backend/groth16"
 "github.com/consensys/gnark/frontend"
 "github.com/consensys/gnark/frontend/cs/r1cs"
)

// This is an actual 52-ciphertext deck, with eight distinct valid Groth16
// proofs: two providers x two hole cards x two distinct recipient secrets.
// It proves receiver-only recovery rather than equating proof acceptance to
// card delivery. All proof exports share the SAME pinned proving/VK setup.
func TestWS3TwoRecipientEightPrivateShares(t *testing.T){
 base:=native.GetEdwardsCurve().Base
 providers:=[2]*big.Int{big.NewInt(887),big.NewInt(842)}
 providerPK:=[2]*native.PointAffine{
  new(native.PointAffine).ScalarMultiplication(&base,providers[0]),
  new(native.PointAffine).ScalarMultiplication(&base,providers[1]),
 }
 threshold:=new(native.PointAffine).Add(providerPK[0],providerPK[1])
 recipientSecrets:=[2]*big.Int{big.NewInt(1021),big.NewInt(1237)}
 recipientPK:=[2]*native.PointAffine{
  new(native.PointAffine).ScalarMultiplication(&base,recipientSecrets[0]),
  new(native.PointAffine).ScalarMultiplication(&base,recipientSecrets[1]),
 }
 var cards [52]ElGamalCipher
 for i:=0;i<52;i++{
  c1,c2:=cipherOf(int64(i+1),int64(3151+i),&base,threshold)
  cards[i]=reencryptInput(c1,c2)
 }
 root,_:=nativeCipherRootAndPath(420,cards[:],0)
 cs,err:=frontend.Compile(ecc.BN254.ScalarField(),r1cs.NewBuilder,&EncryptedShareDeliveryV1{})
 if err!=nil{t.Fatal(err)}
 provingKey,verifyingKey,err:=groth16.Setup(cs);if err!=nil{t.Fatal(err)}
 type exported struct{
  Proof string `json:"proof"`
  Public []string `json:"public"`
  Position int `json:"position"`
  Seat int `json:"seat"`
  Provider int `json:"provider"`
 }
 fixtures:=make([]exported,0,8)
 // For each assigned card, a recipient obtains exactly the two individually
 // proven shares encrypted to the same key; another secret cannot decrypt them.
 for position:=0;position<4;position++{
  seat:=position%2
  c1,c2:=cipherOf(int64(position+1),int64(3151+position),&base,threshold)
  rootAtPos,path:=nativeCipherRootAndPath(420,cards[:],position)
  if rootAtPos.Cmp(root)!=0{t.Fatal("merkle root continuity")}
  var decryptedShares [2]*native.PointAffine
  for provider:=0;provider<2;provider++{
   sk:=providers[provider]
   nonce:=big.NewInt(int64(100001+position*100+provider*13))
   share:=new(native.PointAffine).ScalarMultiplication(&c1,sk)
   u:=new(native.PointAffine).ScalarMultiplication(&base,nonce)
   ephemeral:=new(native.PointAffine).ScalarMultiplication(recipientPK[seat],nonce)
   v:=new(native.PointAffine).Add(share,ephemeral)
   pubx,puby:=coordinates(providerPK[provider])
   recx,recy:=coordinates(recipientPK[seat])
   ux,uy:=coordinates(u);vx,vy:=coordinates(v)
   contextPoints:=[12]frontend.Variable{
    cards[position].C1X,cards[position].C1Y,cards[position].C2X,cards[position].C2Y,
    pubx,puby,recx,recy,ux,uy,vx,vy,
   }
   fingerprint:=ws3Fingerprint(seat,recx,recy)
   context:=ws3DeliveryScope(root,position,seat,provider,fingerprint,contextPoints)
   if context.Sign()==0{t.Fatal("invalid empty bound delivery context")}
   w:=&EncryptedShareDeliveryV1{
    HandScope:420,DeckRoot:root,Position:position,Seat:seat,ProviderIndex:provider,
    DeliveryContext:context,
    CipherC1X:cards[position].C1X,CipherC1Y:cards[position].C1Y,
    CipherC2X:cards[position].C2X,CipherC2Y:cards[position].C2Y,
    ProviderPKX:pubx,ProviderPKY:puby,RecipientPKX:recx,RecipientPKY:recy,
    EnvelopeUX:ux,EnvelopeUY:uy,EnvelopeVX:vx,EnvelopeVY:vy,
    ProviderSecret:sk,EncryptionNonce:nonce,
   }
   for i:=0;i<6;i++{w.MerklePath[i]=path[i]}
   witness,err:=frontend.NewWitness(w,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
   proof,err:=groth16.Prove(cs,provingKey,witness)
   if err!=nil{t.Fatalf("position %d provider %d: %v",position,provider,err)}
   public,err:=witness.Public();if err!=nil{t.Fatal(err)}
   if err:=groth16.Verify(proof,verifyingKey,public);err!=nil{t.Fatal(err)}
   marshal,ok:=proof.(interface{MarshalSolidity()[]byte});if !ok{t.Fatal("non-Solidity proof")}
   values:=[]frontend.Variable{w.HandScope,w.DeckRoot,w.Position,w.Seat,w.ProviderIndex,w.DeliveryContext,
    w.CipherC1X,w.CipherC1Y,w.CipherC2X,w.CipherC2Y,w.ProviderPKX,w.ProviderPKY,
    w.RecipientPKX,w.RecipientPKY,w.EnvelopeUX,w.EnvelopeUY,w.EnvelopeVX,w.EnvelopeVY}
   out:=exported{Proof:"0x"+hex.EncodeToString(marshal.MarshalSolidity()),Public:make([]string,18),
    Position:position,Seat:seat,Provider:provider}
   for i,v:=range values{
    switch z:=v.(type){
    case int:out.Public[i]=big.NewInt(int64(z)).String()
    case int64:out.Public[i]=big.NewInt(z).String()
    case *big.Int:out.Public[i]=z.String()
    default:t.Fatalf("unsupported public value type %T",v)
    }
   }
   fixtures=append(fixtures,out)
   // The intended recipient independently extracts the encrypted provider
   // share using the private scalar; no dealer receipt is trusted.
   recipientPart:=new(native.PointAffine).ScalarMultiplication(u,recipientSecrets[seat])
   negRecipientPart:=new(native.PointAffine).Neg(recipientPart)
   recovered:=new(native.PointAffine).Add(v,negRecipientPart)
   actualX,actualY:=coordinates(recovered);shareX,shareY:=coordinates(share)
   if actualX.(*big.Int).Cmp(shareX.(*big.Int))!=0||
      actualY.(*big.Int).Cmp(shareY.(*big.Int))!=0{
    t.Fatal("intended recipient could not recover provider share")
   }
   // A different seated player cannot recover this share by substituting their
   // own secret, even though all encrypted ciphertexts are publicly available.
   other:=1-seat
   alienPart:=new(native.PointAffine).ScalarMultiplication(u,recipientSecrets[other])
   fake:=new(native.PointAffine).Add(v,new(native.PointAffine).Neg(alienPart))
   fakeX,_:=coordinates(fake)
   if fakeX.(*big.Int).Cmp(shareX.(*big.Int))==0{
    t.Fatal("wrong recipient recovered an unauthorized share")
   }
   decryptedShares[provider]=recovered
   if position==0&&provider==0{
    exportTestGroth16Solidity(t,"WS3FullDelivery",verifyingKey,proof,values...)
   }
  }
  // Decryption completes ONLY after both independent provider shares arrive:
  // C2 - s_A*C1 - s_B*C1 = original card's public encoding.
  negativeA:=new(native.PointAffine).Neg(decryptedShares[0])
  negativeB:=new(native.PointAffine).Neg(decryptedShares[1])
  decrypted:=new(native.PointAffine).Add(&c2,negativeA)
  decrypted.Add(decrypted,negativeB)
  expected:=new(native.PointAffine).ScalarMultiplication(&base,big.NewInt(int64(position+1)))
  dx,dy:=coordinates(decrypted);ex,ey:=coordinates(expected)
  if dx.(*big.Int).Cmp(ex.(*big.Int))!=0||dy.(*big.Int).Cmp(ey.(*big.Int))!=0{
   t.Fatalf("recipient did not recover its actual card at physical position %d",position)
  }
 }
 if len(fixtures)!=8{t.Fatal("exactly eight genuine provider share proofs required")}
 // The SAME two recipient encryption keys are backed by independent genuine
 // proofs of secret-key possession, bound to exact active seat and epoch.
 popCS,err:=frontend.Compile(ecc.BN254.ScalarField(),r1cs.NewBuilder,&RecipientKeyPossessionV1{})
 if err!=nil{t.Fatal(err)}
 popPK,popVK,err:=groth16.Setup(popCS);if err!=nil{t.Fatal(err)}
 type popFixture struct {
  Proof string `json:"proof"`
  Public []string `json:"public"`
  Seat int `json:"seat"`
 }
 var recipientProofs []popFixture
 for seat:=0;seat<2;seat++{
  x,y:=coordinates(recipientPK[seat])
  scope:=ws3KeyScope(seat)
  w:=&RecipientKeyPossessionV1{Scope:scope,KeyX:x,KeyY:y,Secret:recipientSecrets[seat]}
  witness,err:=frontend.NewWitness(w,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
  proof,err:=groth16.Prove(popCS,popPK,witness);if err!=nil{t.Fatal(err)}
  pub,err:=witness.Public();if err!=nil{t.Fatal(err)}
  if err:=groth16.Verify(proof,popVK,pub);err!=nil{t.Fatal(err)}
  serialized:=proof.(interface{MarshalSolidity()[]byte})
  recipientProofs=append(recipientProofs,popFixture{
   Proof:"0x"+hex.EncodeToString(serialized.MarshalSolidity()),
   Public:[]string{scope.String(),x.(*big.Int).String(),y.(*big.Int).String()},Seat:seat})
  if seat==0{exportTestGroth16Solidity(t,"WS3FullRecipientPoP",popVK,proof,scope,x,y)}
 }
 // The aggregate proof prohibits either provider inventing a different joint
 // decryption key than the one used by the certified 52-card final deck.
 ax,ay:=coordinates(providerPK[0]);bx,by:=coordinates(providerPK[1]);tx,ty:=coordinates(threshold)
 aggScope:=ws3AggregateScope(ax,ay,bx,by,tx,ty)
 aggregate:=&ThresholdKeyAggregateV1{Scope:aggScope,ProviderAX:ax,ProviderAY:ay,
  ProviderBX:bx,ProviderBY:by,AggregateX:tx,AggregateY:ty}
 aggCS,err:=frontend.Compile(ecc.BN254.ScalarField(),r1cs.NewBuilder,&ThresholdKeyAggregateV1{})
 if err!=nil{t.Fatal(err)}
 aggPK,aggVK,err:=groth16.Setup(aggCS);if err!=nil{t.Fatal(err)}
 aggWitness,err:=frontend.NewWitness(aggregate,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 aggProof,err:=groth16.Prove(aggCS,aggPK,aggWitness);if err!=nil{t.Fatal(err)}
 aggPublic,err:=aggWitness.Public();if err!=nil{t.Fatal(err)}
 if err:=groth16.Verify(aggProof,aggVK,aggPublic);err!=nil{t.Fatal(err)}
 exportTestGroth16Solidity(t,"WS3FullAggregate",aggVK,aggProof,aggScope,ax,ay,bx,by,tx,ty)
 aggSerialized:=aggProof.(interface{MarshalSolidity()[]byte})
 aggregateFixture:=map[string]interface{}{
  "proof":"0x"+hex.EncodeToString(aggSerialized.MarshalSolidity()),
  "public":[]string{aggScope.String(),ax.(*big.Int).String(),ay.(*big.Int).String(),
   bx.(*big.Int).String(),by.(*big.Int).String(),tx.(*big.Int).String(),ty.(*big.Int).String()},
 }
 if dir:=os.Getenv("POKER_ZK_ARTIFACT_DIR");dir!=""{
  for name,value:=range map[string]interface{}{
   "EXPERIMENTAL-WS3TwoRecipientPoPFixtures.json":recipientProofs,
   "EXPERIMENTAL-WS3AggregateFixture.json":aggregateFixture,
  }{
   f,err:=os.Create(filepath.Join(dir,name));if err!=nil{t.Fatal(err)}
   if err:=json.NewEncoder(f).Encode(value);err!=nil{f.Close();t.Fatal(err)}
   if err:=f.Close();err!=nil{t.Fatal(err)}
  }
 }
 if dir:=os.Getenv("POKER_ZK_ARTIFACT_DIR");dir!=""{
  if err:=os.MkdirAll(dir,0755);err!=nil{t.Fatal(err)}
  file,err:=os.Create(filepath.Join(dir,"EXPERIMENTAL-WS3EightShareFixtures.json"))
  if err!=nil{t.Fatal(err)}
  if err:=json.NewEncoder(file).Encode(fixtures);err!=nil{file.Close();t.Fatal(err)}
  if err:=file.Close();err!=nil{t.Fatal(err)}
 }
}
