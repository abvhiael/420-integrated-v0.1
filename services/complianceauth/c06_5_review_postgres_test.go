package complianceauth

import (
 "context"
 "errors"
 "os"
 "strconv"
 "sync"
 "testing"
 "time"
)

func TestC065PostgreSQLConcurrentReviewAndStaleAuthorFencing(t *testing.T){
 dsn:=os.Getenv("COMPLIANCE_POSTGRES_TEST_DSN")
 if dsn==""{t.Fatal("C06.5 requires real PostgreSQL; cannot skip")}
 a,e:=OpenPostgreSQLPublicationStore(dsn);if e!=nil{t.Fatal(e)};defer a.DB.Close()
 b,e:=OpenPostgreSQLPublicationStore(dsn);if e!=nil{t.Fatal(e)};defer b.DB.Close()
 ctx:=context.Background()
 la,lb:=C064PostgreSQLDrafts{DB:a.DB},C064PostgreSQLDrafts{DB:b.DB}
 ra,rb:=C065PostgreSQLReviews{DB:a.DB},C065PostgreSQLReviews{DB:b.DB}
 if e=la.Migrate(ctx);e!=nil{t.Fatal(e)}
 if e=ra.Migrate(ctx);e!=nil{t.Fatal(e)}
 scope:=C064AuthorScope{Tenant:"c065-"+strconv.FormatInt(time.Now().UnixNano(),10),Domain:"delivery",Jurisdiction:"bc"}
 defer func(){
  a.DB.ExecContext(ctx,"DELETE FROM compliance_review_versions WHERE tenant=$1",scope.Tenant)
  a.DB.ExecContext(ctx,"DELETE FROM compliance_review_heads WHERE tenant=$1",scope.Tenant)
  a.DB.ExecContext(ctx,"DELETE FROM compliance_author_versions WHERE tenant=$1",scope.Tenant)
  a.DB.ExecContext(ctx,"DELETE FROM compliance_author_heads WHERE tenant=$1",scope.Tenant)
 }()
 now:=time.Now().UTC()
 req:=c064FixtureRequest()
 cited,digest,e:=c064Resolve(ctx,c064TestSource{},c064FixtureScope,req.Citations,now)
 if e!=nil{t.Fatal(e)}
 schema:=req.Schema;schema.SourceDigest=digest
 first,e:=la.Save(ctx,scope,"draft1","author-a",0,schema,cited,now)
 if e!=nil{t.Fatal(e)}
 record:=C065ReviewRecord{Scope:scope,DraftID:"draft1",Revision:1,DocumentDigest:first.DocumentDigest,
 ReviewerID:"independent-reviewer",ImpactDigest:Digest([]byte("impact")),State:"FINDINGS_OPEN",At:now}
 const writers=24
 var wg sync.WaitGroup
 var mu sync.Mutex
 wins:=0
 for i:=0;i<writers;i++{wg.Add(1);go func(i int){
  defer wg.Done();s:=ra;if i%2==0{s=rb}
  _,err:=s.AppendIfCurrent(ctx,record,1,0)
  if err==nil{mu.Lock();wins++;mu.Unlock()}else if !errors.Is(err,ErrC065Conflict){t.Errorf("unexpected concurrent error: %v",err)}
 }(i)}
 wg.Wait()
 if wins!=1{t.Fatalf("expected one CAS winner, got %d",wins)}
 var versions int
 if e=a.DB.QueryRowContext(ctx,"SELECT count(*) FROM compliance_review_versions WHERE tenant=$1",scope.Tenant).Scan(&versions);e!=nil||versions!=1{t.Fatalf("append-only cardinality %d: %v",versions,e)}
 if _,e=rb.AppendIfCurrent(ctx,record,1,0);!errors.Is(e,ErrC065Conflict){t.Fatalf("replay accepted: %v",e)}
 record.ReviewerID="author-a"
 if _,e=rb.AppendIfCurrent(ctx,record,1,1);!errors.Is(e,ErrC065Conflict){t.Fatalf("self-review accepted: %v",e)}
 record.ReviewerID="independent-reviewer"
 other:=record;other.Scope.Tenant="other-tenant"
 if _,e=rb.AppendIfCurrent(ctx,other,1,1);!errors.Is(e,ErrC065Conflict){t.Fatalf("cross-tenant replay accepted: %v",e)}
 schema.Hours.EndLocal="18:00"
 if _,e=lb.Save(ctx,scope,"draft1","author-a",1,schema,cited,now);e!=nil{t.Fatal(e)}
 if _,e=ra.AppendIfCurrent(ctx,record,1,1);!errors.Is(e,ErrC065Conflict){t.Fatalf("stale document accepted: %v",e)}
 if e=a.DB.QueryRowContext(ctx,"SELECT count(*) FROM compliance_review_versions WHERE tenant=$1",scope.Tenant).Scan(&versions);e!=nil||versions!=1{t.Fatalf("immutable review lost: %d %v",versions,e)}
 cancelled,cancel:=context.WithCancel(ctx);cancel()
 if _,e=ra.AppendIfCurrent(cancelled,record,1,1);e==nil{t.Fatal("cancelled transaction accepted")}
}
