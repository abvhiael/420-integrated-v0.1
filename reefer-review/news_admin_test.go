package reeferreview

import (
 "bytes"
 "context"
 "encoding/json"
 "net/http"
 "net/http/httptest"
 "os"
 "path/filepath"
 "testing"
 "time"
)

func TestRR11SourceAdminPersistsAndRejectsUnauthorized(t *testing.T) {
 dir:=t.TempDir()
 path:=filepath.Join(dir,"sources.json")
 registry:=testNewsRegistry()
 if err:=persistNewsRegistry(path,registry);err!=nil {t.Fatal(err)}
 store,err:=OpenFileNewsStore(filepath.Join(dir,"news.json"))
 if err!=nil {t.Fatal(err)}
 service:=&NewsService{Store:store,Sources:registry,SourcesPath:path}
 h:=HTTP{Service:testService(),News:service}
 if _,protected:=sessionRequirements(http.MethodPut,"/v1/admin/news/sources");!protected {t.Fatal("source writes must require verified capability")}
 req:=httptest.NewRequest(http.MethodPut,"/v1/admin/news/sources",bytes.NewBufferString("{}"))
 rr:=httptest.NewRecorder()
 h.Handler().ServeHTTP(rr,req)
 if rr.Code!=http.StatusServiceUnavailable {t.Fatalf("absent verifier must fail closed, got %d",rr.Code)}
 source:=registry.Sources[0]
 source.Category="canada"
 source.Language="en"
 source.AllowExcerpt=false
 source.AllowImage=false
 source.PollIntervalMinutes=30
 payload,_:=json.Marshal(map[string]any{"source":source})
 // A forged context without a signed session does not bypass public middleware.
 req=httptest.NewRequest(http.MethodPut,"/v1/admin/news/sources",bytes.NewReader(payload))
 req=req.WithContext(withSessionClaims(req.Context(),SessionClaims{Subject:"forged",Capabilities:map[string]bool{CapabilityModerator:true}}))
 rr=httptest.NewRecorder()
 h.Handler().ServeHTTP(rr,req)
 if rr.Code!=http.StatusServiceUnavailable {t.Fatalf("forged session must fail closed, got %d",rr.Code)}
 // Test authorized handler boundary separately; the session verifier itself is
 // covered by the retained security suite.
 req=httptest.NewRequest(http.MethodPut,"/v1/admin/news/sources",bytes.NewReader(payload))
 req=req.WithContext(withSessionClaims(context.Background(),SessionClaims{Subject:"editor",Capabilities:map[string]bool{CapabilityModerator:true}}))
 rr=httptest.NewRecorder()
 h.newsAdminSources(rr,req)
 if rr.Code!=http.StatusOK {t.Fatalf("moderator PUT: %d %s",rr.Code,rr.Body.String())}
 reloaded,err:=LoadNewsSourceRegistry(path)
 if err!=nil {t.Fatal(err)}
 if reloaded.Sources[0].Category!="canada" {t.Fatal("updated source not persisted")}
 if _,err:=os.Stat(path);err!=nil {t.Fatal(err)}
}

func TestRR11SourceAdminRejectsSSRFAndOverlongBody(t *testing.T) {
 dir:=t.TempDir();path:=filepath.Join(dir,"sources.json")
 registry:=testNewsRegistry()
 if err:=persistNewsRegistry(path,registry);err!=nil {t.Fatal(err)}
 store,_:=OpenFileNewsStore(filepath.Join(dir,"news.json"))
 h:=HTTP{News:&NewsService{Store:store,Sources:registry,SourcesPath:path}}
 claims:=SessionClaims{Subject:"moderator",Capabilities:map[string]bool{CapabilityModerator:true}}
 for _,url:=range []string{"http://127.0.0.1/feed","https://localhost/feed","https://169.254.169.254/latest/meta-data/"} {
  source:=registry.Sources[0];source.FeedURL=url;source.Category="canada";source.Language="en";source.AllowExcerpt=false;source.PollIntervalMinutes=30
  payload,_:=json.Marshal(map[string]any{"source":source})
  req:=httptest.NewRequest(http.MethodPut,"/v1/admin/news/sources",bytes.NewReader(payload))
  req=req.WithContext(withSessionClaims(req.Context(),claims))
  rr:=httptest.NewRecorder();h.newsAdminSources(rr,req)
  if rr.Code!=http.StatusBadRequest {t.Fatalf("expected SSRF reject for %s: %d %s",url,rr.Code,rr.Body.String())}
 }
 source:=registry.Sources[0];source.Category="canada";source.Language="en";source.AllowExcerpt=false;source.PollIntervalMinutes=30
 source.Attribution="a"+string(bytes.Repeat([]byte("x"),9000))
 payload,_:=json.Marshal(map[string]any{"source":source})
 req:=httptest.NewRequest(http.MethodPut,"/v1/admin/news/sources",bytes.NewReader(payload))
 req=req.WithContext(withSessionClaims(req.Context(),claims))
 rr:=httptest.NewRecorder();h.newsAdminSources(rr,req)
 if rr.Code!=http.StatusBadRequest {t.Fatalf("oversized body accepted: %d",rr.Code)}
}

func TestRR11SourceRegistryReloads(t *testing.T) {
 dir:=t.TempDir();path:=filepath.Join(dir,"sources.json")
 registry:=testNewsRegistry()
 if err:=persistNewsRegistry(path,registry);err!=nil {t.Fatal(err)}
 store,_:=OpenFileNewsStore(filepath.Join(dir,"news.json"))
 s:=NewsService{Store:store,Sources:registry,SourcesPath:path}
 registry.Sources[0].Enabled=false
 if err:=persistNewsRegistry(path,registry);err!=nil {t.Fatal(err)}
 sources,err:=s.PublicSources();if err!=nil {t.Fatal(err)}
 if len(sources)!=0 {t.Fatal("disabled source leaked in public list")}
 _=time.Now()
}
