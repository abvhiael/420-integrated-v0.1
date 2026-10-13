package complianceauth

import (
 "context"
 "database/sql"
 _ "embed"
 "time"
)

//go:embed migrations/0004_auditor_access.sql
var C067AuditSchemaSQL string
type C067PostgreSQLAccessLog struct{DB *sql.DB; Cipher *C071Cipher}
func(s C067PostgreSQLAccessLog)Migrate(ctx context.Context)error{
 if s.DB==nil||ctx==nil||ctx.Err()!=nil{return ErrUnavailable}
 _,err:=s.DB.ExecContext(ctx,C067AuditSchemaSQL)
 return err
}
func(s C067PostgreSQLAccessLog)AppendDurable(ctx context.Context,a C067AuditAccess)error{
 if s.DB==nil||ctx==nil||ctx.Err()!=nil||!c064ID.MatchString(a.Actor)||
 !c064ID.MatchString(a.CaseID)||!c064ID.MatchString(a.EvidenceID)||
 !c051Scope(a.Scope.Tenant)||!c051Scope(a.Scope.Domain)||!c051Scope(a.Scope.Jurisdiction)||
 len(a.Purpose)>C071MaxPrivateBytes||a.Result!="EXPORTED_REDACTED"||a.Time.IsZero()||a.Time.After(time.Now().Add(time.Minute)) {
  return ErrC067Denied
 }
 purpose:=a.Purpose
 if s.Cipher!=nil {
  encrypted,err:=c071Encode(s.Cipher,a.Purpose,c071AAD("audit",C064AuthorScope{Tenant:a.Scope.Tenant,Domain:a.Scope.Domain,Jurisdiction:a.Scope.Jurisdiction},a.CaseID+"|"+a.Actor+"|"+a.EvidenceID,0))
  if err!=nil{return ErrUnavailable};purpose=string(encrypted)
 }
 tx,err:=s.DB.BeginTx(ctx,&sql.TxOptions{Isolation:sql.LevelReadCommitted})
 if err!=nil{return ErrUnavailable}
 defer tx.Rollback()
 var standby bool
 if err=tx.QueryRowContext(ctx,"SELECT pg_is_in_recovery()").Scan(&standby);err!=nil||standby{return ErrUnavailable}
 _,err=tx.ExecContext(ctx,`INSERT INTO compliance_auditor_access
 (tenant,domain,jurisdiction,case_id,actor_id,evidence_id,purpose,result,occurred_at)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
 a.Scope.Tenant,a.Scope.Domain,a.Scope.Jurisdiction,a.CaseID,a.Actor,a.EvidenceID,purpose,a.Result,a.Time)
 if err!=nil||ctx.Err()!=nil{return ErrUnavailable}
 if err=tx.Commit();err!=nil{return ErrUnavailable}
 return nil
}
var _ C067AccessLog = C067PostgreSQLAccessLog{}
