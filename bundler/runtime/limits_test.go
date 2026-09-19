package runtime

import (
 "net/http"
 "net/http/httptest"
 "testing"
)

func TestLimitConcurrentRejectsExcessWithoutStartingHandler(t *testing.T){
 entered:=make(chan struct{})
 release:=make(chan struct{})
 exited:=make(chan struct{})
 handled:=0
 handler,err:=LimitConcurrent(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  handled++
  close(entered)
  <-release
  w.WriteHeader(http.StatusOK)
 }),1)
 if err!=nil{t.Fatal(err)}
 go func(){handler.ServeHTTP(httptest.NewRecorder(),httptest.NewRequest(http.MethodPost,"/",nil));close(exited)}()
 <-entered
 second:=httptest.NewRecorder()
 handler.ServeHTTP(second,httptest.NewRequest(http.MethodPost,"/",nil))
 if second.Code!=http.StatusServiceUnavailable||second.Header().Get("Retry-After")!="1"{t.Fatalf("expected bounded overload response: %d",second.Code)}
 close(release)
 <-exited
 if handled!=1{t.Fatalf("excess request reached backend: %d",handled)}
}

func TestLimitConcurrentRejectsInvalidConfiguration(t *testing.T){
 for _,limit:=range []int{-1,0,4097}{
  if _,err:=LimitConcurrent(http.HandlerFunc(func(http.ResponseWriter,*http.Request){}),limit);err==nil{t.Fatalf("accepted invalid limit %d",limit)}
 }
 if _,err:=LimitConcurrent(nil,1);err==nil{t.Fatal("accepted nil handler")}
}
