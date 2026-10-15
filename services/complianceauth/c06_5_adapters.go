package complianceauth

import (
 "context"
 "crypto/ed25519"
 "database/sql"
 "errors"
 "fmt"
)

// C065TrustedReviewKeys is a verifier only. Key management, reviewer grants,
// rotation and signing are supplied by independent provider authority.
type C065TrustedReviewKeys struct {
 Keys map[string]map[string]ed25519.PublicKey
}
func(k C065TrustedReviewKeys) VerifyReviewSignature(ctx context.Context,reviewerID,keyID string,payload,signature []byte)error{
 if ctx==nil||ctx.Err()!=nil||!c064ID.MatchString(reviewerID)||!c064ID.MatchString(keyID)||
 len(signature)!=ed25519.SignatureSize||len(payload)==0||len(payload)>1<<20 {return ErrC065Review}
 public:=k.Keys[reviewerID][keyID]
 if len(public)!=ed25519.PublicKeySize||!ed25519.Verify(public,payload,signature){return ErrC065Review}
 return nil
}
// Production impact verification must be furnished by a read-only trusted
// simulation service, not by author/reviewer browser fields.
type C065VerifiedImpactAdapter struct{
 Verify func(context.Context,C064DraftVersion,ImpactReport)error
}
func(a C065VerifiedImpactAdapter)VerifyReviewImpact(ctx context.Context,d C064DraftVersion,r ImpactReport)error{
 if a.Verify==nil||ctx==nil||ctx.Err()!=nil||a.Verify(ctx,d,r)!=nil{return ErrC065Review}
 return nil
}
type C065PostgreSQLLookup struct {DB *sql.DB}
func(s C065PostgreSQLLookup)Lookup(ctx context.Context,scope C064AuthorScope,id string)(C064DraftVersion,error){
 if s.DB==nil||ctx==nil||ctx.Err()!=nil||!c064ID.MatchString(id)||!c051Scope(scope.Tenant)||
 !c051Scope(scope.Domain)||!c051Scope(scope.Jurisdiction){return C064DraftVersion{},ErrC065Review}
 var owner string
 err:=s.DB.QueryRowContext(ctx,`SELECT author_id FROM compliance_author_heads
 WHERE tenant=$1 AND domain=$2 AND jurisdiction=$3 AND draft_id=$4`,
 scope.Tenant,scope.Domain,scope.Jurisdiction,id).Scan(&owner)
 if err!=nil{return C064DraftVersion{},ErrC065Review}
 draft,err:=(C064PostgreSQLDrafts{DB:s.DB}).Load(ctx,scope,id,owner,0)
 if err!=nil||draft.AuthorID!=owner||draft.Scope!=scope||draft.ID!=id||
 c064DocumentDigest(draft.Schema,draft.Citations)!=draft.DocumentDigest{
  return C064DraftVersion{},fmt.Errorf("%w: integrity or access",ErrC065Review)
 }
 return draft,nil
}
var _ C065SignatureAuthority = C065TrustedReviewKeys{}
var _ C065ImpactAuthority = C065VerifiedImpactAdapter{}
var _ C065ReviewLookup = C065PostgreSQLLookup{}
var _ = errors.Is
