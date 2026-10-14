package complianceauth

import (
 "context"
 "os"
 "strconv"
 "testing"
 "time"
)
func TestC067PostgreSQLDurableAuditAccess(t *testing.T){
 dsn:=os.Getenv("COMPLIANCE_POSTGRES_TEST_DSN")
 if dsn==""{t.Fatal("real PostgreSQL mandatory for C06.7 audit qualification")}
 a,err:=OpenPostgreSQLPublicationStore(dsn);if err!=nil{t.Fatal(err)}
 defer a.DB.Close()
 b,err:=OpenPostgreSQLPublicationStore(dsn);if err!=nil{t.Fatal(err)}
 defer b.DB.Close()
 s:=C067PostgreSQLAccessLog{DB:a.DB}
 ctx:=context.Background()
 if err:=s.Migrate(ctx);err!=nil{t.Fatal(err)}
 tenant:="c067-"+strconv.FormatInt(time.Now().UnixNano(),10)
 defer a.DB.ExecContext(ctx,"DELETE FROM compliance_auditor_access WHERE tenant=$1",tenant)
 record:=C067AuditAccess{Actor:"auditor1",CaseID:"case1",Scope:C064AuthorScope{Tenant:tenant,Domain:"travel",Jurisdiction:"BC"},EvidenceID:"evidence1",Purpose:"LEGAL_AUDIT",Result:"EXPORTED_REDACTED",Time:time.Now().UTC()}
 if err:=s.AppendDurable(ctx,record);err!=nil{t.Fatal(err)}
 var count int
 if err:=b.DB.QueryRowContext(ctx,`SELECT count(*) FROM compliance_auditor_access WHERE tenant=$1 AND case_id=$2`,tenant,"case1").Scan(&count);err!=nil||count!=1{t.Fatalf("independent connection access log %d %v",count,err)}
 invalid:=record;invalid.Actor=""
 if s.AppendDurable(ctx,invalid)==nil{t.Fatal("invalid actor recorded")}
 cancelled,cancel:=context.WithCancel(ctx);cancel()
 if s.AppendDurable(cancelled,record)==nil{t.Fatal("cancelled logging allowed")}
 if err:=a.DB.Close();err!=nil{t.Fatal(err)}
 if s.AppendDurable(ctx,record)==nil{t.Fatal("database outage treated as logged export")}
}
