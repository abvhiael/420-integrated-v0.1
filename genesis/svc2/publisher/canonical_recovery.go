package publisher

import (
 "context"
 "fmt"
 placemodel "github.com/420integrated/420-integrated/location/model"
)

// ApplyApprovedPlaceTracked writes an intent before invoking the canonical
// service; restart recovery MUST inspect the real place repository via
// ReconcilePlace before any retry. OperationLog and the decision ledger are
// private and are not connected to public HTTP or generation promotion.
func (b *CanonicalBridge) ApplyApprovedPlaceTracked(ctx context.Context,id string,p placemodel.Place,operations *OperationLog)(placemodel.Place,error){
 if b==nil||b.Places==nil||operations==nil{return placemodel.Place{},ErrUnauthorized}
 hash,err:=canonicalDigest(p);if err!=nil{return placemodel.Place{},err}
 r,err:=b.approved(ctx,id,Place,hash,Approve);if err!=nil{return placemodel.Place{},err}
 if r.Candidate.ExpectedVersion==0||p.ID!=id||p.Version!=r.Candidate.ExpectedVersion+1{return placemodel.Place{},ErrConflict}
 op:=Operation{ID:"place-approve:"+id+":"+fmt.Sprint(r.DecisionVersion),CandidateID:id,Kind:Place,Action:Approve,CandidateSHA256:hash,ExpectedVersion:r.Candidate.ExpectedVersion,PostImageSHA256:hash}
 if err:=operations.Begin(op);err!=nil{return placemodel.Place{},err}
 result,writeErr:=b.ApplyApprovedPlace(ctx,id,p)
 // Even when a canonical call returns an error, the durable write might have
 // happened. Reconcile against disk rather than assuming rollback.
 _,recoveryErr:=ReconcilePlace(ctx,operations,op.ID,b.Places)
 if writeErr!=nil{return placemodel.Place{},fmt.Errorf("canonical write requires reconciliation: %w",writeErr)}
 if recoveryErr!=nil{return placemodel.Place{},recoveryErr}
 return result,nil
}

func ReconcilePlace(ctx context.Context,operations *OperationLog,opID string,writer interface{ReadCanonical(string)(placemodel.Place,error)})(Operation,error){
 if operations==nil||writer==nil{return Operation{},ErrInvalid}
 op,ok:=operations.Find(opID);if !ok{return Operation{},ErrNotFound}
 if op.Kind!=Place||op.Action!=Approve{return Operation{},ErrInvalid}
 return operations.Reconcile(ctx,opID,func(context.Context)(uint32,string,error){
  current,err:=writer.ReadCanonical(op.CandidateID);if err!=nil{return 0,"",err}
  digest,err:=canonicalDigest(current);return current.Version,digest,err
 })
}
