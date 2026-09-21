package travelapp

import (
 "context"
 "database/sql"
 "database/sql/driver"
 "errors"
 "io"
 "strings"
 "sync"
 "testing"
 "time"
)

type tripsSQLTestDriver struct{mu sync.Mutex;queries []string;args [][]driver.NamedValue}
func (d *tripsSQLTestDriver) Open(string)(driver.Conn,error){return &tripsSQLTestConn{d:d},nil}
type tripsSQLTestConn struct{d *tripsSQLTestDriver}
func (c *tripsSQLTestConn) Prepare(string)(driver.Stmt,error){return nil,errors.New("prepare forbidden")}
func (c *tripsSQLTestConn) Close()error{return nil}
func (c *tripsSQLTestConn) Begin()(driver.Tx,error){return nil,errors.New("implicit transaction forbidden")}
func (c *tripsSQLTestConn) record(query string,args []driver.NamedValue){c.d.mu.Lock();defer c.d.mu.Unlock();c.d.queries=append(c.d.queries,query);c.d.args=append(c.d.args,append([]driver.NamedValue(nil),args...))}
func (c *tripsSQLTestConn) QueryContext(_ context.Context,q string,args []driver.NamedValue)(driver.Rows,error){c.record(q,args);return &tripsSQLTestRows{},nil}
func (c *tripsSQLTestConn) ExecContext(_ context.Context,q string,args []driver.NamedValue)(driver.Result,error){c.record(q,args);return driver.RowsAffected(0),nil}
type tripsSQLTestRows struct{}
func (*tripsSQLTestRows) Columns()[]string{return []string{"id","owner_id","title","visibility","place_ids","event_ids","created_at","updated_at"}}
func (*tripsSQLTestRows) Close()error{return nil}
func (*tripsSQLTestRows) Next([]driver.Value)error{return io.EOF}

func TestSQLTripsQueriesBindIdentityOwnerAndFailClosed(t *testing.T){
 d:=&tripsSQLTestDriver{}
 // Registration name must be unique for the Go test process.
 sql.Register("travel-sql-contract",d)
 db,err:=sql.Open("travel-sql-contract","");if err!=nil{t.Fatal(err)};defer db.Close()
 s,err:=NewSQLTripRepository(db);if err!=nil{t.Fatal(err)}
 ctx:=context.Background()
 if _,err:=s.GetOwned(ctx,"alice","trip-a");!errors.Is(err,ErrTripNotFound){t.Fatalf("missing owned record: %v",err)}
 if _,err:=s.ListOwned(ctx,"alice");err!=nil{t.Fatal(err)}
 if _,err:=s.Replace(ctx,"alice",Trip{ID:"trip-a",Title:"plan",Visibility:TripPrivate,UpdatedAt:time.Now()});!errors.Is(err,ErrTripNotFound){t.Fatalf("missing owner-scoped update: %v",err)}
 if err:=s.Delete(ctx,"alice","trip-a");!errors.Is(err,ErrTripNotFound){t.Fatalf("missing owner-scoped delete: %v",err)}
 if _,err:=s.ListPublic(ctx);err!=nil{t.Fatal(err)}
 if len(d.queries)!=5{t.Fatalf("queries=%d want 5",len(d.queries))}
 for i,q:=range d.queries[:4]{if !strings.Contains(q,"owner_id=$1")||len(d.args[i])==0||d.args[i][0].Value!="alice"{t.Fatalf("query %d not identity scoped: %s %+v",i,q,d.args[i])}}
 if !strings.Contains(d.queries[4],"visibility='PUBLIC'"){t.Fatal("public listing does not exclude private/unlisted")}
 before:=len(d.queries)
 if _,err:=s.GetOwned(ctx,"","trip-a");!errors.Is(err,ErrTripUnauthorized){t.Fatal(err)}
 if err:=s.Delete(ctx," bob ","trip-a");!errors.Is(err,ErrTripUnauthorized){t.Fatal(err)}
 if _,err:=s.Replace(ctx,"alice",Trip{ID:"trip-a",Title:"plan",Visibility:TripPrivate});!errors.Is(err,ErrTripConflict){t.Fatal("stale update should fail without version",err)}
 if len(d.queries)!=before{t.Fatal("unauthorized/stale operations reached SQL")}
 if _,err:=NewSQLTripRepository(nil);err==nil{t.Fatal("nil DB accepted")}
}
