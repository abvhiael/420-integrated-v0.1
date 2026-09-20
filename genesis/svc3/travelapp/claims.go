package travelapp

import (
 "context"
 "errors"
 "strings"
 "sync"
 "time"
)

// PlaceClaim is an application-level request, NOT an Identity, Registry, Verify,
// Location, Trust, Reputation, or page-editing authority. Claim data is private.
type PlaceClaim struct {
 ID string
 PlaceID string
 ClaimantID string
 RegistryRecordID string
 EvidenceRef string
 Status ClaimStatus
 CreatedAt time.Time
 UpdatedAt time.Time
}

type ClaimStatus string
const (
 ClaimPending ClaimStatus = "PENDING"
 ClaimApproved ClaimStatus = "APPROVED"
 ClaimRejected ClaimStatus = "REJECTED"
)

var (
 ErrClaimInvalid = errors.New("invalid place claim")
 ErrClaimUnavailable = errors.New("place claim verification unavailable")
 ErrClaimNotFound = errors.New("place claim not found")
 ErrClaimConflict = errors.New("place claim conflict")
 ErrClaimUnauthorized = errors.New("verified claim identity required")
)

// ClaimProvenance must be backed by *trusted*, independently authenticated
// Identity, canonical Location, Registry and Verify services. Implementations
// must reject revoked records, nonpublic places and mismatched organization
// authority; Travel must never accept this verdict from browser input.
type ClaimProvenance interface {
 VerifyPlaceClaim(ctx context.Context, claimantID, placeID, registryRecordID, evidenceRef string) (bool, error)
}

// ClaimStore is an in-memory development workflow, not a durable claims system.
// No public list or anonymous lookup is provided. Even an APPROVED request
// cannot mutate a page, Registry record, Verify status, or review.
type ClaimStore struct {
 mu sync.RWMutex
 claims map[string]PlaceClaim
 verifier ClaimProvenance
}

func NewClaimStore(verifier ClaimProvenance) *ClaimStore {
 return &ClaimStore{claims: make(map[string]PlaceClaim), verifier: verifier}
}

func validateClaim(c PlaceClaim) error {
 if !validPlaceID(c.ID) || !validPlaceID(c.PlaceID) || strings.TrimSpace(c.ClaimantID)=="" || len(c.ClaimantID)>256 || strings.TrimSpace(c.RegistryRecordID)=="" || len(c.RegistryRecordID)>256 || strings.TrimSpace(c.EvidenceRef)=="" || len(c.EvidenceRef)>512 {return ErrClaimInvalid}
 return nil
}

// Submit requires a trusted caller to supply the authenticated claimant.
// Claims remain pending even when external provenance verification succeeds.
func (s *ClaimStore) Submit(ctx context.Context, claimant string, proposed PlaceClaim) (PlaceClaim,error) {
 if s==nil || strings.TrimSpace(claimant)=="" {return PlaceClaim{},ErrClaimUnauthorized}
 proposed.ClaimantID=claimant
 proposed.Status=ClaimPending
 if err:=validateClaim(proposed);err!=nil {return PlaceClaim{},err}
 if s.verifier==nil {return PlaceClaim{},ErrClaimUnavailable}
 ok,err:=s.verifier.VerifyPlaceClaim(ctx,claimant,proposed.PlaceID,proposed.RegistryRecordID,proposed.EvidenceRef)
 if err!=nil || !ok {return PlaceClaim{},ErrClaimUnavailable}
 s.mu.Lock();defer s.mu.Unlock()
 if _,exists:=s.claims[proposed.ID];exists {return PlaceClaim{},ErrClaimConflict}
 for _,c:=range s.claims {if c.PlaceID==proposed.PlaceID && c.ClaimantID==claimant && c.Status!=ClaimRejected {return PlaceClaim{},ErrClaimConflict}}
 now:=time.Now().UTC();proposed.CreatedAt=now;proposed.UpdatedAt=now
 s.claims[proposed.ID]=proposed
 return proposed,nil
}

// GetOwned intentionally makes another claimant's ID indistinguishable from a
// nonexistent ID. The caller cannot override the authenticated principal.
func (s *ClaimStore) GetOwned(_ context.Context, claimant,id string)(PlaceClaim,error) {
 if s==nil || strings.TrimSpace(claimant)=="" {return PlaceClaim{},ErrClaimUnauthorized}
 s.mu.RLock();defer s.mu.RUnlock()
 c,ok:=s.claims[id];if !ok || c.ClaimantID!=claimant {return PlaceClaim{},ErrClaimNotFound}
 return c,nil
}

// Decide is reserved for a separate trusted review service. Reviewers cannot
// approve their own claims; approval rechecks current external provenance.
// An approval is an application workflow status, NOT place-management access.
func (s *ClaimStore) Decide(ctx context.Context, reviewer,id string, approve bool)(PlaceClaim,error) {
 if s==nil || strings.TrimSpace(reviewer)=="" {return PlaceClaim{},ErrClaimUnauthorized}
 s.mu.Lock();defer s.mu.Unlock()
 c,ok:=s.claims[id];if !ok {return PlaceClaim{},ErrClaimNotFound}
 if reviewer==c.ClaimantID {return PlaceClaim{},ErrClaimUnauthorized}
 if c.Status!=ClaimPending {return PlaceClaim{},ErrClaimConflict}
 if approve {
  if s.verifier==nil {return PlaceClaim{},ErrClaimUnavailable}
  verified,err:=s.verifier.VerifyPlaceClaim(ctx,c.ClaimantID,c.PlaceID,c.RegistryRecordID,c.EvidenceRef)
  if err!=nil || !verified {return PlaceClaim{},ErrClaimUnavailable}
  c.Status=ClaimApproved
 } else {c.Status=ClaimRejected}
 c.UpdatedAt=time.Now().UTC();s.claims[id]=c
 return c,nil
}
