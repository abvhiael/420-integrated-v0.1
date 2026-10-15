package complianceauth

import (
 "context"
 "crypto/subtle"
 "errors"
 "time"
)

var ErrReviewerAuthorization = errors.New("reviewer authorization unavailable or denied")

// ReviewerGrant is a signed/verified assertion supplied by a separate identity
// authority. This module cannot mint grants or appoint legal reviewers.
type ReviewerGrant struct {
 SubjectID string
 DelegatedBy string
 Role string
 Domain string
 Jurisdiction string
 PolicyDigest string
 IssuedAt time.Time
 ExpiresAt time.Time
 QualificationExpiresAt time.Time
 Revoked bool
}
type ReviewerSession struct {
 SubjectID string
 SessionID string
 Audience string
 IssuedAt time.Time
 ExpiresAt time.Time
 AuthenticatedAt time.Time
 MFAAuthenticatedAt time.Time
 Revoked bool
}
type ReviewerAuthority interface {
 VerifyReviewerGrant(context.Context,string,string,string)(ReviewerGrant,error)
 VerifyReviewerSession(context.Context,string)(ReviewerSession,error)
}
type ReviewAuthorizationRequest struct {
 ReviewerID string
 AuthorID string
 ApproverID string
 PublisherID string
 SessionID string
 Domain string
 Jurisdiction string
 PolicyDigest string
 Role string
 Now time.Time
}
type VerifiedReviewerAuthorization struct {
 ReviewerID string
 PolicyDigest string
 Role string
 ValidUntil time.Time
}

// AuthorizeReview must be called at the point of approval against independently
// authenticated, freshly fetched grant/session evidence. It intentionally
// returns no bearer token and never approves the policy on its own.
func AuthorizeReview(ctx context.Context,source ReviewerAuthority,r ReviewAuthorizationRequest)(VerifiedReviewerAuthorization,error){
 fail:=func()(VerifiedReviewerAuthorization,error){return VerifiedReviewerAuthorization{},ErrReviewerAuthorization}
 if ctx==nil||ctx.Err()!=nil||source==nil||r.Now.IsZero()||r.ReviewerID==""||r.SessionID==""||r.Domain==""||r.Jurisdiction==""||!digestValid(r.PolicyDigest){return fail()}
 if r.Role!="reviewer"&&r.Role!="approver"{return fail()}
 if r.ReviewerID==r.AuthorID||r.ReviewerID==r.PublisherID||r.ReviewerID==r.ApproverID||r.AuthorID==""{return fail()}
 grant,err:=source.VerifyReviewerGrant(ctx,r.ReviewerID,r.Domain,r.Jurisdiction)
 if err!=nil{return fail()}
 session,err:=source.VerifyReviewerSession(ctx,r.SessionID)
 if err!=nil{return fail()}
 if grant.Revoked||session.Revoked||grant.SubjectID!=r.ReviewerID||session.SubjectID!=r.ReviewerID||
 grant.Role!=r.Role||grant.Domain!=r.Domain||grant.Jurisdiction!=r.Jurisdiction||
 !digestValid(grant.PolicyDigest)||subtle.ConstantTimeCompare([]byte(grant.PolicyDigest),[]byte(r.PolicyDigest))!=1||
 grant.DelegatedBy==r.ReviewerID||grant.DelegatedBy==r.AuthorID||grant.DelegatedBy==r.PublisherID||
 session.SessionID!=r.SessionID||session.Audience!="420compliance-review"||
 grant.IssuedAt.IsZero()||grant.IssuedAt.After(r.Now)||grant.ExpiresAt.IsZero()||!r.Now.Before(grant.ExpiresAt)||
 grant.QualificationExpiresAt.IsZero()||!r.Now.Before(grant.QualificationExpiresAt)||
 session.IssuedAt.IsZero()||session.IssuedAt.After(r.Now)||session.ExpiresAt.IsZero()||!r.Now.Before(session.ExpiresAt)||
 session.ExpiresAt.Sub(session.IssuedAt)>15*time.Minute||
 session.AuthenticatedAt.IsZero()||session.AuthenticatedAt.After(r.Now)||
 session.MFAAuthenticatedAt.IsZero()||session.MFAAuthenticatedAt.After(r.Now)||
 r.Now.Sub(session.MFAAuthenticatedAt)>5*time.Minute||r.Now.Sub(session.AuthenticatedAt)>15*time.Minute {return fail()}
 until:=grant.ExpiresAt
 for _,expiry:=range []time.Time{grant.QualificationExpiresAt,session.ExpiresAt,session.MFAAuthenticatedAt.Add(5*time.Minute)}{
  if expiry.Before(until){until=expiry}
 }
 return VerifiedReviewerAuthorization{ReviewerID:r.ReviewerID,PolicyDigest:r.PolicyDigest,Role:r.Role,ValidUntil:until},nil
}
