package publisher

import (
 "context"
 "crypto/sha256"
 "encoding/hex"
 "errors"
 "os"
 "path/filepath"
 "strings"
 "testing"
 "time"
)

type principal struct{ identity string; err error }
func(p principal)AuthenticatedOperator(context.Context)(string,error){return p.identity,p.err}
func stableClock()time.Time{return time.Date(2026,9,21,1,0,0,0,time.UTC)}
func trustedPolicy()TrustPolicy{return TrustPolicy{
 Resolver:principal{identity:"reviewer"},Clock:stableClock,
 Operators:[]OperatorGrant{{ID:"reviewer",Enabled:true,Actions:[]Action{Approve,Withdraw,Reject},Kinds:[]Kind{Place,Event}}},
 Sources:[]SourceGrant{{Namespace:"provider-A",Enabled:true,Kinds:[]Kind{Place,Event},ManifestID:"manifest-1",TermsRef:"terms-1",AttributionRef:"attribution-1",NotBefore:stableClock().Add(-time.Hour),NotAfter:stableClock().Add(time.Hour)}},
}}
func TestDurableAuditReloadTamperAndWithdrawal(t *testing.T){
 ctx:=context.Background();p:=trustedPolicy();path:=filepath.Join(t.TempDir(),"audit.json");key:=[]byte(strings.Repeat("a",32))
 d,err:=NewTrustedDurableLedger(path,key,p);if err!=nil{t.Fatal(err)}
 c:=candidate();if err=d.ImportCandidate(ctx,c);err!=nil{t.Fatal(err)}
 r,err:=d.Decide(ctx,decision(c,Approve,0));if err!=nil||r.State!=Approved{t.Fatalf("approve: %v",err)}
 r,err=d.Decide(ctx,decision(c,Withdraw,1));if err!=nil||r.State!=Withdrawn{t.Fatalf("withdraw: %v",err)}
 seq,head:=d.AuditHead();if seq!=3||head==""{t.Fatalf("bad audit head %d %q",seq,head)}
 restored,err:=NewTrustedDurableLedger(path,key,p);if err!=nil{t.Fatal(err)}
 got,ok:=restored.Get(c.ID);if !ok||got.State!=Withdrawn{t.Fatalf("tombstone lost on restart: %+v",got)}
 if e:=restored.ImportCandidate(ctx,c);!errors.Is(e,ErrConflict){t.Fatalf("reimport revived record: %v",e)}
 if seq2,head2:=restored.AuditHead();seq2!=seq||head2!=head{t.Fatal("audit head changed on reload")}
 bytes,err:=os.ReadFile(path);if err!=nil{t.Fatal(err)}
 corrupted:=strings.Replace(string(bytes),"withdrawn","approved",1)
 if corrupted==string(bytes){t.Fatal("test did not alter journal")}
 if err=os.WriteFile(path,[]byte(corrupted),0600);err!=nil{t.Fatal(err)}
 if _,err=NewTrustedDurableLedger(path,key,p);err==nil{t.Fatal("tampered journal accepted")}
}
func TestDeploymentTrustRejectsSpoofAndRevocation(t *testing.T){
 ctx:=context.Background();p:=trustedPolicy();c:=candidate()
 if err:=p.Authorize(ctx,"another",Approve,Place);!errors.Is(err,ErrUnauthorized){t.Fatalf("spoof accepted: %v",err)}
 if err:=p.VerifySource(ctx,c.Source,Place);err!=nil{t.Fatal(err)}
 c.Source.ManifestID="untrusted";if err:=p.VerifySource(ctx,c.Source,Place);!errors.Is(err,ErrUntrustedSource){t.Fatalf("manifest spoof accepted: %v",err)}
 c=candidate();p.Sources[0].Enabled=false
 if err:=p.VerifySource(ctx,c.Source,Place);!errors.Is(err,ErrUntrustedSource){t.Fatalf("revoked source accepted: %v",err)}
 p=trustedPolicy();p.Operators[0].Enabled=false
 if err:=p.Authorize(ctx,"reviewer",Approve,Place);!errors.Is(err,ErrUnauthorized){t.Fatalf("revoked operator accepted: %v",err)}
 if _,err:=NewTrustedDurableLedger(filepath.Join(t.TempDir(),"audit"),[]byte("short"),p);err==nil{t.Fatal("weak audit key accepted")}
}
func TestDurableJournalDeniedMutationDoesNotPersist(t *testing.T){
 ctx:=context.Background();p:=trustedPolicy();path:=filepath.Join(t.TempDir(),"audit.json")
 d,err:=NewTrustedDurableLedger(path,[]byte(strings.Repeat("b",32)),p);if err!=nil{t.Fatal(err)}
 c:=candidate();if err=d.ImportCandidate(ctx,c);err!=nil{t.Fatal(err)}
 before,_:=d.AuditHead()
 unauthorized:=decision(c,Approve,0);unauthorized.OperatorID="spoofed"
 if _,err=d.Decide(ctx,unauthorized);!errors.Is(err,ErrUnauthorized){t.Fatalf("spoofed decision accepted: %v",err)}
 after,_:=d.AuditHead();if before!=after{t.Fatal("rejected decision persisted")}
 r,_:=d.Get(c.ID);if r.State!=Pending{t.Fatal("denied decision mutated staging state")}
}
func TestCanonicalDigestDeterministic(t *testing.T){
 a,err:=canonicalDigest(struct{ID string}{"place"});if err!=nil{t.Fatal(err)}
 b:=sha256.Sum256([]byte(`{"ID":"place"}`));if a!=hex.EncodeToString(b[:]){t.Fatal("canonical digest mismatch")}
}
