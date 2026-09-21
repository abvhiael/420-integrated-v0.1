// Package publisher contains private candidate decisions. It does not publish
// canonical Location/Events records or attest to a deployment's live provenance.
package publisher

import (
 "context"
 "crypto/sha256"
 "encoding/hex"
 "errors"
 "fmt"
 "strings"
 "sync"
 "time"
)

// Kind identifies an existing canonical model, never an external ownership claim.
type Kind string
const (Place Kind = "place"; Event Kind = "event")
type State string
const (Pending State = "pending_review"; Approved State = "approved"; Withdrawn State = "withdrawn"; Rejected State = "rejected")
type Action string
const (Approve Action = "approve"; Withdraw Action = "withdraw"; Reject Action = "reject")

var (
 ErrUnauthorized = errors.New("publication action unauthorized")
 ErrUntrustedSource = errors.New("source not independently qualified")
 ErrConflict = errors.New("candidate revision or decision conflict")
 ErrNotFound = errors.New("candidate not found")
 ErrInvalid = errors.New("invalid candidate or decision")
)

// SourceEvidence is supplied by an importer; the independently configured
// SourceVerifier must corroborate it. SourceID is never itself a trust anchor.
type SourceEvidence struct {
 Namespace string
 RecordID string
 Revision string
 ManifestID string
 TermsRef string
 AttributionRef string
 RetrievedAt time.Time
 PayloadSHA256 string
}

type Candidate struct {
 ID string // stable, internal canonical candidate ID; not a provider ID
 Kind Kind
 Source SourceEvidence
 NormalizedSHA256 string
 ExpectedVersion uint32 // version of the existing canonical target; zero for new records
}

type Decision struct {
 CandidateID string
 CandidateSHA256 string
 Action Action
 OperatorID string
 PolicyVersion string
 Reason string
 ExpectedDecisionVersion uint64
 At time.Time
}

type Record struct {
 Candidate Candidate
 State State
 DecisionVersion uint64
 LastDecision Decision
}

// Authorizer MUST authenticate the operator independently of the request body.
// SourceVerifier MUST consult a deployment-controlled, qualified source policy,
// not merely the SourceEvidence supplied by the importer.
type Authorizer interface { Authorize(context.Context, string, Action, Kind) error }
type SourceVerifier interface { VerifySource(context.Context, SourceEvidence, Kind) error }

// Ledger is a single-process staging decision store, NOT durable publication
// evidence. The authoritative publisher must later persist an append-only audit
// and enforce canonical lifecycle and withdrawal watermarks before promotion.
type Ledger struct {
 mu sync.Mutex
 authorizer Authorizer
 sources SourceVerifier
 now func() time.Time
 records map[string]Record
 history []Decision
}

func NewLedger(auth Authorizer, sources SourceVerifier, now func() time.Time) (*Ledger,error) {
 if auth==nil || sources==nil || now==nil {return nil,errors.New("operator authorizer, source verifier and clock are required")}
 return &Ledger{authorizer:auth,sources:sources,now:now,records:map[string]Record{}},nil
}

func validDigest(v string) bool {
 if len(v)!=sha256.Size*2 {return false}
 b,e:=hex.DecodeString(v);return e==nil&&len(b)==sha256.Size&&hex.EncodeToString(b)==v
}

func (c Candidate) Validate() error {
 s:=c.Source
 if strings.TrimSpace(c.ID)=="" || (c.Kind!=Place&&c.Kind!=Event) || strings.TrimSpace(s.Namespace)=="" || strings.TrimSpace(s.RecordID)=="" || strings.TrimSpace(s.Revision)=="" || strings.TrimSpace(s.ManifestID)=="" || strings.TrimSpace(s.TermsRef)=="" || strings.TrimSpace(s.AttributionRef)=="" || s.RetrievedAt.IsZero() || !validDigest(s.PayloadSHA256) || !validDigest(c.NormalizedSHA256) {return ErrInvalid}
 return nil
}

// ImportCandidate may stage an independently qualified source. It cannot
// approve or unwithdraw a record. A terminal record ID cannot be re-imported.
func (l *Ledger) ImportCandidate(ctx context.Context,c Candidate) error {
 if l==nil || l.sources==nil || l.authorizer==nil || l.now==nil {return ErrUnauthorized}
 if err:=c.Validate();err!=nil{return err}
 if err:=l.sources.VerifySource(ctx,c.Source,c.Kind);err!=nil{return fmt.Errorf("%w: %v",ErrUntrustedSource,err)}
 l.mu.Lock();defer l.mu.Unlock()
 if existing,ok:=l.records[c.ID];ok {
  if existing.State==Withdrawn || existing.State==Rejected {return ErrConflict}
  if existing.Candidate==c {return nil}
  // Candidate changes always invalidate previous approval; caller must use a
  // fresh decision version and obtain a new explicit approval.
  existing.Candidate=c;existing.State=Pending;existing.DecisionVersion++
  existing.LastDecision=Decision{}
  l.records[c.ID]=existing
  return nil
 }
 l.records[c.ID]=Record{Candidate:c,State:Pending}
 return nil
}

// Decide enforces source policy AND operator authorization for every action.
// The operator ID is not authenticated by being present in the Decision.
func (l *Ledger) Decide(ctx context.Context,d Decision) (Record,error) {
 if l==nil || l.authorizer==nil || l.sources==nil || l.now==nil {return Record{},ErrUnauthorized}
 if strings.TrimSpace(d.CandidateID)=="" || strings.TrimSpace(d.OperatorID)=="" || strings.TrimSpace(d.PolicyVersion)=="" || strings.TrimSpace(d.Reason)=="" || !validDigest(d.CandidateSHA256) || (d.Action!=Approve&&d.Action!=Withdraw&&d.Action!=Reject) {return Record{},ErrInvalid}
 l.mu.Lock();defer l.mu.Unlock()
 current,ok:=l.records[d.CandidateID];if !ok{return Record{},ErrNotFound}
 if current.DecisionVersion!=d.ExpectedDecisionVersion || current.Candidate.NormalizedSHA256!=d.CandidateSHA256 {return Record{},ErrConflict}
 if current.State==Withdrawn || current.State==Rejected {return Record{},ErrConflict}
 if d.Action==Approve && current.State!=Pending {return Record{},ErrConflict}
 if d.Action==Reject && current.State!=Pending {return Record{},ErrConflict}
 if d.Action==Withdraw && current.State!=Approved {return Record{},ErrConflict}
 if err:=l.authorizer.Authorize(ctx,d.OperatorID,d.Action,current.Candidate.Kind);err!=nil{return Record{},fmt.Errorf("%w: %v",ErrUnauthorized,err)}
 if err:=l.sources.VerifySource(ctx,current.Candidate.Source,current.Candidate.Kind);err!=nil{return Record{},fmt.Errorf("%w: %v",ErrUntrustedSource,err)}
 instant:=l.now().UTC();if instant.IsZero(){return Record{},ErrInvalid}
 d.At=instant
 switch d.Action {case Approve: current.State=Approved;case Withdraw:current.State=Withdrawn;case Reject:current.State=Rejected}
 current.DecisionVersion++;current.LastDecision=d
 l.records[d.CandidateID]=current;l.history=append(l.history,d)
 return current,nil
}

// Read methods expose only private decision metadata to trusted in-process code.
// Never serialize these records into the public GEN-SVC-2 HTTP API.
func (l *Ledger) Get(id string)(Record,bool){if l==nil{return Record{},false};l.mu.Lock();defer l.mu.Unlock();r,ok:=l.records[id];return r,ok}
func (l *Ledger) History() []Decision {if l==nil{return nil};l.mu.Lock();defer l.mu.Unlock();return append([]Decision(nil),l.history...)}
