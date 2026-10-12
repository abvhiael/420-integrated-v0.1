package complianceauth

import (
 "context"
 "crypto/sha256"
 "encoding/hex"
 "encoding/json"
 "errors"
 "strings"
 "time"
)

// C06.5 is an isolated private review layer. This is not the publication
// lifecycle and cannot mint reviewer grants or cryptographic signatures.
var ErrC065Review = errors.New("independent review denied")
var ErrC065Conflict = errors.New("independent review conflict")

type C065Finding struct {
 Code string `json:"code"`
 Explanation string `json:"explanation"`
 Citation C064CitationRef `json:"citation"`
 Severity string `json:"severity"`
}
type C065ApprovalProof struct {
 SignerID string `json:"signer_id"`
 KeyID string `json:"key_id"`
 Signature []byte `json:"signature"`
}
type C065ReviewRecord struct {
 Scope C064AuthorScope `json:"scope"`
 DraftID string `json:"draft_id"`
 Revision uint64 `json:"revision"`
 DocumentDigest string `json:"document_digest"`
 ReviewerID string `json:"reviewer_id"`
 Findings []C065Finding `json:"findings"`
 ImpactDigest string `json:"impact_digest"`
 ConflictIDs []string `json:"conflict_ids"`
 State string `json:"state"`
 Proof C065ApprovalProof `json:"proof"`
 At time.Time `json:"at"`
}
type C065ReviewStore interface {
 // AppendIfCurrent must atomically compare both the current author revision
 // and the expected review revision, and retain append-only review history.
 AppendIfCurrent(context.Context,C065ReviewRecord,uint64,uint64)(C065ReviewRecord,error)
}
type C065SignatureAuthority interface {
 // External verifier binds signature bytes to the exact supplied canonical
 // payload and independent signing identity; this package never signs.
 VerifyReviewSignature(context.Context,string,string,[]byte,[]byte) error
}
type C065ImpactAuthority interface {
 // Independently recompute or validate the deterministic comparison against
 // trusted evaluation snapshots. Never accept a client-supplied count or ALLOW.
 VerifyReviewImpact(context.Context,C064DraftVersion,ImpactReport) error
}
type C065ReviewService struct {
 Impacts C065ImpactAuthority
 Drafts C064DraftStore
 Reviews C065ReviewStore
 Authority ReviewerAuthority
 Signatures C065SignatureAuthority
 Now func()time.Time
}
type C065ReviewInput struct {
 Draft C064DraftVersion
 SessionID string
 ReviewerID string
 ReviewerRole string
 Findings []C065Finding
 Impact ImpactReport
 ConflictIDs []string
 Decision string
 Signature C065ApprovalProof
 ExpectedReviewRevision uint64
}
func c065Digest(v any) string {
 b,_:=json.Marshal(v)
 h:=sha256.Sum256(b)
 return hex.EncodeToString(h[:])
}
func c065FindingsValid(fs []C065Finding, conflicts []string, decision string) bool {
 if len(fs)>100||len(conflicts)>100{return false}
 seen:=map[string]bool{}
 for _,f:=range fs {
  if !c064ID.MatchString(f.Code)||len(f.Explanation)<4||len(f.Explanation)>2048||
   (f.Severity!="BLOCKING"&&f.Severity!="ADVISORY")||
   !sourceIDPattern.MatchString(f.Citation.SourceID)||!digestValid(f.Citation.Digest)||
   f.Citation.Locator==""||len(f.Citation.Locator)>256||seen[f.Code]{return false}
  seen[f.Code]=true
 }
 seen=map[string]bool{}
 for _,id:=range conflicts {if !c064ID.MatchString(id)||seen[id]{return false};seen[id]=true}
 if decision!="FINDINGS_OPEN"&&decision!="APPROVED_CANDIDATE"&&decision!="CONFLICT_QUEUE"{return false}
 if decision=="APPROVED_CANDIDATE" {
  if len(conflicts)!=0{return false}
  for _,f:=range fs {if f.Severity=="BLOCKING"{return false}}
 }
 if decision=="CONFLICT_QUEUE"&&len(conflicts)==0{return false}
 return true
}
// Review performs an independent, fail-closed, exact-version review request.
// APPROVED_CANDIDATE is *not* approval for publication or activation.
func (s C065ReviewService) Review(ctx context.Context,req C065ReviewInput)(C065ReviewRecord,error){
 fail:=func()(C065ReviewRecord,error){return C065ReviewRecord{},ErrC065Review}
 if ctx==nil||ctx.Err()!=nil||s.Drafts==nil||s.Reviews==nil||s.Authority==nil||s.Impacts==nil||
  !c064ID.MatchString(req.Draft.ID)||!c064ID.MatchString(req.Draft.AuthorID)||
  !c064ID.MatchString(req.ReviewerID)||!c064ID.MatchString(req.SessionID)||
  !digestValid(req.Draft.DocumentDigest)||req.Draft.Revision==0||
  req.Draft.Revision>maxC064Revision||!c051Scope(req.Draft.Scope.Tenant)||
  !c051Scope(req.Draft.Scope.Domain)||!c051Scope(req.Draft.Scope.Jurisdiction)||
  req.Draft.AuthorID==req.ReviewerID||!c065FindingsValid(req.Findings,req.ConflictIDs,req.Decision){return fail()}
 now:=time.Now().UTC()
 if s.Now!=nil {now=s.Now().UTC()}
 if now.IsZero(){return fail()}
 // Never trust a browser-supplied draft, impact summary, or author identity.
 current,err:=s.Drafts.Load(ctx,req.Draft.Scope,req.Draft.ID,req.Draft.AuthorID,0)
 if err!=nil||current.Revision!=req.Draft.Revision||current.Scope!=req.Draft.Scope||
  current.AuthorID!=req.Draft.AuthorID||current.DocumentDigest!=req.Draft.DocumentDigest||
  c064DocumentDigest(current.Schema,current.Citations)!=current.DocumentDigest {return fail()}
 if len(req.Impact.Items)==0||!digestValid(req.Impact.AfterPolicyDigest)||
  len(req.Impact.Items)>maxImpactFlows{return fail()}
 if s.Impacts.VerifyReviewImpact(ctx,current,req.Impact)!=nil{return fail()}
 if req.Decision=="APPROVED_CANDIDATE" {
  for _,item:=range req.Impact.Items {if item.RequiresReevaluation{return fail()}}
 }
 citations:=map[C064CitationRef]bool{}
 for _,c:=range current.Citations {citations[c.C064CitationRef]=true}
 for _,f:=range req.Findings {if !citations[f.Citation]{return fail()}}
 authorized,err:=AuthorizeReview(ctx,s.Authority,ReviewAuthorizationRequest{
  ReviewerID:req.ReviewerID,AuthorID:current.AuthorID,SessionID:req.SessionID,
  Domain:current.Scope.Domain,Jurisdiction:current.Scope.Jurisdiction,
  PolicyDigest:current.DocumentDigest,Role:req.ReviewerRole,Now:now,
 })
 if err!=nil||authorized.ReviewerID!=req.ReviewerID||!now.Before(authorized.ValidUntil){return fail()}
 impactDigest:=c065Digest(req.Impact)
 record:=C065ReviewRecord{Scope:current.Scope,DraftID:current.ID,Revision:current.Revision,
  DocumentDigest:current.DocumentDigest,ReviewerID:req.ReviewerID,Findings:req.Findings,
  ImpactDigest:impactDigest,ConflictIDs:req.ConflictIDs,State:req.Decision,At:now,
 }
 if req.Decision=="APPROVED_CANDIDATE" {
  if s.Signatures==nil||req.ReviewerRole!="reviewer"||req.Signature.SignerID!=req.ReviewerID||
   !c064ID.MatchString(req.Signature.KeyID)||len(req.Signature.Signature)<64||
   len(req.Signature.Signature)>1024{return fail()}
  // Sign a domain-separated canonical record, not a token, freeform message or UI state.
  payload,_:=json.Marshal(struct{
   Domain string `json:"domain"`
   Record C065ReviewRecord `json:"record"`
  }{"420compliance/C06.5/review/v1",record})
  if s.Signatures.VerifyReviewSignature(ctx,req.ReviewerID,req.Signature.KeyID,payload,req.Signature.Signature)!=nil{return fail()}
  record.Proof=req.Signature
 }else if req.Signature.SignerID!=""||req.Signature.KeyID!=""||len(req.Signature.Signature)!=0{return fail()}
 if ctx.Err()!=nil||!time.Now().Before(authorized.ValidUntil){return fail()}
 // Persistence adapter must enforce both CAS comparisons in one transaction.
 saved,err:=s.Reviews.AppendIfCurrent(ctx,record,req.Draft.Revision,req.ExpectedReviewRevision)
 if err!=nil {if errors.Is(err,ErrC065Conflict){return C065ReviewRecord{},ErrC065Conflict};return fail()}
 if saved.DocumentDigest!=record.DocumentDigest||saved.DraftID!=record.DraftID||
  saved.ReviewerID!=record.ReviewerID||saved.State!=record.State||
  strings.TrimSpace(saved.ImpactDigest)!=record.ImpactDigest{return fail()}
 return saved,nil
}
