package reeferreview

import (
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
)

func TestRR9HTTPMetricsBoundedStatusAndNoCredentialContent(t *testing.T) {
 m:=&HTTPMetrics{}
 h:=m.Middleware(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  w.WriteHeader(http.StatusTooManyRequests)
 }))
 request:=httptest.NewRequest("GET","/v1/news?secret=never-log",strings.NewReader("private-body"))
 request.Header.Set("Authorization","Bearer forbidden-token")
 response:=httptest.NewRecorder()
 h.ServeHTTP(response,request)
 if response.Code!=429 || m.Requests.Load()!=1 || m.Errors.Load()!=1 || m.Limited.Load()!=1 {
  t.Fatalf("unexpected counters: %d %d %d",m.Requests.Load(),m.Errors.Load(),m.Limited.Load())
 }
}
