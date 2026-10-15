package complianceauth

import("context";"crypto/ed25519";"crypto/rand";"errors";"testing";"time")
type c048Signer struct{ key ed25519.PrivateKey; fail bool; onSign func() }
func(s c048Signer) SignManifest(_ context.Context,_ string,payload []byte)([]byte,error){if s.onSign!=nil{s.onSign()};if s.fail{return nil,errors.New("KMS unavailable")};return ed25519.Sign(s.key,payload),nil}
func TestC048ScheduledSigningRotationAndEmergency(t *testing.T){
 now:=time.Date(2026,10,11,12,0,0,0,time.UTC)
 public,private,e:=ed25519.GenerateKey(rand.Reader);if e!=nil{t.Fatal(e)}
 c:=NewPublicationControl()
 key:=PublicationKeyState{KeyID:"k1",Environment:"testnet",Domain:"travel",Jurisdiction:"BC",Audience:"420Travel",PublicKey:public,NotBefore:now.Add(-time.Hour),NotAfter:now.Add(time.Hour)}
 if e:=c.RegisterKey(key);e!=nil{t.Fatal(e)}
 m:=Manifest{Schema:"420compliance-policy/v1",PolicyDigest:Digest([]byte("policy")),ReviewDigest:Digest([]byte("review")),Domain:"travel",Jurisdiction:"BC",Audience:"420Travel",Environment:"testnet",KeyID:"k1",Sequence:1,RevocationEpoch:1,EffectiveFrom:now.Add(-time.Minute),EffectiveUntil:now.Add(time.Hour),ReviewExpiresAt:now.Add(time.Hour)}
 signer:=c048Signer{key:private}
 signed,err:=c.SignScheduledManifest(context.Background(),signer,m,now);if err!=nil{t.Fatal(err)}
 if err:=c.VerifyScheduledManifest(signed,now);err!=nil{t.Fatal(err)}
 future:=m;future.EffectiveFrom=now.Add(time.Minute)
 if _,err:=c.SignScheduledManifest(context.Background(),signer,future,now);err==nil{t.Fatal("future scheduled policy signed early")}
 other:=m;other.Environment="production"
 if _,err:=c.SignScheduledManifest(context.Background(),signer,other,now);err==nil{t.Fatal("environment crossover")}
 other=m;other.Domain="delivery"
 if _,err:=c.SignScheduledManifest(context.Background(),signer,other,now);err==nil{t.Fatal("domain crossover")}
 other=m;other.Jurisdiction="ON"
 if _,err:=c.SignScheduledManifest(context.Background(),signer,other,now);err==nil{t.Fatal("region crossover")}
 if _,err:=c.SignScheduledManifest(context.Background(),c048Signer{key:private,fail:true},m,now);err==nil{t.Fatal("signer outage allowed")}
 if err:=c.RegisterKey(key);err==nil{t.Fatal("duplicate key rotation overwrite")}
 pub2,priv2,_:=ed25519.GenerateKey(rand.Reader)
 k2:=key;k2.KeyID="k2";k2.PublicKey=pub2
 if err:=c.RegisterKey(k2);err!=nil{t.Fatal(err)}
 rotated:=m;rotated.KeyID="k2"
 signed2,err:=c.SignScheduledManifest(context.Background(),c048Signer{key:priv2},rotated,now);if err!=nil{t.Fatal(err)}
 if err:=c.CompromiseKey("k1");err!=nil{t.Fatal(err)}
 if err:=c.VerifyScheduledManifest(signed,now);err==nil{t.Fatal("compromised key remains valid")}
 if err:=c.VerifyScheduledManifest(signed2,now);err==nil{t.Fatal("stale epoch after incident remains valid")}
 rotated.RevocationEpoch=2
 signed2,err=c.SignScheduledManifest(context.Background(),c048Signer{key:priv2},rotated,now);if err!=nil{t.Fatal(err)}
 if err:=c.VerifyScheduledManifest(signed2,now);err!=nil{t.Fatal(err)}
 if err:=c.EmergencyHalt("testnet","travel","BC");err!=nil{t.Fatal(err)}
 if err:=c.VerifyScheduledManifest(signed2,now);err==nil{t.Fatal("emergency halt did not invalidate policy")}
 if _,err:=c.SignScheduledManifest(context.Background(),c048Signer{key:priv2},rotated,now);err==nil{t.Fatal("operator minted permission while halted")}
 // Race: emergency halt between preparation and signer return must fail.
 c2:=NewPublicationControl();if err:=c2.RegisterKey(key);err!=nil{t.Fatal(err)}
 interfering:=c048Signer{key:private,onSign:func(){_ = c2.EmergencyHalt("testnet","travel","BC")}}
 if _,err:=c2.SignScheduledManifest(context.Background(),interfering,m,now);err==nil{t.Fatal("halt during signing ignored")}
}
