package complianceauth

import (
 "context"
 "crypto/tls"
 "encoding/json"
 "net/http"
 "net/http/httptest"
 "testing"
 "time"
)
type c052Tokens struct{ bad bool }
func(t c052Tokens)Token(context.Context,string)(string,error){if t.bad{return "",ErrUnavailable};return "trusted-service-token",nil}
func TestC052ProviderBoundariesRevocationAndPrivacy(t *testing.T){
 now:=time.Date(2026,10,11,19,0,0,0,time.UTC)
 revoked:=map[string]bool{}
 server:=httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  issuer:=r.Host
  _=issuer
  name:=r.URL.Query().Get("subject")
  if r.URL.Path!="/v1/credentials"||r.Header.Get("Authorization")!="Bearer trusted-service-token"{w.WriteHeader(403);return}
  record:=CredentialAuthorityRecord{Issuer:"trusted",Audience:"internal-compliance",Subject:name,TenantID:r.URL.Query().Get("tenant"),EvidenceReference:"private-evidence-123",EvidenceDigest:Digest([]byte("proof")),ExpiresAt:now.Add(time.Hour),Active:true,Revoked:revoked[name]}
  w.Header().Set("Content-Type","application/json");_=json.NewEncoder(w).Encode(record)
 }))
 defer server.Close()
 client:=server.Client()
 tr:=client.Transport.(*http.Transport).Clone()
 tr.TLSClientConfig=tr.TLSClientConfig.Clone();tr.TLSClientConfig.MinVersion=tls.VersionTLS12
 client.Transport=tr
 makeProvider:=func(name string)CredentialProviderHTTP{return CredentialProviderHTTP{Config:CredentialProviderConfig{Name:name,BaseURL:server.URL,Audience:"internal-compliance",ExpectedIssuer:"trusted",Timeout:time.Second},Client:client,Tokens:c052Tokens{}}}
 p:=makeProvider("Identity")
 if _,e:=p.Fetch(context.Background(),"tenant","subject",now);e!=nil{t.Fatal(e)}
 triplet:=CredentialTriplet{Identity:makeProvider("Identity"),Verify:makeProvider("Verify"),Registry:makeProvider("Registry")}
 result,e:=triplet.Verify(context.Background(),"tenant","subject",now)
 if e!=nil||result.EvidenceDigest==""||result.PrivateReferences[0]==""{t.Fatalf("integration %+v %v",result,e)}
 revoked["subject"]=true
 if _,e:=triplet.Verify(context.Background(),"tenant","subject",now);e==nil{t.Fatal("revocation bypass")}
 delete(revoked,"subject")
 invalid:=p;invalid.Config.ExpectedIssuer="untrusted"
 if _,e:=invalid.Fetch(context.Background(),"tenant","subject",now);e==nil{t.Fatal("issuer mismatch accepted")}
 invalid=p;invalid.Config.BaseURL="http://example.org"
 if _,e:=invalid.Fetch(context.Background(),"tenant","subject",now);e==nil{t.Fatal("insecure URL accepted")}
 invalid=p;invalid.Config.BaseURL=server.URL+"/wrong"
 if _,e:=invalid.Fetch(context.Background(),"tenant","subject",now);e==nil{t.Fatal("path injection accepted")}
 invalid=p;invalid.Tokens=c052Tokens{bad:true}
 if _,e:=invalid.Fetch(context.Background(),"tenant","subject",now);e==nil{t.Fatal("token outage accepted")}
 invalid=p;invalid.Client=&http.Client{}
 if _,e:=invalid.Fetch(context.Background(),"tenant","subject",now);e==nil{t.Fatal("unconfigured transport accepted")}
 invalid=p;invalid.Config.Timeout=0
 if _,e:=invalid.Fetch(context.Background(),"tenant","subject",now);e==nil{t.Fatal("unbounded timeout accepted")}
}
