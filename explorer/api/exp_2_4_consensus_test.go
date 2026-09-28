package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/indexer/model"
	explorerservice "github.com/420integrated/420-integrated/explorer/service"
)

type exp24ConsensusIndexer struct {
	*fakeIndexer
	status model.ConsensusStatus
	err error
}
func (f *exp24ConsensusIndexer) Consensus(context.Context)(model.ConsensusStatus,error){return f.status,f.err}

func newEXP24Server(t *testing.T, idx *exp24ConsensusIndexer) *Server {
	t.Helper()
	svc,err:=explorerservice.New(idx,420,time.Hour); if err!=nil { t.Fatal(err) }
	s,err:=NewServer(svc); if err!=nil { t.Fatal(err) }
	return s
}

func exp24APIStatus() model.ConsensusStatus {
	return model.ConsensusStatus{
		ChainID:420,CurrentSlot:841,NextSlot:842,Epoch:2,SlotInEpoch:2,Rotation:0,SlotInRotation:842,
		SlotsPerEpoch:420,EpochsPerRotation:42,SlotsPerRotation:17640,
		ActiveValidatorCount:4,ActiveSeats:[]uint16{1,2,3,4},
		ScheduledProposer:model.ConsensusProposer{Slot:842,Primary:1,Fallback1:2,Fallback2:3},
		LatestQC:model.ConsensusQC{Slot:841,BlockRoot:"0xqc",ParentRoot:"0xparent",Signers:4,Quorum:3,Certified:true},
		Head:model.ConsensusCheckpoint{Slot:841,Root:"0xhead"},
		Safe:model.ConsensusCheckpoint{Slot:840,Root:"0xsafe"},
		Finalized:model.ConsensusCheckpoint{Slot:839,Root:"0xfinalized"},
	}
}

func TestEXP24ConsensusRouteSerializesQualifiedView(t *testing.T) {
	s:=newEXP24Server(t,&exp24ConsensusIndexer{fakeIndexer:&fakeIndexer{},status:exp24APIStatus()})
	rr:=httptest.NewRecorder()
	s.Handler().ServeHTTP(rr,httptest.NewRequest(http.MethodGet,"/v1/consensus",nil))
	if rr.Code!=http.StatusOK { t.Fatalf("status=%d body=%s",rr.Code,rr.Body.String()) }
	var got explorerservice.ConsensusView
	if err:=json.Unmarshal(rr.Body.Bytes(),&got);err!=nil{t.Fatal(err)}
	if got.ChainID!=420 || got.CurrentSlot!=841 || got.NextSlot!=842 || got.ScheduledProposer.Primary!=1 ||
		got.QuorumParticipationPercent!=100 || got.SlotsUntilEpochBoundary!=418 || got.SlotsUntilRotationBoundary!=16798 {
		t.Fatalf("unexpected consensus view: %+v",got)
	}
	if rr.Header().Get("X-420-Canonical-Authority")!="false" || rr.Header().Get("X-420-Data-Source")!="420Indexer" {
		t.Fatalf("missing provenance headers: %v",rr.Header())
	}
}

func TestEXP24ConsensusRouteFailsClosedOnMalformedProjection(t *testing.T) {
	st:=exp24APIStatus(); st.Epoch=99
	s:=newEXP24Server(t,&exp24ConsensusIndexer{fakeIndexer:&fakeIndexer{},status:st})
	rr:=httptest.NewRecorder()
	s.Handler().ServeHTTP(rr,httptest.NewRequest(http.MethodGet,"/v1/consensus",nil))
	if rr.Code!=http.StatusBadGateway { t.Fatalf("status=%d body=%s",rr.Code,rr.Body.String()) }
	if !strings.Contains(rr.Body.String(),"inconsistent epoch position"){t.Fatalf("unexpected body: %s",rr.Body.String())}
}
