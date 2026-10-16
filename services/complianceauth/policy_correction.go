package complianceauth

import (
 "context"
 "crypto/sha256"
 "encoding/hex"
 "encoding/json"
 "time"
)

// CorrectionCandidate is an independent, current legal/reviewer assertion;
// historical policy content cannot itself confer permission for restoration.
type CorrectionCandidate struct {
 Target PublicationFence
 SourceDigest string
 ReviewDigest string
 LegalApprovalExpiresAt time.Time
 ApprovedNow bool
 CurrentLawVerified bool
 ScopeVerified bool
 ReviewerID string
 PublisherID string
 AuthorID string
 Reason string
}
type CorrectionHistory struct {
 From PublicationFence
 To PublicationFence
 HistoricErrorDigest string
 Reason string
 PreviousApprovalDigest string
 At time.Time
}
type CorrectionPlan struct{
 Next PublicationFence
 History CorrectionHistory
 RequiresIndependentPublication bool
 Authorized bool
}
// PlanCorrection never rewinds a publication sequence or revocation epoch.
// Restoring old content always creates a new approved version under a new
// sequence, with independent evidence and the original error trace retained.
func PlanCorrection(old PublicationFence,target CorrectionCandidate,errorEvidence []byte,now time.Time)(CorrectionPlan,error){
 var empty CorrectionPlan
 if !ValidPublicationFence(old,now)||!ValidPublicationFence(target.Target,now)||target.Target.Scope!=old.Scope||
 target.Target.Sequence<=old.Sequence||target.Target.RevocationEpoch<old.RevocationEpoch||
 !digestValid(target.SourceDigest)||!digestValid(target.ReviewDigest)||!target.ApprovedNow||!target.CurrentLawVerified||!target.ScopeVerified||
 target.LegalApprovalExpiresAt.IsZero()||!now.Before(target.LegalApprovalExpiresAt)||
 target.AuthorID==""||target.ReviewerID==""||target.PublisherID==""||target.AuthorID==target.ReviewerID||target.AuthorID==target.PublisherID||target.ReviewerID==target.PublisherID||
 len(errorEvidence)==0||len(errorEvidence)>1<<20||target.Reason==""||len(target.Reason)>1024{return empty,ErrUnauthorized}
 payload,err:=json.Marshal(struct{Old PublicationFence;Reason string;Evidence []byte}{old,target.Reason,errorEvidence})
 if err!=nil{return empty,ErrUnauthorized}
 h:=sha256.Sum256(payload)
 return CorrectionPlan{
  Next:target.Target,
  History:CorrectionHistory{From:old,To:target.Target,HistoricErrorDigest:hex.EncodeToString(h[:]),Reason:target.Reason,PreviousApprovalDigest:old.PolicyDigest,At:now},
  RequiresIndependentPublication:true,
 },nil
}
// ApplyCorrection delegates actual publication to the independently signed
// authority and strong CAS publication gate. It deliberately has no unsafe
// fallback on absent reviewer authority or storage outage.
func ApplyCorrection(ctx context.Context,store PublicationStore,authority IndependentPublicationAuthority,plan CorrectionPlan,now time.Time)error{
 if ctx==nil||ctx.Err()!=nil||store==nil||authority==nil||!plan.RequiresIndependentPublication||plan.Authorized||
 plan.History.From.Scope!=plan.Next.Scope||plan.History.To!=plan.Next||plan.History.From.Sequence>=plan.Next.Sequence||
 !digestValid(plan.History.HistoricErrorDigest)||!ValidPublicationFence(plan.History.From,now)||!ValidPublicationFence(plan.Next,now){return ErrUnauthorized}
 if err:=authority.VerifyPublication(ctx,plan.History.From,plan.Next);err!=nil{return ErrUnauthorized}
 return AdvancePublication(ctx,store,plan.History.From,plan.Next,now)
}
