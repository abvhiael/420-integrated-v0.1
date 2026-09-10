package storage

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func transportFixture(t *testing.T, ready bool) (*Service, []byte, Assignment) {
	t.Helper()
	data := []byte("420-provider-transport")
	a := assignmentFor(data,"commitment-http-1","node-http-1")
	projection := &StorageProjection{snapshots:map[string]AssignmentSnapshot{a.AgreementID:{Assignment:a}}}
	store,err:=OpenFileStore(t.TempDir()); if err!=nil{t.Fatal(err)}
	runtime,err:=NewRuntime(a.NodeID,1024,store,projection,nil); if err!=nil{t.Fatal(err)}
	s:=&Service{cfg:ServiceConfig{NodeID:a.NodeID},projection:projection,runtime:runtime,status:ServiceStatus{Ready:ready}}
	return s,data,a
}

func TestTransportFailsClosedUntilProjectionReady(t *testing.T){
	s,data,a:=transportFixture(t,false)
	req:=httptest.NewRequest(http.MethodPut,"/v1/shards/"+a.CommitmentID,bytes.NewReader(data))
	req.ContentLength=int64(len(data))
	w:=httptest.NewRecorder(); NewTransportHandler(s).ServeHTTP(w,req)
	if w.Code!=http.StatusServiceUnavailable{t.Fatalf("status=%d",w.Code)}
}

func TestTransportUploadRetrieveAndRange(t *testing.T){
	s,data,a:=transportFixture(t,true)
	h:=NewTransportHandler(s)
	put:=httptest.NewRequest(http.MethodPut,"/v1/shards/"+a.CommitmentID,bytes.NewReader(data)); put.ContentLength=int64(len(data))
	pw:=httptest.NewRecorder(); h.ServeHTTP(pw,put)
	if pw.Code!=http.StatusCreated{t.Fatalf("put status=%d body=%s",pw.Code,pw.Body.String())}

	get:=httptest.NewRequest(http.MethodGet,"/v1/shards/"+a.CommitmentID,nil)
	gw:=httptest.NewRecorder(); h.ServeHTTP(gw,get)
	if gw.Code!=http.StatusOK || !bytes.Equal(gw.Body.Bytes(),data){t.Fatalf("get status=%d body=%q",gw.Code,gw.Body.Bytes())}
	if gw.Header().Get("ETag")==""{t.Fatal("missing etag")}

	rangeReq:=httptest.NewRequest(http.MethodGet,"/v1/shards/"+a.CommitmentID,nil); rangeReq.Header.Set("Range","bytes=4-11")
	rw:=httptest.NewRecorder(); h.ServeHTTP(rw,rangeReq)
	if rw.Code!=http.StatusPartialContent{t.Fatalf("range status=%d",rw.Code)}
	if !bytes.Equal(rw.Body.Bytes(),data[4:12]){t.Fatalf("range body=%q",rw.Body.Bytes())}
	if rw.Header().Get("Content-Range")!="bytes 4-11/22"{t.Fatalf("content-range=%q",rw.Header().Get("Content-Range"))}
}

func TestTransportCapacityAndMethodGuards(t *testing.T){
	s,_,a:=transportFixture(t,true); h:=NewTransportHandler(s)
	capReq:=httptest.NewRequest(http.MethodGet,"/v1/capacity",nil); cw:=httptest.NewRecorder(); h.ServeHTTP(cw,capReq)
	if cw.Code!=http.StatusOK{t.Fatalf("capacity status=%d",cw.Code)}
	var cap Capacity; if err:=json.Unmarshal(cw.Body.Bytes(),&cap); err!=nil{t.Fatal(err)}
	if cap.TotalBytes!=1024 || cap.UsedBytes!=0{t.Fatalf("capacity=%+v",cap)}

	bad:=httptest.NewRequest(http.MethodPost,"/v1/shards/"+a.CommitmentID,nil); bw:=httptest.NewRecorder(); h.ServeHTTP(bw,bad)
	if bw.Code!=http.StatusMethodNotAllowed{t.Fatalf("method status=%d",bw.Code)}
}

func TestTransportRejectsForeignOrExpiredAssignment(t *testing.T){
	s,data,a:=transportFixture(t,true)
	s.projection.mu.Lock(); snap:=s.projection.snapshots[a.AgreementID]; snap.Assignment.NodeID="other-node"; s.projection.snapshots[a.AgreementID]=snap; s.projection.mu.Unlock()
	req:=httptest.NewRequest(http.MethodPut,"/v1/shards/"+a.CommitmentID,bytes.NewReader(data)); req.ContentLength=int64(len(data))
	w:=httptest.NewRecorder(); NewTransportHandler(s).ServeHTTP(w,req)
	if w.Code!=http.StatusForbidden{t.Fatalf("status=%d",w.Code)}
	if _,_,err:=s.runtime.Retrieve(context.Background(),a.CommitmentID,0,0); err==nil{t.Fatal("foreign assignment should not store")}
}
