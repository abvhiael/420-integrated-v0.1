package storage

import (
	"context"
	"time"
)

// CanonicalWindowReconciler is an optional extension used by provider
// reconciliation to recover proof-window progress and terminal settlement state
// directly from canonical chain state.
type CanonicalWindowReconciler interface {
	ReconcileWindows(ctx context.Context, agreementID string, windowCount uint32, now time.Time) (settlementID string, nextWindow uint32, missed uint32, terminal bool, err error)
}

func (r RPCStorageReader) ReconcileWindows(ctx context.Context, agreementID string, windowCount uint32, now time.Time) (string, uint32, uint32, bool, error) {
	if err := r.validate(); err != nil { return "",0,0,false,err }
	if windowCount == 0 || windowCount > 4096 { return "",0,0,false,ErrInvalidChainState }
	settlementID, err := r.uniqueSettlement(ctx, agreementID)
	if err != nil { return "",0,0,false,err }
	sid, err := bytes32Arg(settlementID)
	if err != nil { return "",0,0,false,err }
	raw, err := r.call1(ctx,r.Contracts.Settlement,"getSettlement(bytes32)",sid,"latest")
	if err != nil { return "",0,0,false,err }
	set, err := abiWords(raw,13)
	if err != nil { return "",0,0,false,err }
	state, sok := wordUint64(set[11]); wc, wok := wordUint64(set[8])
	if !sok || !wok || !wordBool(set[12]) || wc != uint64(windowCount) { return "",0,0,false,ErrInvalidChainState }
	// COMPLETE, ABORTING and CANCELLED are terminal for provider proof scheduling.
	terminal := state == 3 || state == 4 || state == 5
	if state == 0 || state > 5 { return "",0,0,false,ErrInvalidChainState }
	if terminal { return settlementID,windowCount,0,true,nil }

	now = now.UTC()
	next := windowCount
	var missed uint32
	for i:=uint32(0); i<windowCount; i++ {
		raw,err=r.call2(ctx,r.Contracts.Settlement,"windowState(bytes32,uint32)",sid,uintWord(uint64(i)),"latest")
		if err!=nil{return "",0,0,false,err}
		words,err:=abiWords(raw,1);if err!=nil{return "",0,0,false,err}
		ws,ok:=wordUint64(words[0]);if !ok||ws>3{return "",0,0,false,ErrInvalidChainState}
		switch ws {
		case 1: // RESERVED
			if next==windowCount { next=i }
			raw,err=r.call2(ctx,r.Contracts.Settlement,"windowTiming(bytes32,uint32)",sid,uintWord(uint64(i)),"latest")
			if err!=nil{return "",0,0,false,err}
			timing,err:=abiWords(raw,2);if err!=nil{return "",0,0,false,err}
			_,eok:=wordUint64(timing[0]);deadline,dok:=wordUint64(timing[1])
			if !eok||!dok||deadline==0{return "",0,0,false,ErrInvalidChainState}
			if now.After(time.Unix(int64(deadline),0).UTC()) { missed++ }
		case 2,3: // PAID / REFUNDED
			// finalized; continue to the first still-reserved window
		case 0:
			// A funded settlement should not have holes before its reserved frontier.
			if state == 2 { return "",0,0,false,ErrInvalidChainState }
		}
	}
	return settlementID,next,missed,false,nil
}
