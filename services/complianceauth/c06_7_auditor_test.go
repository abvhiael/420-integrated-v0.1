package complianceauth

import (
 "context"
 "errors"
 "testing"
 "time"
)
type c067TestAuthority struct {session C067AuditorSession;err error;calls int}
func(a *c067TestAuthority)VerifyAuditor(context.Context,string)(C067AuditorSession,error){a.calls++;return a.session,a.err}
type c067TestRepo struct {item C067EvidenceItem;err error}
func(a c067TestRepo)Inspect(context.Context,C064AuthorScope,string,string)(C067EvidenceItem,error){return a.item,a.err}
type c067TestLog struct{records []C067AuditAccess;fail bool}
func(a *c067TestLog)AppendDurable(_ context.Context,r C067AuditAccess)error{if a.fail{return ErrUnavailable};a.records=append(a.records,r);return nil}
func TestC067AuditorBoundedRedactedAccess(t *testing.T){
 now:=time.Date(2026,10,12,15,0,0,0,time.UTC)
 scope:=C064AuthorScope{Tenant:"tenant1",Domain:"travel",Jurisdiction:"BC"}
 auth:=&c067TestAuthority{session:C067AuditorSession{SubjectID:"auditor1",SessionID:"session1",CaseID:"case1",Role:"auditor",Scope:scope,ExpiresAt:now.Add(time.Minute)}}
 repo:=c067TestRepo{item:C067EvidenceItem{SourceID:"source1",EvidenceID:"item1",Digest:Digest([]byte("source")),Status:"PARSED_PENDING_REVIEW",ObservedAt:now.Add(-time.Minute)}}
 log:=&c067TestLog{}
 s:=C067AuditorService{Authority:auth,Repository:repo,Log:log,Now:func()time.Time{return now}}
 req:=[]C067EvidenceRequest{{SourceID:"source1",EvidenceID:"item1",Purpose:"LEGAL_AUDIT"}}
 out,err:=s.Export(context.Background(),"long-opaque-session-token",req)
 if err!=nil||len(out.Evidence)!=1||out.PolicyApproved||len(out.ExportDigest)!=64||len(log.records)!=1||auth.calls!=3{t.Fatalf("export %+v %v",out,err)}
 log.fail=true
 if _,err=s.Export(context.Background(),"long-opaque-session-token",req);!errors.Is(err,ErrC067Denied){t.Fatal("logging outage leaked evidence",err)}
 log.fail=false
 auth.session.Role="author"
 if _,err=s.Export(context.Background(),"long-opaque-session-token",req);!errors.Is(err,ErrC067Denied){t.Fatal("author accessed auditor export",err)}
 auth.session.Role="auditor";auth.session.Revoked=true
 if _,err=s.Export(context.Background(),"long-opaque-session-token",req);!errors.Is(err,ErrC067Denied){t.Fatal("revoked auditor accessed export",err)}
 auth.session.Revoked=false
 if _,err=s.Export(context.Background(),"long-opaque-session-token",[]C067EvidenceRequest{req[0],req[0]});!errors.Is(err,ErrC067Denied){t.Fatal("duplicate export accepted",err)}
 repo.item.Status="QUARANTINED";s.Repository=repo
 if _,err=s.Export(context.Background(),"long-opaque-session-token",req);!errors.Is(err,ErrC067Denied){t.Fatal("quarantined source returned",err)}
}
