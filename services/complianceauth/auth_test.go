package complianceauth
import("crypto/ed25519";"crypto/rand";"errors";"strings";"testing";"time")
func TestPublicationDiscoveryAndFailClosedAuthorization(t *testing.T){
 pub,priv,err:=ed25519.GenerateKey(rand.Reader);if err!=nil{t.Fatal(err)}
 now:=time.Date(2026,10,10,12,0,0,0,time.UTC)
 m:=Manifest{Schema:"420compliance-policy/v1",PolicyDigest:Digest([]byte("policy")),ReviewDigest:Digest([]byte("review")),Domain:"delivery",Jurisdiction:"BC",Audience:"doobr",Environment:"test",KeyID:"key-a",Sequence:2,RevocationEpoch:4,EffectiveFrom:now.Add(-time.Hour),EffectiveUntil:now.Add(time.Hour),ReviewExpiresAt:now.Add(time.Hour)}
 a:=Approval{Digest:m.PolicyDigest,AuthorID:"author",ReviewerID:"reviewer",PublisherID:"publisher",IndependentlyVerified:true}
 signed,err:=Publish(m,a,priv);if err!=nil{t.Fatal(err)}
 trust:=Trust{Keys:map[string]Key{"key-a":{Public:pub,Environment:"test"}},MinimumSequence:2,MinimumEpoch:4,Environment:"test",Audience:"doobr",Domain:"delivery",Jurisdiction:"BC"}
 if err=trust.Verify(signed,now);err!=nil{t.Fatal(err)}
 dir:=Directory{Environment:"test",AllowedHosts:map[string]bool{"compliance.internal":true},Entries:map[string]Endpoint{"eval":{Name:"eval",URL:"https://compliance.internal/v1/evaluations",Audience:"doobr",Environment:"test",ExpiresAt:now.Add(time.Hour)}}}
 if _,err=dir.Resolve("eval","doobr",now);err!=nil{t.Fatal(err)}
 gate:=PolicyGate{Trust:trust,Discovery:dir,Enabled:true,LegalApproval:true,PartnerApproval:true,RuntimeAccepted:true}
 if !errors.Is(gate.Authorize(signed,"eval",now),ErrUnauthorized){t.Fatal("runtime must remain fail closed")}
 bad:=signed;bad.Manifest.PolicyDigest=Digest([]byte("tampered"));if trust.Verify(bad,now)==nil{t.Fatal("tampered accepted")}
 for _,tc:=range []struct{name string;change func(*Trust,*SignedManifest,time.Time)*time.Time}{
 {"wrong audience",func(x *Trust,_ *SignedManifest,_ time.Time)*time.Time{x.Audience="travel";return nil}},
 {"wrong environment",func(x *Trust,_ *SignedManifest,_ time.Time)*time.Time{x.Environment="prod";return nil}},
 {"revoked",func(x *Trust,_ *SignedManifest,_ time.Time)*time.Time{k:=x.Keys["key-a"];k.Revoked=true;x.Keys["key-a"]=k;return nil}},
 {"replay",func(x *Trust,_ *SignedManifest,_ time.Time)*time.Time{x.MinimumSequence=3;return nil}},
 {"epoch",func(x *Trust,_ *SignedManifest,_ time.Time)*time.Time{x.MinimumEpoch=5;return nil}},
 {"expiry",func(_ *Trust,_ *SignedManifest,tm time.Time)*time.Time{n:=tm.Add(2*time.Hour);return &n}},
 {"wrong domain",func(x *Trust,_ *SignedManifest,_ time.Time)*time.Time{x.Domain="travel";return nil}},
 }{t.Run(tc.name,func(t *testing.T){x:=trust;y:=signed;tm:=now;if override:=tc.change(&x,&y,tm);override!=nil{tm=*override};if x.Verify(y,tm)==nil{t.Fatal("accepted invalid policy")}})}
 for _,tc:=range []struct{name string;url string}{{"http","http://compliance.internal"},{"userinfo","https://evil@compliance.internal"},{"untrusted","https://bad.example"},{"query","https://compliance.internal/?token=secret"}}{t.Run(tc.name,func(t *testing.T){x:=dir;e:=x.Entries["eval"];e.URL=tc.url;x.Entries=map[string]Endpoint{"eval":e};if _,err:=x.Resolve("eval","doobr",now);err==nil{t.Fatal("accepted unsafe discovery")}})}
 if _,err:=dir.Resolve("eval","travel",now);err==nil{t.Fatal("cross audience")}
 a.ReviewerID=a.AuthorID;if _,err:=Publish(m,a,priv);err==nil{t.Fatal("self approval")}
 a.ReviewerID="reviewer";a.Digest=strings.Repeat("0",64);if _,err:=Publish(m,a,priv);err==nil{t.Fatal("changed review digest")}
}
