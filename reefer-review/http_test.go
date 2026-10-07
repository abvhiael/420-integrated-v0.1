package reeferreview

import (
 "bytes"
 "encoding/json"
 "net/http"
 "net/http/httptest"
 "testing"
)

func TestHTTPJourney006Baseline(t *testing.T){
 h:=HTTP{Service:testService()}.Handler()
 body:=[]byte(`{"idempotency_key":"journey-006","title":"News","body":"hello","visibility":"PUBLIC"}`)
 req:=httptest.NewRequest(http.MethodPost,"/v1/publications",bytes.NewReader(body));req.Header.Set("X-420-Actor","writer.420")
 rr:=httptest.NewRecorder();h.ServeHTTP(rr,req);if rr.Code!=200{t.Fatalf("draft status %d %s",rr.Code,rr.Body.String())}
 var out map[string]any;if err:=json.Unmarshal(rr.Body.Bytes(),&out);err!=nil{t.Fatal(err)}
 data:=out["data"].(map[string]any);id:=data["id"].(string)
 req=httptest.NewRequest(http.MethodPost,"/v1/publications/"+id+"/publish",nil);req.Header.Set("X-420-Actor","writer.420");rr=httptest.NewRecorder();h.ServeHTTP(rr,req);if rr.Code!=200{t.Fatalf("publish %d %s",rr.Code,rr.Body.String())}
 req=httptest.NewRequest(http.MethodGet,"/v1/publications?limit=10",nil);rr=httptest.NewRecorder();h.ServeHTTP(rr,req);if rr.Code!=200{t.Fatalf("list %d",rr.Code)}
}
func TestHTTPRejectsOversizedOrMissingActor(t *testing.T){
 h:=HTTP{Service:testService()}.Handler();req:=httptest.NewRequest(http.MethodPost,"/v1/publications",bytes.NewReader([]byte(`{"idempotency_key":"x","title":"A","body":"b","visibility":"PUBLIC"}`));rr:=httptest.NewRecorder();h.ServeHTTP(rr,req);if rr.Code!=400{t.Fatalf("expected 400 got %d",rr.Code)}
}
