package reeferreview

import (
 "context"
 "io"
 "net/http"
 "path/filepath"
 "strings"
 "testing"
 "time"
)

func TestRR8ConditionalCheckpointAndRecovery(t *testing.T) {
 ctx:=context.Background()
 calls:=0
 hc:=&http.Client{Transport:roundTripFunc(func(req *http.Request)(*http.Response,error){
  calls++
  header:=make(http.Header)
  if calls==1 {
   header.Set("ETag", `"revision-1"`)
   return &http.Response{StatusCode:200,Header:header,Body:io.NopCloser(strings.NewReader(`<rss><channel><item><title>Cannabis market</title><link>https://example.test/story</link><description>Marijuana retail</description></item></channel></rss>`)),Request:req},nil
  }
  if req.Header.Get("If-None-Match")!=`"revision-1"` { t.Fatalf("conditional header lost: %q",req.Header.Get("If-None-Match")) }
  return &http.Response{StatusCode:304,Header:header,Body:io.NopCloser(strings.NewReader("")),Request:req},nil
 })}
 store,err:=OpenFileNewsStore(filepath.Join(t.TempDir(),"news.json"))
 if err!=nil { t.Fatal(err) }
 at:=time.Date(2026,10,7,12,0,0,0,time.UTC)
 path:=filepath.Join(t.TempDir(),"checkpoints.json")
 op:=&FeedOperations{Path:path,Sources:testNewsRegistry(),Ingestor:NewsIngestor{Store:store,Fetcher:FeedFetcher{HTTP:hc}},Now:func()time.Time{return at}}
 stats,err:=op.PollDue(ctx)
 if err!=nil || len(stats)!=1 || stats[0].Visible!=1 { t.Fatalf("first poll: %+v %v",stats,err) }
 if _,err=op.PollDue(ctx);err!=nil || calls!=1 { t.Fatalf("cadence bypass calls=%d err=%v",calls,err) }
 op2:=&FeedOperations{Path:path,Sources:testNewsRegistry(),Ingestor:op.Ingestor,Now:func()time.Time{return at.Add(31*time.Minute)}}
 stats,err=op2.PollDue(ctx)
 if err!=nil || len(stats)!=0 || calls!=2 { t.Fatalf("conditional recovery: %+v %v",stats,err) }
 health,err:=op2.Health(ctx)
 if err!=nil || len(health)!=1 || !health[0].LastNotModified || health[0].ETag!=`"revision-1"` || health[0].ConsecutiveFailures!=0 {
  t.Fatalf("checkpoint: %+v %v",health,err)
 }
}

func TestRR8BackoffAndCircuitBreaker(t *testing.T) {
 ctx:=context.Background()
 calls:=0
 hc:=&http.Client{Transport:roundTripFunc(func(r *http.Request)(*http.Response,error){
  calls++
  return &http.Response{StatusCode:503,Header:make(http.Header),Body:io.NopCloser(strings.NewReader("")),Request:r},nil
 })}
 store,_:=OpenFileNewsStore(filepath.Join(t.TempDir(),"news.json"))
 at:=time.Date(2026,10,7,12,0,0,0,time.UTC)
 op:=&FeedOperations{Path:filepath.Join(t.TempDir(),"state.json"),Sources:testNewsRegistry(),Ingestor:NewsIngestor{Store:store,Fetcher:FeedFetcher{HTTP:hc}},Now:func()time.Time{return at}}
 for i:=0;i<5;i++ {
  op.Now=func()time.Time{return at}
  _,err:=op.PollDue(ctx)
  if err==nil { t.Fatal("outage treated as success") }
  health,e:=op.Health(ctx)
  if e!=nil { t.Fatal(e) }
  at=health[0].NextAttempt
 }
 health,_:=op.Health(ctx)
 if health[0].ConsecutiveFailures!=5 || health[0].CircuitOpenUntil.IsZero() { t.Fatalf("breaker failed: %+v",health) }
 _,_ = op.PollDue(ctx)
 if calls!=5 { t.Fatalf("open circuit contacted upstream %d times",calls) }
}
