package complianceauth

import (
 "context"
 "database/sql"
 "os"
 "testing"
 "time"
 _ "github.com/lib/pq"
)
func TestC077PostgreSQLMonotonicMonitoring(t *testing.T){
 dsn:=os.Getenv("COMPLIANCE_POSTGRES_TEST_DSN");if dsn==""{t.Fatal("PostgreSQL required")}
 db,e:=sql.Open("postgres",dsn);if e!=nil{t.Fatal(e)};defer db.Close()
 ctx,cancel:=context.WithTimeout(context.Background(),20*time.Second);defer cancel()
 if _,e=db.ExecContext(ctx,C077TelemetrySQL);e!=nil{t.Fatal(e)}
 scope:="c077-fixture-"+time.Now().UTC().Format("150405.000000000")
 t.Cleanup(func(){db.Exec("DELETE FROM public.compliance_monitoring WHERE scope=$1",scope)})
 o:=C077Observation{Scope:scope,Metric:C077SourceFreshness,ObservedAt:time.Now().UTC(),Value:15,Samples:3}
 s:=C077SQLStore{DB:db}
 if e=s.RecordC077(ctx,o);e!=nil{t.Fatal(e)}
 if e=s.RecordC077(ctx,o);e==nil{t.Fatal("duplicate observation accepted")}
 older:=o;older.ObservedAt=older.ObservedAt.Add(-time.Minute)
 if e=s.RecordC077(ctx,older);e==nil{t.Fatal("stale telemetry overwrote current")}
 wrong:=o;wrong.Scope=scope+"-other";wrong.Value=77
 if e=s.RecordC077(ctx,wrong);e!=nil{t.Fatal(e)}
 rows,e:=s.ReadC077(ctx,scope);if e!=nil||len(rows)!=1||rows[0].Value!=15{t.Fatal("scope-isolated telemetry read",e)}
 o.ObservedAt=o.ObservedAt.Add(time.Millisecond);o.Value=100
 if e=s.RecordC077(ctx,o);e!=nil{t.Fatal("newer observation denied",e)}
 limits:=map[C077Metric]C077Threshold{}
 for _,metric:=range c077Metrics{limits[metric]=C077Threshold{Warn:30,Critical:80,MaxAge:time.Minute}}
 snap,e:=(C077Monitor{Source:s,Limits:limits,Now:time.Now}).EvaluateC077(ctx,scope)
 if e!=nil||snap.Overall!="CRITICAL"{t.Fatal("missing/stale signals must not show OK",e)}
}
