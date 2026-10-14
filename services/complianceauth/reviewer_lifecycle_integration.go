package complianceauth

import (
 "context"
 "time"
)

// AuthorizedReviewTransition is the mandatory service-layer entry point for
// independently authenticated review and approval. A caller-supplied actor
// name alone never establishes reviewer authorization.
type AuthorizedReviewTransition struct { Authority ReviewerAuthority; Lifecycle *PolicyLifecycle; Domain string; Jurisdiction string }

// Apply independently re-verifies the actor, MFA, grant, qualification and
// exact policy digest on every review/approval transition. Revision comparison
// inside Transition prevents an earlier authorization being applied after an
// intervening policy mutation.
func (s AuthorizedReviewTransition) Apply(ctx context.Context, to LifecycleState, actor, sessionID string, at time.Time, expectedRevision uint64) error {
 if s.Lifecycle==nil || s.Authority==nil || ctx==nil || ctx.Err()!=nil || at.IsZero() || sessionID=="" {return ErrReviewerAuthorization}
 if to!=LifecycleReviewed && to!=LifecycleApproved {return ErrReviewerAuthorization}
 record,_:=s.Lifecycle.Snapshot()
 if record.Revision!=expectedRevision || record.PolicyDigest=="" {return ErrLifecycleTransition}
 role:="reviewer"
 if to==LifecycleApproved {role="approver"}
 auth:=ReviewAuthorizationRequest{
  ReviewerID:actor, AuthorID:record.AuthorID, SessionID:sessionID,
  Domain:s.Domain,Jurisdiction:s.Jurisdiction,PolicyDigest:record.PolicyDigest,
  Role:role,Now:at,
 }
 // The reviewer must remain independent from any existing approval/publisher;
 // an approver must also differ from the original reviewer.
 if to==LifecycleReviewed {auth.ApproverID=record.ApproverID;auth.PublisherID=record.PublisherID}
 if to==LifecycleApproved {
  if record.ReviewerID=="" || actor==record.ReviewerID {return ErrReviewerAuthorization}
  auth.PublisherID=record.PublisherID
 }
 verified,err:=AuthorizeReview(ctx,s.Authority,auth)
 if err!=nil || verified.Role!=role || verified.PolicyDigest!=record.PolicyDigest || !at.Before(verified.ValidUntil) {return ErrReviewerAuthorization}
 digest:=""
 if to==LifecycleReviewed {digest=record.PolicyDigest}
 return s.Lifecycle.Transition(ctx,to,actor,digest,"",at,time.Time{},expectedRevision)
}
