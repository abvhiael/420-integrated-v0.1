package complianceauth
import("context";"os";"testing";"time")
func TestC038DatabaseOutageAndReconnect(t *testing.T){
 dsn:=os.Getenv("COMPLIANCE_POSTGRES_TEST_DSN")
 if dsn==""{t.Skip("PostgreSQL CI service required")}
 ctx:=context.Background()
 primary,e:=OpenPostgreSQLPublicationStore(dsn);if e!=nil{t.Fatal(e)}
 secondary,e:=OpenPostgreSQLPublicationStore(dsn);if e!=nil{t.Fatal(e)};defer secondary.DB.Close()
 scope:="outage/"+time.Now().UTC().Format("20060102150405.000000000")
 fence:=PublicationFence{Scope:scope,Sequence:1,RevocationEpoch:1,PolicyDigest:Digest([]byte("policy")),DependencyDigest:Digest([]byte("deps")),ExpiresAt:time.Now().Add(time.Hour).Truncate(time.Microsecond)}
 defer secondary.DB.ExecContext(ctx,"DELETE FROM compliance_publication_fences WHERE scope=$1",scope)
 if ok,e:=primary.Bootstrap(ctx,fence);e!=nil||!ok{t.Fatal("bootstrap",e)}
 if e:=primary.DB.Close();e!=nil{t.Fatal(e)}
 if _,e:=(&PublicationCache{}).ReadCurrent(ctx,primary,fence,time.Now());e==nil{t.Fatal("outage served stale cache")}
 if _,e:=secondary.Load(ctx,scope);e!=nil{t.Fatal("reconnected independent pool cannot read durable state",e)}
 next:=fence;next.Sequence=2;next.RevocationEpoch=2
 if ok,e:=secondary.CompareAndSwap(ctx,scope,fence,next);e!=nil||!ok{t.Fatal("post outage CAS",e)}
 reopened,e:=OpenPostgreSQLPublicationStore(dsn);if e!=nil{t.Fatal(e)};defer reopened.DB.Close()
 if got,e:=reopened.Load(ctx,scope);e!=nil||got!=next{t.Fatalf("durability across reconnect %+v %v",got,e)}
}
