package complianceauth

import (
 "context"
 "errors"
 "sync"
 "time"
)

var ErrLifecycleTransition = errors.New("compliance lifecycle transition rejected")

type LifecycleState string
const (
 LifecycleDraft LifecycleState = "DRAFT"
 LifecycleReviewed LifecycleState = "REVIEWED"
 LifecycleApproved LifecycleState = "APPROVED"
 LifecycleScheduled LifecycleState = "SCHEDULED"
 LifecycleActive LifecycleState = "ACTIVE"
 LifecycleSuperseded LifecycleState = "SUPERSEDED"
 LifecycleRevoked LifecycleState = "REVOKED"
)
type LifecycleRecord struct {
 ID string
 PolicyDigest string
 AuthorID string
 ReviewerID string
 ApproverID string
 PublisherID string
 State LifecycleState
 Revision uint64
 ReviewedDigest string
 ApprovedDigest string
 ScheduledFor time.Time
 EffectiveAt time.Time
 SupersededBy string
}
type LifecycleEvent struct {
 From LifecycleState
 To LifecycleState
 Actor string
 At time.Time
 Revision uint64
}
type PolicyLifecycle struct {
 mu sync.Mutex
 record LifecycleRecord
 events []LifecycleEvent
}
func NewPolicyLifecycle(id,digest,author string)(*PolicyLifecycle,error){
 if id==""||!digestValid(digest)||author=="" {return nil,ErrLifecycleTransition}
 return &PolicyLifecycle{record:LifecycleRecord{ID:id,PolicyDigest:digest,AuthorID:author,State:LifecycleDraft,Revision:1}},nil
}
func(l *PolicyLifecycle) Snapshot()(LifecycleRecord,[]LifecycleEvent){
 if l==nil{return LifecycleRecord{},nil}
 l.mu.Lock();defer l.mu.Unlock()
 return l.record,append([]LifecycleEvent(nil),l.events...)
}
// Transition accepts a trusted actor identity (never a request-supplied role).
// Persisting events, verifying legal credentials and atomic DB publication are
// external authorities; a process-local lifecycle is not production authorization.
func(l *PolicyLifecycle) Transition(ctx context.Context,to LifecycleState,actor,reviewedDigest,supersededBy string,now,timeOfActivation time.Time,expectedRevision uint64)error{
 if l==nil||ctx==nil||ctx.Err()!=nil||actor==""||now.IsZero(){return ErrLifecycleTransition}
 l.mu.Lock();defer l.mu.Unlock()
 r:=l.record
 if r.Revision!=expectedRevision || r.State==LifecycleRevoked || r.State==LifecycleSuperseded {return ErrLifecycleTransition}
 from:=r.State
 switch to{
 case LifecycleReviewed:
  if from!=LifecycleDraft||actor==r.AuthorID||!digestValid(reviewedDigest)||reviewedDigest!=r.PolicyDigest{return ErrLifecycleTransition}
  r.ReviewerID=actor;r.ReviewedDigest=reviewedDigest
 case LifecycleApproved:
  if from!=LifecycleReviewed||actor==r.AuthorID||actor==r.ReviewerID||r.ReviewedDigest!=r.PolicyDigest{return ErrLifecycleTransition}
  r.ApproverID=actor;r.ApprovedDigest=r.PolicyDigest
 case LifecycleScheduled:
  if from!=LifecycleApproved||actor==r.AuthorID||actor==r.ReviewerID||actor==r.ApproverID||timeOfActivation.Before(now)||timeOfActivation.IsZero()||r.ApprovedDigest!=r.PolicyDigest{return ErrLifecycleTransition}
  r.PublisherID=actor;r.ScheduledFor=timeOfActivation
 case LifecycleActive:
  if from!=LifecycleScheduled||actor!=r.PublisherID||now.Before(r.ScheduledFor)||r.ApprovedDigest!=r.PolicyDigest{return ErrLifecycleTransition}
  r.EffectiveAt=now
 case LifecycleSuperseded:
  if from!=LifecycleActive||actor!=r.PublisherID||supersededBy==""||supersededBy==r.ID{return ErrLifecycleTransition}
  r.SupersededBy=supersededBy
 case LifecycleRevoked:
  if from!=LifecycleScheduled && from!=LifecycleActive || actor!=r.PublisherID{return ErrLifecycleTransition}
 default:return ErrLifecycleTransition
 }
 r.State=to;r.Revision++
 l.record=r
 l.events=append(l.events,LifecycleEvent{From:from,To:to,Actor:actor,At:now,Revision:r.Revision})
 return nil
}
// Neither ACTIVE nor a lifecycle event constitutes legal, regulatory or
// transaction authority. Production activation requires current signed,
// independent approval and atomic publication-fence reconciliation.
