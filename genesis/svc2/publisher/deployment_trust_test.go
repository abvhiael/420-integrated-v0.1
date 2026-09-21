package publisher

import (
 "context"
 "crypto/sha256"
 "encoding/hex"
 "encoding/json"
 "errors"
 "os"
 "path/filepath"
 "strings"
 "testing"
 "time"
)

func TestDeploymentTrustFailsClosedAndRotatesCredentials(t *testing.T){
 now:=stableClock();clock:=func()time.Time{return now}
 path:=filepath.Join(t.TempDir(),"private-trust.json")
 if _,err:=LoadDeploymentTrust(path,strings.Repeat("0",64),clock);err==nil{t.Fatal("missing config accepted")}
 old:=[]byte(strings.Repeat("x",40));newToken:=[]byte(strings.Repeat("y",40))
 oldSHA:=sha256.Sum256(old);newSHA:=sha256.Sum256(newToken)
 cfg:=DeploymentTrustConfig{Schema:trustSchema,
  Operators:[]OperatorGrant{{ID:"real-operator",Enabled:true,Actions:[]Action{Approve,Withdraw},Kinds:[]Kind{Place}}},
  Sources:[]SourceGrant{{Namespace:"qualified-source",Enabled:true,Kinds:[]Kind{Place},ManifestID:"approved-manifest",TermsRef:"terms",AttributionRef:"attr",NotBefore:now.Add(-time.Hour),NotAfter:now.Add(time.Hour)}},
  Credentials:[]OperatorCredential{{OperatorID:"real-operator",KeyID:"old",SHA256:hex.EncodeToString(oldSHA[:]),Enabled:true,NotBefore:now.Add(-time.Hour),NotAfter:now.Add(time.Hour)},{OperatorID:"real-operator",KeyID:"new",SHA256:hex.EncodeToString(newSHA[:]),Enabled:true,NotBefore:now.Add(-time.Hour),NotAfter:now.Add(time.Hour)}},
 }
 data,err:=json.Marshal(cfg);if err!=nil{t.Fatal(err)}
 if err=os.WriteFile(path,data,0600);err!=nil{t.Fatal(err)}
 pin:=sha256.Sum256(data);digest:=hex.EncodeToString(pin[:])
 p,err:=LoadDeploymentTrust(path,digest,clock);if err!=nil{t.Fatal(err)}
 if err=p.Authorize(context.Background(),"real-operator",Approve,Place);!errors.Is(err,ErrUnauthorized){t.Fatalf("unauthenticated operator accepted: %v",err)}
 for _,pair:=range []struct{key string;secret []byte}{{"old",old},{"new",newToken}}{
  if err=p.Authorize(WithOperatorCredential(context.Background(),pair.key,pair.secret),"real-operator",Approve,Place);err!=nil{t.Fatalf("credential %s denied: %v",pair.key,err)}
 }
 if err=p.Authorize(WithOperatorCredential(context.Background(),"new",old),"real-operator",Approve,Place);!errors.Is(err,ErrUnauthorized){t.Fatalf("wrong token accepted: %v",err)}
 cfg.Credentials[0].Enabled=false
 data,err=json.Marshal(cfg);if err!=nil{t.Fatal(err)}
 if err=os.WriteFile(path,data,0600);err!=nil{t.Fatal(err)}
 if _,err=LoadDeploymentTrust(path,digest,clock);err==nil{t.Fatal("unapproved config change accepted")}
 pin=sha256.Sum256(data);p,err=LoadDeploymentTrust(path,hex.EncodeToString(pin[:]),clock);if err!=nil{t.Fatal(err)}
 if err=p.Authorize(WithOperatorCredential(context.Background(),"old",old),"real-operator",Approve,Place);!errors.Is(err,ErrUnauthorized){t.Fatalf("revoked token accepted: %v",err)}
 if err=p.Authorize(WithOperatorCredential(context.Background(),"new",newToken),"real-operator",Approve,Place);err!=nil{t.Fatalf("new key rejected: %v",err)}
 if err=os.Chmod(path,0644);err!=nil{t.Fatal(err)}
 if _,err=LoadDeploymentTrust(path,hex.EncodeToString(pin[:]),clock);err==nil{t.Fatal("world-readable config accepted")}
}
