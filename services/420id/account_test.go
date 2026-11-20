package account

import (
 "context"
 "database/sql"
 "encoding/json"
 "errors"
 "os"
 "strings"
 "sync"
 "testing"

 _ "github.com/lib/pq"
)

func TestIdentifiersAndConfiguration(t *testing.T) {
 for i:=0;i<100;i++{id,e:=newID();if e!=nil||!validID(id){t.Fatalf("invalid random ID %q: %v",id,e)}}
 for _,bad:=range []string{"","0x"+strings.Repeat("a",40),"../bong-goggles","00000000-0000-0000-0000-000000000000"}{if validID(bad){t.Fatal("accepted invalid ID")}}
 db:=new(sql.DB)
 for _,bad:=range [][]string{nil,{"BongGoggles"},{"bong-goggles","bong-goggles"},{"../app"}}{if _,e:=NewStore(db,bad);!errors.Is(e,ErrInvalid){t.Fatal("accepted bad configuration",bad,e)}}
 apps:=[]string{"bong-goggles"};s,e:=NewStore(db,apps);if e!=nil{t.Fatal(e)};apps[0]="evil";if s.allowed("evil")||!s.allowed("bong-goggles"){t.Fatal("mutable app approval")}
}
func TestPostgresAccountArchitecture(t *testing.T) {
 dsn:=os.Getenv("ACCOUNT420_TEST_DSN")
 if dsn==""{t.Fatal("ACCOUNT420_TEST_DSN is required for durable qualification")}
 db,e:=sql.Open("postgres",dsn);if e!=nil{t.Fatal(e)};defer db.Close()
 ctx:=context.Background();if e=db.PingContext(ctx);e!=nil{t.Fatal(e)}
 if _,e=db.ExecContext(ctx,"DROP SCHEMA IF EXISTS account420 CASCADE");e!=nil{t.Fatal(e)}
 if e=Migrate(ctx,db);e!=nil{t.Fatal(e)};if e=Migrate(ctx,db);e!=nil{t.Fatal(e)}
 s,e:=NewStore(db,[]string{"bong-goggles","doobtube"});if e!=nil{t.Fatal(e)}
 a,e:=s.Provision(ctx);if e!=nil||a.Status!=Active||a.Revision!=1{t.Fatal(a,e)}
 b,e:=s.Provision(ctx);if e!=nil||a.ID==b.ID{t.Fatal(b,e)}
 first,e:=s.Enroll(ctx,a.ID,"bong-goggles");if e!=nil{t.Fatal(e)}
 second,e:=s.Enroll(ctx,a.ID,"doobtube");if e!=nil||second.ID==first.ID{t.Fatal(second,e)}
 third,e:=s.Enroll(ctx,b.ID,"bong-goggles");if e!=nil||third.ID==first.ID{t.Fatal(third,e)}
 if string(a.ID)==first.ID{t.Fatal("internal ID disclosed")}
 body,_:=json.Marshal(first);if strings.Contains(string(body),string(a.ID))||strings.Contains(string(body),"wallet"){t.Fatal(string(body))}
 if _,e=s.Resolve(ctx,Subject{App:"doobtube",ID:first.ID});!errors.Is(e,ErrUnavailable){t.Fatal("cross-app substitution",e)}
 if _,e=s.Enroll(ctx,a.ID,"unapproved");!errors.Is(e,ErrInvalid){t.Fatal(e)}
 if _,e=s.Enroll(ctx,AccountID("0x"+strings.Repeat("a",40)),"bong-goggles");!errors.Is(e,ErrInvalid){t.Fatal(e)}
 // Independent database handle and concurrent enrollment must converge.
 db2,e:=sql.Open("postgres",dsn);if e!=nil{t.Fatal(e)};defer db2.Close()
 s2,e:=NewStore(db2,[]string{"bong-goggles","doobtube"});if e!=nil{t.Fatal(e)}
 var wg sync.WaitGroup
 for i:=0;i<16;i++{wg.Add(1);go func(){defer wg.Done();got,err:=s2.Enroll(ctx,a.ID,"bong-goggles");if err!=nil||got!=first{t.Errorf("enrollment diverged: %v %v",got,err)}}()};wg.Wait()
 got,e:=s2.Resolve(ctx,first);if e!=nil||got!=a.ID{t.Fatal(got,e)}
 // Direct uniqueness and foreign-key protection.
 if _,e=db.ExecContext(ctx,`INSERT INTO account420.app_subjects(account_id,app_id,subject_id) VALUES($1,'other',$2)`,b.ID,first.ID);e==nil{t.Fatal("duplicate subject accepted")}
 missing,_:=newID();if _,e=db.ExecContext(ctx,`INSERT INTO account420.app_subjects(account_id,app_id,subject_id) VALUES($1,'other',$2)`,missing,missing);e==nil{t.Fatal("orphan subject accepted")}
 suspended,e:=s.Transition(ctx,a.ID,1,Suspended);if e!=nil||suspended.Revision!=2{t.Fatal(suspended,e)}
 if _,e=s2.Resolve(ctx,first);!errors.Is(e,ErrUnavailable){t.Fatal("suspended account resolved",e)}
 if _,e=s.Enroll(ctx,a.ID,"doobtube");!errors.Is(e,ErrUnavailable){t.Fatal("suspended enrollment",e)}
 if _,e=s.Transition(ctx,a.ID,1,Active);!errors.Is(e,ErrConflict){t.Fatal("stale transition",e)}
 active,e:=s.Transition(ctx,a.ID,2,Active);if e!=nil||active.Revision!=3{t.Fatal(active,e)}
 same,e:=s2.Enroll(ctx,a.ID,"bong-goggles");if e!=nil||same!=first{t.Fatal("identity changed",same,e)}
 closed,e:=s.Transition(ctx,a.ID,3,Closed);if e!=nil||closed.Status!=Closed{t.Fatal(closed,e)}
 if _,e=s.Transition(ctx,a.ID,4,Active);!errors.Is(e,ErrConflict){t.Fatal("terminal reopened",e)}
 if _,e=s2.Resolve(ctx,second);!errors.Is(e,ErrUnavailable){t.Fatal("closed account resolved",e)}
 other,e:=s2.Resolve(ctx,third);if e!=nil||other!=b.ID{t.Fatal("unrelated account impacted",other,e)}
}
