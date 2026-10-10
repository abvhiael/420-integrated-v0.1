package complianceauth

import (
 "context"
 "database/sql"
 "os"
 "sync"
 "testing"
 "time"
)

func TestC038PostgreSQLMultiInstance(t *testing.T){
 dsn:=os.Getenv("COMPLIANCE_POSTGRES_TEST_DSN")
 if dsn==""{t.Skip("PostgreSQL integration requires COMPLIANCE_POSTGRES_TEST_DSN")}
 ctx:=context.Background()
 a,err:=OpenPostgreSQLPublicationStore(dsn);if err!=nil{t.Fatal(err)};defer a.DB.Close()
 b,err:=OpenPostgreSQLPublicationStore(dsn);if err!=nil{t.Fatal(err)};defer b.DB.Close()
 if err:=a.DB.PingContext(ctx);err!=nil{t.Fatal(err)}
 if err:=a.Migrate(ctx);err!=nil{t.Fatal(err)}
 if err:=b.Migrate(ctx);err!=nil{t.Fatal(err)}
 scope:="qualification/"+time.Now().UTC().Format("20060102150405.000000000")
 now:=time.Now().UTC()
 first:=PublicationFence{Scope:scope,Sequence:1,RevocationEpoch:1,PolicyDigest:Digest([]byte("first")),DependencyDigest:Digest([]byte("dependency")),ExpiresAt:now.Add(time.Hour).Truncate(time.Microsecond)}
 defer func(){_,_=a.DB.ExecContext(ctx,"DELETE FROM compliance_publication_fences WHERE scope=$1",scope)}()
 created,err:=a.Bootstrap(ctx,first);if err!=nil||!created{t.Fatalf("bootstrap %t %v",created,err)}
 created,err=b.Bootstrap(ctx,first);if err!=nil||created{t.Fatal("duplicate bootstrap",err)}
 old,err:=b.Load(ctx,scope);if err!=nil||old!=first{t.Fatalf("cross-connection load %+v %v",old,err)}
 changed:=first;changed.Sequence=2;changed.RevocationEpoch=2;changed.PolicyDigest=Digest([]byte("new policy"));changed.DependencyDigest=Digest([]byte("new dependency"))
 var wg sync.WaitGroup
 var mu sync.Mutex
 successes:=0
 for i:=0;i<32;i++{wg.Add(1);go func(index int){defer wg.Done();store:=a;if index%2==0{store=b};ok,e:=store.CompareAndSwap(ctx,scope,first,changed);if e!=nil{t.Errorf("CAS error %v",e)};if ok{mu.Lock();successes++;mu.Unlock()}}(i)}
 wg.Wait();if successes!=1{t.Fatalf("concurrent CAS winners %d",successes)}
 cacheA,cacheB:=&PublicationCache{},&PublicationCache{}
 for _,cache:=range []*PublicationCache{cacheA,cacheB}{
  if _,err:=cache.ReadCurrent(ctx,a,first,time.Now().UTC());err==nil{t.Fatal("stale fence served")}
  if _,err:=cache.ReadCurrent(ctx,b,changed,time.Now().UTC());err!=nil{t.Fatal(err)}
 }
 rollback:=changed;rollback.Sequence=3;rollback.RevocationEpoch=1
 if ok,e:=b.CompareAndSwap(ctx,scope,changed,rollback);e==nil||ok{t.Fatal("epoch rollback permitted")}
 modified:=changed;modified.DependencyDigest=Digest([]byte("changed dependency"))
 if ok,_:=a.CompareAndSwap(ctx,scope,modified,rollback);ok{t.Fatal("tampered dependency accepted")}
 if _,err:=a.Load(ctx,scope+"/missing");err==nil||err==sql.ErrNoRows{t.Fatal("missing publication must fail closed")}
}
