package complianceauth

import (
 "context"
 "crypto/sha256"
 "encoding/hex"
 "errors"
 "time"
)

var ErrC067Denied = errors.New("auditor evidence inspection denied")

// Session and case authority MUST originate with an independent identity issuer.
type C067AuditorSession struct {
 SubjectID string
 SessionID string
 Scope C064AuthorScope
 CaseID string
 Role string
 ExpiresAt time.Time
 Revoked bool
}
type C067AuditorAuthority interface {
 VerifyAuditor(context.Context,string)(C067AuditorSession,error)
}
type C067EvidenceRequest struct {
 SourceID string
 EvidenceID string
 Purpose string
}
type C067EvidenceItem struct {
 SourceID string
 EvidenceID string
 Digest string
 Status string
 ObservedAt time.Time
 PublicCitation string
 // Raw source bytes, credentials and subject records are deliberately absent.
}
type C067EvidenceRepository interface {
 Inspect(context.Context,C064AuthorScope,string,string)(C067EvidenceItem,error)
}
type C067AuditAccess struct {
 Actor string
 CaseID string
 Scope C064AuthorScope
 EvidenceID string
 Purpose string
 Result string
 Time time.Time
}
type C067AccessLog interface {
 // AppendDurable must commit before the evidence response. Any uncertainty
 // about durable logging fails closed; callers never silently retry export.
 AppendDurable(context.Context,C067AuditAccess)error
}
type C067AuditorExport struct {
 CaseID string `json:"case_id"`
 Evidence []C067EvidenceItem `json:"evidence"`
 ExportDigest string `json:"export_digest"`
 PolicyApproved bool `json:"policy_approved"`
}
type C075CaseEvidenceRepository interface {
 InspectForCase(context.Context,C067AuditorSession,string,string,string)(C067EvidenceItem,error)
 RevalidateCase(context.Context,C067AuditorSession,string,string,string)error
}
type C067AuditorService struct {
 Authority C067AuditorAuthority
 Repository C067EvidenceRepository
 Log C067AccessLog
 Now func()time.Time
}
func(s C067AuditorService)now()time.Time {if s.Now!=nil{return s.Now().UTC()};return time.Now().UTC()}
func(s C067AuditorService)Export(ctx context.Context,token string,requests []C067EvidenceRequest)(C067AuditorExport,error){
 fail:=func()(C067AuditorExport,error){return C067AuditorExport{},ErrC067Denied}
 if ctx==nil||ctx.Err()!=nil||len(token)<16||len(token)>4096||
 s.Authority==nil||s.Repository==nil||s.Log==nil||len(requests)==0||len(requests)>32{return fail()}
 if controlled,ok:=s.Log.(interface{RequiresPrivacyGate()bool});ok&&controlled.RequiresPrivacyGate(){
  if _,ok:=s.Repository.(C075CaseEvidenceRepository);!ok{return fail()}
 }
 a,err:=s.Authority.VerifyAuditor(ctx,token)
 now:=s.now()
 if err!=nil||a.Revoked||a.Role!="auditor"||!c064ID.MatchString(a.SubjectID)||
 !c064ID.MatchString(a.SessionID)||!c064ID.MatchString(a.CaseID)||
 !c051Scope(a.Scope.Tenant)||!c051Scope(a.Scope.Domain)||!c051Scope(a.Scope.Jurisdiction)||
 !now.Before(a.ExpiresAt){return fail()}
 export:=C067AuditorExport{CaseID:a.CaseID,PolicyApproved:false}
 seen:=map[string]bool{}
 for _,request:=range requests {
  if !c064ID.MatchString(request.SourceID)||!c064ID.MatchString(request.EvidenceID)||
  request.Purpose!="LEGAL_AUDIT"&&request.Purpose!="INCIDENT_REVIEW"&&request.Purpose!="SOURCE_VERIFICATION"||
  seen[request.EvidenceID] {return fail()}
  seen[request.EvidenceID]=true
  var item C067EvidenceItem;var e error
  if gate,ok:=s.Repository.(C075CaseEvidenceRepository);ok{item,e=gate.InspectForCase(ctx,a,request.SourceID,request.EvidenceID,request.Purpose)}else{item,e=s.Repository.Inspect(ctx,a.Scope,request.SourceID,request.EvidenceID)}
  if e!=nil||item.SourceID!=request.SourceID||item.EvidenceID!=request.EvidenceID||
  !digestValid(item.Digest)||item.ObservedAt.IsZero()||item.ObservedAt.After(now)||
  item.Status!="PARSED_PENDING_REVIEW" {return fail()}
  export.Evidence=append(export.Evidence,item)
 }
 // Recheck case membership and revocation after all storage reads.
 latest,e:=s.Authority.VerifyAuditor(ctx,token)
 if e!=nil||latest!=a||ctx.Err()!=nil{return fail()}
 for i,request:=range requests{
  record:=C067AuditAccess{Actor:a.SubjectID,CaseID:a.CaseID,Scope:a.Scope,
   EvidenceID:request.EvidenceID,Purpose:request.Purpose,Result:"EXPORTED_REDACTED",Time:now}
  if s.Log.AppendDurable(ctx,record)!=nil{return fail()}
  _=i
 }
 // Reverify after durable logging; lost authority never returns evidence.
 latest,e=s.Authority.VerifyAuditor(ctx,token)
 if e!=nil||latest!=a||ctx.Err()!=nil{return fail()}
 if gate,ok:=s.Repository.(C075CaseEvidenceRepository);ok{
  for _,request:=range requests{if gate.RevalidateCase(ctx,a,request.SourceID,request.EvidenceID,request.Purpose)!=nil{return fail()}}
 }
 h:=sha256.New()
 for _,item:=range export.Evidence{
  h.Write([]byte(item.SourceID));h.Write([]byte{0})
  h.Write([]byte(item.EvidenceID));h.Write([]byte{0})
  h.Write([]byte(item.Digest));h.Write([]byte{0})
 }
 export.ExportDigest=hex.EncodeToString(h.Sum(nil))
 return export,nil
}
