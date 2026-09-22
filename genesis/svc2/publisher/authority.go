// Package publisher implements private staging decisions, NOT canonical writes
// or deployment-trusted publication evidence.
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

type Kind string
const (Place Kind="place"; Event Kind="event")
type State string
const (Pending State="pending_review"; Approved State="approved"; Withdrawn State="withdrawn"; Rejected State="rejected")
type Action string
const (Approve Action="approve"; Withdraw Action="withdraw"; Reject Action="reject")
var (ErrUnauthorized=errors.New("publication action unauthorized"); ErrUntrustedSource=errors.New("source not independently qualified"); ErrConflict=errors.New("candidate revision or decision conflict"); ErrNotFound=errors.New("candidate not found"); ErrInvalid=errors.New("invalid candidate or decision"))

// Importer-supplied fields are claims until independently verified.
type SourceEvidence struct {Namespace,RecordID,Revision,ManifestID,TermsRef,AttributionRef string;RetrievedAt time.Time;PayloadSHA256 string}
type Candidate struct {ID string;Kind Kind;Source SourceEvidence;NormalizedSHA256 string;ExpectedVersion uint32}
type Decision struct {CandidateID,CandidateSHA256 string;Action Action;OperatorID,PolicyVersion,Reason string;ExpectedDecisionVersion uint64;At time.Time}
type Record struct {Candidate Candidate;State State;DecisionVersion uint64;LastDecision Decision}

// Implementations must use independently authenticated identities and qualified
// source policies; NEVER trust a caller-provided operator/source label alone.
type Authorizer interface {Authorize(context.Context,string,Action,Kind) error}
type SourceVerifier interface {VerifySource(context.Context,SourceEvidence,Kind) error}

// Ledger is in-memory, single-process staging ONLY. Persistent tamper-evident
// audit, canonical service mutation, revocation floors and publication generation
// promotion remain separately gated work. Never wire this to public HTTP.
type Ledger struct {mu sync.Mutex;authorizer Authorizer;sources SourceVerifier;now func()time.Time;records map[string]Record;history []Decision}
func NewLedger(a Authorizer,s SourceVerifier,clock func()time.Time)(*Ledger,error){if a==nil||s==nil||clock==nil{return nil,errors.New("authorizer, source verifier and clock required")};return &Ledger{authorizer:a,sources:s,now:clock,records:map[string]Record{}},nil}
func validDigest(s string)bool {if len(s)!=sha256.Size*2{return false};b,e:=hex.DecodeString(s);return e==nil&&len(b)==sha256.Size&&hex.EncodeToString(b)==s}
func(c Candidate)Validate()error{s:=c.Source;if strings.TrimSpace(c.ID)==""||(c.Kind!=Place&&c.Kind!=Event)||strings.TrimSpace(s.Namespace)==""||strings.TrimSpace(s.RecordID)==""||strings.TrimSpace(s.Revision)==""||strings.TrimSpace(s.ManifestID)==""||strings.TrimSpace(s.TermsRef)==""||strings.TrimSpace(s.AttributionRef)==""||s.RetrievedAt.IsZero()||!validDigest(s.PayloadSHA256)||!validDigest(c.NormalizedSHA256){return ErrInvalid};return nil}

// ImportCandidate never authorizes public visibility. An existing candidate's
// external identity and canonical target version may not be taken over on import.
func(l *Ledger)ImportCandidate(ctx context.Context,c Candidate)error{
 if l==nil||l.authorizer==nil||l.sources==nil||l.now==nil{return ErrUnauthorized}
 if err:=c.Validate();err!=nil{return err}
 if err:=l.sources.VerifySource(ctx,c.Source,c.Kind);err!=nil{return fmt.Errorf("%w: %v",ErrUntrustedSource,err)}
 l.mu.Lock();defer l.mu.Unlock()
 if old,ok:=l.records[c.ID];ok{
  if old.State==Withdrawn||old.State==Rejected||old.Candidate.Kind!=c.Kind||old.Candidate.Source.Namespace!=c.Source.Namespace||old.Candidate.Source.RecordID!=c.Source.RecordID||old.Candidate.ExpectedVersion!=c.ExpectedVersion{return ErrConflict}
  if old.Candidate==c{return nil}
  old.Candidate=c;old.State=Pending;old.DecisionVersion++;old.LastDecision=Decision{};l.records[c.ID]=old;return nil
 }
 l.records[c.ID]=Record{Candidate:c,State:Pending};return nil
}

// Decide checks optimistic decision version, candidate digest, authenticated
// operator and qualified source for approval. Source revocation must NEVER block
// an otherwise authorized withdrawal or rejection of already staged records.
func(l *Ledger)Decide(ctx context.Context,d Decision)(Record,error){
 if l==nil||l.authorizer==nil||l.sources==nil||l.now==nil{return Record{},ErrUnauthorized}
 if strings.TrimSpace(d.CandidateID)==""||strings.TrimSpace(d.OperatorID)==""||strings.TrimSpace(d.PolicyVersion)==""||strings.TrimSpace(d.Reason)==""||!validDigest(d.CandidateSHA256)||(d.Action!=Approve&&d.Action!=Withdraw&&d.Action!=Reject){return Record{},ErrInvalid}
 l.mu.Lock();defer l.mu.Unlock()
 r,ok:=l.records[d.CandidateID];if !ok{return Record{},ErrNotFound}
 if r.DecisionVersion!=d.ExpectedDecisionVersion||r.Candidate.NormalizedSHA256!=d.CandidateSHA256||r.State==Withdrawn||r.State==Rejected{return Record{},ErrConflict}
 if (d.Action==Approve||d.Action==Reject)&&r.State!=Pending{return Record{},ErrConflict}
 if d.Action==Withdraw&&r.State!=Approved{return Record{},ErrConflict}
 if err:=l.authorizer.Authorize(ctx,d.OperatorID,d.Action,r.Candidate.Kind);err!=nil{return Record{},fmt.Errorf("%w: %v",ErrUnauthorized,err)}
 if d.Action==Approve {if err:=l.sources.VerifySource(ctx,r.Candidate.Source,r.Candidate.Kind);err!=nil{return Record{},fmt.Errorf("%w: %v",ErrUntrustedSource,err)}}
 d.At=l.now().UTC();if d.At.IsZero(){return Record{},ErrInvalid}
 switch d.Action {case Approve:r.State=Approved;case Withdraw:r.State=Withdrawn;case Reject:r.State=Rejected}
 r.DecisionVersion++;r.LastDecision=d;l.records[d.CandidateID]=r;l.history=append(l.history,d);return r,nil
}
func(l *Ledger)Get(id string)(Record,bool){if l==nil{return Record{},false};l.mu.Lock();defer l.mu.Unlock();r,ok:=l.records[id];return r,ok}
func(l *Ledger)History()[]Decision{if l==nil{return nil};l.mu.Lock();defer l.mu.Unlock();return append([]Decision(nil),l.history...)}
