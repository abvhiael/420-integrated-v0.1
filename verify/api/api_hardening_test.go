package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSubmissionRejectsSecretBearingPayload(t *testing.T) {
	s,record,submitted:=fixture(t)
	service,_:=New(s,processorStub{record:record})
	body,_:=json.Marshal(SubmissionRequest{ChainID:420,Address:record.Deployment.Address,Submission:submitted})
	body=bytes.TrimSuffix(body,[]byte("}"))
	body=append(body,[]byte(`,"privateKey":"0xdeadbeef"}`)...)
	w:=httptest.NewRecorder()
	service.Handler().ServeHTTP(w,httptest.NewRequest(http.MethodPost,"/v1/verify/submissions",bytes.NewReader(body)))
	if w.Code!=http.StatusBadRequest {t.Fatalf("status=%d body=%s",w.Code,w.Body.String())}
	if !strings.Contains(w.Body.String(),"secret-bearing field") {t.Fatalf("unexpected body=%s",w.Body.String())}
}

func TestLookupRejectsNonHexAddressAndHash(t *testing.T) {
	s,_,_:=fixture(t); service,_:=New(s,nil)
	badAddress := "/v1/verify/420/0xzz11111111111111111111111111111111111111/0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
	w:=httptest.NewRecorder(); service.Handler().ServeHTTP(w,httptest.NewRequest(http.MethodGet,badAddress,nil))
	if w.Code!=http.StatusBadRequest {t.Fatalf("bad address status=%d",w.Code)}

	badHash := "/v1/verify/420/0x1111111111111111111111111111111111111111/0xzzdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
	w=httptest.NewRecorder(); service.Handler().ServeHTTP(w,httptest.NewRequest(http.MethodGet,badHash,nil))
	if w.Code!=http.StatusBadRequest {t.Fatalf("bad hash status=%d",w.Code)}
}

func TestEvidenceLookupRejectsMalformedRecordHash(t *testing.T) {
	s,_,_:=fixture(t); service,_:=New(s,nil)
	w:=httptest.NewRecorder(); service.Handler().ServeHTTP(w,httptest.NewRequest(http.MethodGet,"/v1/verify/evidence/sha256:not-a-hash",nil))
	if w.Code!=http.StatusBadRequest {t.Fatalf("status=%d body=%s",w.Code,w.Body.String())}
}

func TestSubmissionRejectsTrailingJSON(t *testing.T) {
	s,record,submitted:=fixture(t); service,_:=New(s,processorStub{record:record})
	body,_:=json.Marshal(SubmissionRequest{ChainID:420,Address:record.Deployment.Address,Submission:submitted})
	body=append(body,[]byte(` {"extra":true}`)...)
	w:=httptest.NewRecorder(); service.Handler().ServeHTTP(w,httptest.NewRequest(http.MethodPost,"/v1/verify/submissions",bytes.NewReader(body)))
	if w.Code!=http.StatusBadRequest {t.Fatalf("status=%d body=%s",w.Code,w.Body.String())}
}
