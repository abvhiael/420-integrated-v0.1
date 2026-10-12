package complianceauth

import (
 "context"
 "database/sql"
 _ "embed"
 "encoding/json"
 "errors"
)

//go:embed migrations/0003_independent_reviews.sql
var C065ReviewSchemaSQL string

type C065PostgreSQLReviews struct{ DB *sql.DB }

func (s C065PostgreSQLReviews) Migrate(ctx context.Context) error {
 if s.DB==nil||ctx==nil||ctx.Err()!=nil{return ErrUnavailable}
 _,err:=s.DB.ExecContext(ctx,C065ReviewSchemaSQL)
 return err
}
// AppendIfCurrent serializes review and author changes on the same locked
// author head, requiring the submitted document to remain the latest revision.
// Review history is append-only. No publication tables are touched.
func (s C065PostgreSQLReviews) AppendIfCurrent(ctx context.Context,r C065ReviewRecord,expectedDraft,expectedReview uint64)(C065ReviewRecord,error){
 fail:=func()(C065ReviewRecord,error){return C065ReviewRecord{},ErrUnavailable}
 if s.DB==nil||ctx==nil||ctx.Err()!=nil||expectedDraft==0||
  expectedDraft>maxC064Revision||expectedReview>=maxC064Revision||
  !c064ID.MatchString(r.DraftID)||!c064ID.MatchString(r.ReviewerID)||
  r.Revision!=expectedDraft||!digestValid(r.DocumentDigest)||
  !digestValid(r.ImpactDigest)||r.At.IsZero()||
  !c065FindingsValid(r.Findings,r.ConflictIDs,r.State){return C065ReviewRecord{},ErrC065Review}
 tx,err:=s.DB.BeginTx(ctx,&sql.TxOptions{Isolation:sql.LevelReadCommitted})
 if err!=nil{return fail()}
 defer tx.Rollback()
 var replica bool
 if err=tx.QueryRowContext(ctx,"SELECT pg_is_in_recovery()").Scan(&replica);err!=nil||replica{return fail()}
 var authorRevision uint64
 var authorID,versionDigest string
 err=tx.QueryRowContext(ctx,`SELECT author_id,revision FROM compliance_author_heads
 WHERE tenant=$1 AND domain=$2 AND jurisdiction=$3 AND draft_id=$4 FOR UPDATE`,
 r.Scope.Tenant,r.Scope.Domain,r.Scope.Jurisdiction,r.DraftID).Scan(&authorID,&authorRevision)
 if errors.Is(err,sql.ErrNoRows){return C065ReviewRecord{},ErrC065Conflict}
 if err!=nil{return fail()}
 if authorID==r.ReviewerID||authorRevision!=expectedDraft{return C065ReviewRecord{},ErrC065Conflict}
 err=tx.QueryRowContext(ctx,`SELECT document_digest FROM compliance_author_versions
 WHERE tenant=$1 AND domain=$2 AND jurisdiction=$3 AND draft_id=$4 AND revision=$5`,
 r.Scope.Tenant,r.Scope.Domain,r.Scope.Jurisdiction,r.DraftID,expectedDraft).Scan(&versionDigest)
 if err!=nil{return fail()}
 if versionDigest!=r.DocumentDigest{return C065ReviewRecord{},ErrC065Conflict}
 _,err=tx.ExecContext(ctx,`INSERT INTO compliance_review_heads
 (tenant,domain,jurisdiction,draft_id,draft_revision,document_digest,review_revision)
 VALUES($1,$2,$3,$4,$5,$6,0)
 ON CONFLICT (tenant,domain,jurisdiction,draft_id) DO NOTHING`,
 r.Scope.Tenant,r.Scope.Domain,r.Scope.Jurisdiction,r.DraftID,expectedDraft,r.DocumentDigest)
 if err!=nil{return fail()}
 var reviewRevision,draftRevision uint64
 var headDigest string
 err=tx.QueryRowContext(ctx,`SELECT review_revision,draft_revision,document_digest
 FROM compliance_review_heads WHERE tenant=$1 AND domain=$2 AND jurisdiction=$3 AND draft_id=$4 FOR UPDATE`,
 r.Scope.Tenant,r.Scope.Domain,r.Scope.Jurisdiction,r.DraftID).Scan(&reviewRevision,&draftRevision,&headDigest)
 if err!=nil{return fail()}
 if reviewRevision!=expectedReview{return C065ReviewRecord{},ErrC065Conflict}
 // An author edit invalidates the previous review sequence. A new sequence
 // requires explicit migration/queue reconciliation, not silent carry-forward.
 if draftRevision!=expectedDraft||headDigest!=r.DocumentDigest{return C065ReviewRecord{},ErrC065Conflict}
 document,err:=json.Marshal(r)
 if err!=nil{return fail()}
 _,err=tx.ExecContext(ctx,`INSERT INTO compliance_review_versions
 (tenant,domain,jurisdiction,draft_id,review_revision,draft_revision,document_digest,reviewer_id,state,record,created_at)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
 r.Scope.Tenant,r.Scope.Domain,r.Scope.Jurisdiction,r.DraftID,expectedReview+1,
 expectedDraft,r.DocumentDigest,r.ReviewerID,r.State,document,r.At)
 if err!=nil{return fail()}
 result,err:=tx.ExecContext(ctx,`UPDATE compliance_review_heads SET review_revision=$5
 WHERE tenant=$1 AND domain=$2 AND jurisdiction=$3 AND draft_id=$4 AND review_revision=$6`,
 r.Scope.Tenant,r.Scope.Domain,r.Scope.Jurisdiction,r.DraftID,expectedReview+1,expectedReview)
 if err!=nil{return fail()}
 n,err:=result.RowsAffected()
 if err!=nil||n!=1{return C065ReviewRecord{},ErrC065Conflict}
 if ctx.Err()!=nil{return fail()}
 if err=tx.Commit();err!=nil{return fail()}
 return r,nil
}
