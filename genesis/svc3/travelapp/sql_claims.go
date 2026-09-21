package travelapp

import (
 "context"
 "database/sql"
 "errors"
 "strings"
)

// ClaimReviewerAuthorizer MUST independently authenticate and authorize the
// trusted reviewer for the requested operation. No reviewer identity may be
// accepted from browser input, a caller-supplied header or a claim itself.
type ClaimReviewerAuthorizer interface {
 AuthorizeClaimReview(context.Context, string, string, ClaimStatus) (bool, error)
}

// SQLClaimRepository is opt-in. Operators must supply a migrated PostgreSQL DB,
// a live independently trusted ClaimProvenance and a reviewer authorizer.
// Approval only changes the Travel claim's review status; it NEVER grants
// Location page ownership, Registry authority or Verify permissions.
type SQLClaimRepository struct {
 DB *sql.DB
 Provenance ClaimProvenance
 Reviewers ClaimReviewerAuthorizer
}

func NewSQLClaimRepository(db *sql.DB, provenance ClaimProvenance, reviewers ClaimReviewerAuthorizer) (*SQLClaimRepository,error) {
 if db==nil||provenance==nil||reviewers==nil{return nil,ErrClaimUnavailable}
 return &SQLClaimRepository{DB:db,Provenance:provenance,Reviewers:reviewers},nil
}

const claimColumns = "id, place_id, claimant_id, registry_record_id, evidence_ref, status, created_at, updated_at"

func scanSQLClaim(row interface{Scan(...any) error})(PlaceClaim,error) {
 var c PlaceClaim;var status string
 if err:=row.Scan(&c.ID,&c.PlaceID,&c.ClaimantID,&c.RegistryRecordID,&c.EvidenceRef,&status,&c.CreatedAt,&c.UpdatedAt);err!=nil{return PlaceClaim{},err}
 c.Status=ClaimStatus(status)
 if err:=validateClaim(c);err!=nil{return PlaceClaim{},err}
 return c,nil
}

func (s *SQLClaimRepository) Submit(ctx context.Context, claimant string, proposed PlaceClaim)(PlaceClaim,error) {
 if s==nil||s.DB==nil||s.Provenance==nil{return PlaceClaim{},ErrClaimUnavailable}
 if err:=authorizedTripOwner(claimant);err!=nil{return PlaceClaim{},ErrClaimUnauthorized}
 proposed.ClaimantID=claimant;proposed.Status=ClaimPending
 if err:=validateClaim(proposed);err!=nil{return PlaceClaim{},err}
 verified,err:=s.Provenance.VerifyPlaceClaim(ctx,claimant,proposed.PlaceID,proposed.RegistryRecordID,proposed.EvidenceRef)
 if err!=nil||!verified{return PlaceClaim{},ErrClaimUnavailable}
 // The partial unique index prevents concurrent duplicate active claims.
 row:=s.DB.QueryRowContext(ctx,`INSERT INTO travel_business_claims (id,place_id,claimant_id,registry_record_id,evidence_ref,status) VALUES ($1,$2,$3,$4,$5,'PENDING') ON CONFLICT DO NOTHING RETURNING `+claimColumns,
  proposed.ID,proposed.PlaceID,claimant,proposed.RegistryRecordID,proposed.EvidenceRef)
 c,err:=scanSQLClaim(row);if errors.Is(err,sql.ErrNoRows){return PlaceClaim{},ErrClaimConflict};return c,err
}

func (s *SQLClaimRepository) GetOwned(ctx context.Context,claimant,id string)(PlaceClaim,error) {
 if s==nil||s.DB==nil{return PlaceClaim{},ErrClaimUnavailable}
 if err:=authorizedTripOwner(claimant);err!=nil{return PlaceClaim{},ErrClaimUnauthorized}
 c,err:=scanSQLClaim(s.DB.QueryRowContext(ctx,`SELECT `+claimColumns+` FROM travel_business_claims WHERE claimant_id=$1 AND id=$2`,claimant,id))
 if errors.Is(err,sql.ErrNoRows){return PlaceClaim{},ErrClaimNotFound};return c,err
}

// Decide is only for a trusted server-side reviewer flow; it is not exposed by
// the default public or claimant HTTP handler. It serializes competing reviews
// with SELECT FOR UPDATE, and records a decision in the same transaction.
func (s *SQLClaimRepository) Decide(ctx context.Context,reviewer,id string,next ClaimStatus)(PlaceClaim,error) {
 if s==nil||s.DB==nil||s.Provenance==nil||s.Reviewers==nil{return PlaceClaim{},ErrClaimUnavailable}
 if err:=authorizedTripOwner(reviewer);err!=nil{return PlaceClaim{},ErrClaimUnauthorized}
 if !validPlaceID(id)||(next!=ClaimApproved&&next!=ClaimRejected&&next!=ClaimStatus("REVOKED")){return PlaceClaim{},ErrClaimInvalid}
 allowed,err:=s.Reviewers.AuthorizeClaimReview(ctx,reviewer,id,next)
 if err!=nil||!allowed{return PlaceClaim{},ErrClaimUnauthorized}
 tx,err:=s.DB.BeginTx(ctx,&sql.TxOptions{Isolation:sql.LevelSerializable});if err!=nil{return PlaceClaim{},err}
 defer tx.Rollback()
 previous,err:=scanSQLClaim(tx.QueryRowContext(ctx,`SELECT `+claimColumns+` FROM travel_business_claims WHERE id=$1 FOR UPDATE`,id))
 if errors.Is(err,sql.ErrNoRows){return PlaceClaim{},ErrClaimNotFound};if err!=nil{return PlaceClaim{},err}
 if strings.TrimSpace(previous.ClaimantID)==reviewer{return PlaceClaim{},ErrClaimUnauthorized}
 if next==ClaimStatus("REVOKED") {
  if previous.Status!=ClaimApproved{return PlaceClaim{},ErrClaimConflict}
 } else if previous.Status!=ClaimPending{return PlaceClaim{},ErrClaimConflict}
 if next==ClaimApproved {
  verified,err:=s.Provenance.VerifyPlaceClaim(ctx,previous.ClaimantID,previous.PlaceID,previous.RegistryRecordID,previous.EvidenceRef)
  if err!=nil||!verified{return PlaceClaim{},ErrClaimUnavailable}
 }
 current,err:=scanSQLClaim(tx.QueryRowContext(ctx,`UPDATE travel_business_claims SET status=$2, updated_at=clock_timestamp() WHERE id=$1 AND status=$3 RETURNING `+claimColumns,id,string(next),string(previous.Status)))
 if errors.Is(err,sql.ErrNoRows){return PlaceClaim{},ErrClaimConflict};if err!=nil{return PlaceClaim{},err}
 if _,err:=tx.ExecContext(ctx,`INSERT INTO travel_business_claim_decisions (claim_id,reviewer_id,previous_status,next_status) VALUES ($1,$2,$3,$4)`,id,reviewer,string(previous.Status),string(next));err!=nil{return PlaceClaim{},err}
 if err:=tx.Commit();err!=nil{return PlaceClaim{},err}
 return current,nil
}

var _ ClaimRepository = (*SQLClaimRepository)(nil)
