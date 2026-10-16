package complianceauth
import("context";"errors";"os";"path/filepath";"testing";"time")
type refusingPublisher struct{}
func(refusingPublisher) VerifyPublication(context.Context,PublicationFence,PublicationFence)error{return errors.New("independent legal approval absent")}
func TestC038ProductionRuntimeGates(t *testing.T){
 dir:=t.TempDir();cert:=filepath.Join(dir,"ca.crt");if err:=os.WriteFile(cert,[]byte("fixture"),0600);err!=nil{t.Fatal(err)}
 raw:="postgres://service:secret@localhost:5432/db?sslmode=verify-full&connect_timeout=5&sslrootcert="+cert
 if err:=ValidProductionDSN(raw);err!=nil{t.Fatal(err)}
 for _,dsn:=range []string{"", "postgres://service:secret@localhost/db?sslmode=disable&connect_timeout=5&sslrootcert="+cert,"postgres://service@localhost/db?sslmode=verify-full&connect_timeout=5&sslrootcert="+cert,"postgres://service:secret@localhost/db?sslmode=verify-full&connect_timeout=5&sslrootcert=/missing/ca"}{
  if ValidProductionDSN(dsn)==nil{t.Fatalf("unsafe DSN accepted: %s",dsn)}
 }
 if _,err:=OpenProductionPublicationRuntime(context.Background(),raw,nil);err==nil{t.Fatal("missing independent publisher accepted")}
 rt:=&ProductionPublicationRuntime{Store:&PostgreSQLPublicationStore{},Cache:&PublicationCache{},Publisher:refusingPublisher{}}
 previous:=PublicationFence{Scope:"fixture",Sequence:1,RevocationEpoch:1,PolicyDigest:Digest([]byte("old")),DependencyDigest:Digest([]byte("dependency")),ExpiresAt:time.Now().Add(time.Hour)}
 next:=previous;next.Sequence++
 if err:=rt.Publish(context.Background(),previous,next,time.Now());err==nil{t.Fatal("publisher refusal bypassed")}
 if _,err:=rt.Current(context.Background(),previous,time.Now());err==nil{t.Fatal("invalid database accepted")}
}
