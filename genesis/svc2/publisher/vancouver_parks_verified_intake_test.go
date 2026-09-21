package publisher

import (
 "context"
 "crypto/sha256"
 "encoding/hex"
 "encoding/json"
 "errors"
 "testing"
 "time"
)

func verifiedParkFixture(t *testing.T) VerifiedVancouverParks {
 t.Helper()
 v, err := ReconcileVancouverParks([]byte(actualParkRows), "private-dry-run-not-a-grant", time.Date(2026, 9, 21, 0, 0, 0, 0, time.UTC))
 if err != nil { t.Fatal(err) }
 return v
}

func TestVerifiedVancouverParksPendingOnly(t *testing.T) {
 v := verifiedParkFixture(t)
 sum := sha256.Sum256([]byte(actualParkRows))
 if v.RawSHA256 != hex.EncodeToString(sum[:]) || len(v.Payloads) != 2 { t.Fatal("raw acquisition digest or records do not reconcile") }
 sink := &parksIntake{}
 n, err := StageVerifiedVancouverParks(context.Background(), sink, v)
 if err != nil || n != 2 { t.Fatalf("stage: %d %v", n, err) }
 for i, c := range sink.records {
  if c.NormalizedSHA256 != v.Payloads[i].NormalizedSHA256 || c.Source.Revision != v.RawSHA256 || c.Kind != Place { t.Fatalf("pending candidate not bound to retained preimage: %+v", c) }
 }
 ledger, err := NewLedger(&testAuth{true}, &testSource{true}, time.Now)
 if err != nil { t.Fatal(err) }
 for _, c := range sink.records { if err := ledger.ImportCandidate(context.Background(), c); err != nil { t.Fatal(err) } }
 for _, c := range sink.records { r, ok := ledger.Get(c.ID); if !ok || r.State != Pending || len(ledger.History()) != 0 { t.Fatal("private dry run approved or published") } }
 // Serialize retained records and reverify their exact hash preimages.
 saved, err := json.Marshal(v.Payloads); if err != nil { t.Fatal(err) }
 var restored []VancouverParkPayload
 if err := json.Unmarshal(saved, &restored); err != nil { t.Fatal(err) }
 v.Payloads = restored
 if n, err := StageVerifiedVancouverParks(context.Background(), &parksIntake{}, v); err != nil || n != 2 { t.Fatalf("private serialization broke reconciliation: %d %v", n, err) }
}

func TestVerifiedVancouverParksFailClosedBeforeStaging(t *testing.T) {
 for name, change := range map[string]func(*VerifiedVancouverParks){
  "raw revision":func(v *VerifiedVancouverParks){v.RawSHA256 = "bad"},
  "manifest revision":func(v *VerifiedVancouverParks){v.Batch.Revision = "bad"},
  "missing record":func(v *VerifiedVancouverParks){v.Payloads = v.Payloads[:1]},
  "source id takeover":func(v *VerifiedVancouverParks){v.Payloads[1].SourceParkID = "1"},
  "candidate id takeover":func(v *VerifiedVancouverParks){v.Payloads[1].CanonicalCandidateID = "vancouver-park:1"},
  "modified preimage":func(v *VerifiedVancouverParks){v.Payloads[1].NormalizedBytes = json.RawMessage(`{"ParkID":"999"}`)},
  "modified digest":func(v *VerifiedVancouverParks){v.Payloads[1].NormalizedSHA256 = v.Payloads[0].NormalizedSHA256},
  "changed mapped field":func(v *VerifiedVancouverParks){v.Batch.Parks[1].Name = "other"},
  "duplicate park":func(v *VerifiedVancouverParks){v.Batch.Parks[1].ParkID = v.Batch.Parks[0].ParkID},
 } { t.Run(name,func(t *testing.T){v:=verifiedParkFixture(t);change(&v);sink:=&parksIntake{};n,err:=StageVerifiedVancouverParks(context.Background(),sink,v);if !errors.Is(err,ErrInvalid)||n!=0||len(sink.records)!=0{t.Fatalf("tampered batch partially staged: %d %v",n,err)}}) }
}

func TestVerifiedVancouverParksNeedsRealSourceGrant(t *testing.T) {
 v := verifiedParkFixture(t)
 policy := trustedPolicy()
 ledger, err := NewLedger(policy, policy, policy.Clock); if err != nil { t.Fatal(err) }
 n, err := StageVerifiedVancouverParks(context.Background(), ledger, v)
 if n != 0 || !errors.Is(err, ErrUntrustedSource) { t.Fatalf("ungranted batch staged: %d %v", n, err) }
 if _, ok := ledger.Get("vancouver-park:1");ok { t.Fatal("ungranted candidate recorded") }
}
