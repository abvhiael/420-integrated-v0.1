package publisher

import (
 "bytes"
 "context"
 "crypto/sha256"
 "encoding/hex"
 "encoding/json"
 "fmt"
 "time"
)

// VerifiedVancouverParks is an offline, private intake result. It is not an
// approved source grant, canonical place mutation or publication attestation.
type VerifiedVancouverParks struct {
 Batch VancouverParksBatch
 Payloads []VancouverParkPayload
 RawSHA256 string
}

// ReconcileVancouverParks maps the exact raw acquisition and checks every
// retained normalized preimage against both the mapped fields and the digest
// computed by the pending-review staging format. No candidate is staged here.
// retrievedAt must be independently recorded by the operator, never inferred
// from the source payload or the current clock.
func ReconcileVancouverParks(raw []byte, acquisitionID string, retrievedAt time.Time) (VerifiedVancouverParks, error) {
 sum := sha256.Sum256(raw)
 revision := hex.EncodeToString(sum[:])
 batch, payloads, err := MapVancouverParksRaw(raw, acquisitionID, revision, retrievedAt)
 if err != nil { return VerifiedVancouverParks{}, err }
 if len(batch.Parks) != len(payloads) { return VerifiedVancouverParks{}, ErrInvalid }
 for i, park := range batch.Parks {
  p := payloads[i]
  if p.SourceParkID != park.ParkID || p.CanonicalCandidateID != "vancouver-park:"+park.ParkID ||
   p.Name != park.Name || p.Latitude != park.Latitude || p.Longitude != park.Longitude || !validDigest(p.RawRecordSHA256) || !validDigest(p.NormalizedSHA256) { return VerifiedVancouverParks{}, fmt.Errorf("park %d: %w", i, ErrInvalid) }
  expected, err := json.Marshal(struct{ ParkID, Name string; Latitude, Longitude float64 }{park.ParkID, park.Name, park.Latitude, park.Longitude})
  if err != nil || !bytes.Equal(expected, p.NormalizedBytes) { return VerifiedVancouverParks{}, fmt.Errorf("park %d: normalized preimage mismatch: %w", i, ErrInvalid) }
  digest := sha256.Sum256(p.NormalizedBytes)
  if hex.EncodeToString(digest[:]) != p.NormalizedSHA256 { return VerifiedVancouverParks{}, fmt.Errorf("park %d: normalized digest mismatch: %w", i, ErrInvalid) }
 }
 return VerifiedVancouverParks{Batch:batch, Payloads:payloads, RawSHA256:revision}, nil
}

// StageVerifiedVancouverParks verifies the complete payload collection before
// invoking the existing private pending-only intake. A missing or revoked grant
// must still be rejected by intake's SourceVerifier. ImportCandidate is not a
// transactional multi-record API: a mid-batch I/O or grant failure can leave a
// pending prefix, which is never evidence that the full batch was onboarded.
func StageVerifiedVancouverParks(ctx context.Context, intake CandidateIntake, v VerifiedVancouverParks) (int, error) {
 if intake == nil || !validDigest(v.RawSHA256) || v.Batch.Revision != v.RawSHA256 || len(v.Batch.Parks) == 0 || len(v.Batch.Parks) != len(v.Payloads) { return 0, ErrInvalid }
 seen := make(map[string]bool, len(v.Payloads))
 for i, park := range v.Batch.Parks {
  p := v.Payloads[i]
  if seen[park.ParkID] || p.SourceParkID != park.ParkID || p.CanonicalCandidateID != "vancouver-park:"+park.ParkID ||
   p.Name != park.Name || p.Latitude != park.Latitude || p.Longitude != park.Longitude || !validDigest(p.RawRecordSHA256) || !validDigest(p.NormalizedSHA256) { return 0, ErrInvalid }
  seen[park.ParkID] = true
  normalized, err := json.Marshal(struct{ ParkID, Name string; Latitude, Longitude float64 }{park.ParkID, park.Name, park.Latitude, park.Longitude})
  if err != nil || !bytes.Equal(normalized, p.NormalizedBytes) { return 0, ErrInvalid }
  hash := sha256.Sum256(p.NormalizedBytes)
  if hex.EncodeToString(hash[:]) != p.NormalizedSHA256 { return 0, ErrInvalid }
 }
 return StageVancouverParks(ctx, intake, v.Batch)
}
