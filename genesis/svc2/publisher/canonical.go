package publisher

import (
 "context"
 "crypto/sha256"
 "encoding/hex"
 "encoding/json"
 "errors"

 eventmodel "github.com/420integrated/420-integrated/events/model"
 eventservice "github.com/420integrated/420-integrated/events/service"
 placemodel "github.com/420integrated/420-integrated/location/model"
 placeservice "github.com/420integrated/420-integrated/location/service"
)

// CanonicalBridge applies a separately authorized decision to existing canonical
// services. Its ledger is NOT a publication generation and never unlocks HTTP.
// Partial ledger/canonical errors must be reconciled before any later promotion.
type CanonicalBridge struct {
 Decisions *DurableLedger
 Operators Authorizer
 Places *placeservice.PublicationWriter
 Events *eventservice.Service
}
func canonicalDigest(v any)(string,error){data,err:=json.Marshal(v);if err!=nil{return "",err};sum:=sha256.Sum256(data);return hex.EncodeToString(sum[:]),nil}
func(b *CanonicalBridge) approved(ctx context.Context,id string,kind Kind,digest string,action Action)(Record,error){
 if b==nil||b.Decisions==nil||b.Operators==nil{return Record{},ErrUnauthorized}
 r,ok:=b.Decisions.Get(id);if !ok{return Record{},ErrNotFound}
 if r.Candidate.Kind!=kind||r.Candidate.NormalizedSHA256!=digest||r.State!=Approved||r.LastDecision.Action!=Approve||r.LastDecision.CandidateSHA256!=digest{return Record{},ErrConflict}
 if err:=b.Operators.Authorize(ctx,r.LastDecision.OperatorID,action,kind);err!=nil{return Record{},ErrUnauthorized}
 return r,nil
}
// ApplyApprovedPlace accepts exactly the canonical payload previously approved,
// with an explicit canonical version precondition. It never grants owner status.
func(b *CanonicalBridge) ApplyApprovedPlace(ctx context.Context,id string,p placemodel.Place)(placemodel.Place,error){
 if b==nil||b.Places==nil{return placemodel.Place{},ErrUnauthorized}
 hash,err:=canonicalDigest(p);if err!=nil{return placemodel.Place{},err}
 r,err:=b.approved(ctx,id,Place,hash,Approve);if err!=nil{return placemodel.Place{},err}
 if r.Candidate.ID!=p.ID||p.Version!=r.Candidate.ExpectedVersion+1||r.Candidate.ExpectedVersion==0{return placemodel.Place{},ErrConflict}
 if p.Visibility!=placemodel.VisibilityPublic||p.Precision==placemodel.PrecisionPrivate{return placemodel.Place{},ErrInvalid}
 return b.Places.ApproveVisible(ctx,r.LastDecision.OperatorID,p,r.Candidate.ExpectedVersion)
}
// WithdrawPlace requires a durable terminal withdrawal decision, a fresh
// authorization check and the current canonical version. No re-import can undo
// the ledger tombstone; publication must additionally enforce revocation floors.
func(b *CanonicalBridge) WithdrawPlace(ctx context.Context,id string,expected uint32)(placemodel.Place,error){
 if b==nil||b.Decisions==nil||b.Places==nil||b.Operators==nil{return placemodel.Place{},ErrUnauthorized}
 r,ok:=b.Decisions.Get(id);if !ok{return placemodel.Place{},ErrNotFound}
 if r.Candidate.Kind!=Place||r.State!=Withdrawn||r.LastDecision.Action!=Withdraw||r.Candidate.ID!=id{return placemodel.Place{},ErrConflict}
 if expected!=r.Candidate.ExpectedVersion+1{return placemodel.Place{},ErrConflict}
 if err:=b.Operators.Authorize(ctx,r.LastDecision.OperatorID,Withdraw,Place);err!=nil{return placemodel.Place{},ErrUnauthorized}
 return b.Places.Withdraw(ctx,r.LastDecision.OperatorID,id,expected)
}
// ApplyApprovedEvent delegates creation to Events.Service, which must authorize
// the real organizer. An unverified import cannot fabricate organizer approval.
func(b *CanonicalBridge) ApplyApprovedEvent(ctx context.Context,id string,e eventmodel.Event)(eventmodel.Event,error){
 if b==nil||b.Events==nil{return eventmodel.Event{},ErrUnauthorized}
 hash,err:=canonicalDigest(e);if err!=nil{return eventmodel.Event{},err}
 r,err:=b.approved(ctx,id,Event,hash,Approve);if err!=nil{return eventmodel.Event{},err}
 if r.Candidate.ID!=e.ID||r.Candidate.ExpectedVersion!=0||e.Status!=eventmodel.StatusDraft{return eventmodel.Event{},ErrConflict}
 return b.Events.Create(ctx,e)
}
// CancelEvent uses the canonical Events lifecycle, including its independent
// organizer authorization. Never update status directly in a file repository.
func(b *CanonicalBridge) CancelEvent(ctx context.Context,id string,expected uint32,reason string)(eventmodel.Event,error){
 if b==nil||b.Decisions==nil||b.Events==nil||b.Operators==nil{return eventmodel.Event{},ErrUnauthorized}
 r,ok:=b.Decisions.Get(id);if !ok{return eventmodel.Event{},ErrNotFound}
 if r.Candidate.Kind!=Event||r.State!=Withdrawn||r.LastDecision.Action!=Withdraw{return eventmodel.Event{},ErrConflict}
 if err:=b.Operators.Authorize(ctx,r.LastDecision.OperatorID,Withdraw,Event);err!=nil{return eventmodel.Event{},ErrUnauthorized}
 if reason==""{return eventmodel.Event{},errors.New("cancellation reason required")}
 return b.Events.Transition(ctx,id,eventmodel.StatusCancelled,expected,reason)
}
