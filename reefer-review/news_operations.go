package reeferreview

import (
 "context"
 "encoding/json"
 "errors"
 "fmt"
 "os"
 "path/filepath"
 "sync"
 "time"
)

const feedOperationsSchema = "420-reefer-review-feed-operations-v1"

type FeedSourceHealth struct {
 SourceID string `json:"source_id"`
 LastAttempt time.Time `json:"last_attempt,omitempty"`
 LastSuccess time.Time `json:"last_success,omitempty"`
 NextAttempt time.Time `json:"next_attempt,omitempty"`
 ETag string `json:"etag,omitempty"`
 LastModified string `json:"last_modified,omitempty"`
 ConsecutiveFailures int `json:"consecutive_failures"`
 CircuitOpenUntil time.Time `json:"circuit_open_until,omitempty"`
 LastError string `json:"last_error,omitempty"`
 LastNotModified bool `json:"last_not_modified"`
}

type feedOperationsDisk struct {
 Schema string `json:"schema"`
 Sources map[string]FeedSourceHealth `json:"sources"`
}

// FeedOperations is an owner-controlled, serialized checkpoint store. It is deliberately
// not an authorization source and never overrides canonical publication metadata.
type FeedOperations struct {
 mu sync.Mutex
 Path string
 Sources NewsSourceRegistry
 Ingestor NewsIngestor
 Now func() time.Time
}

func (o *FeedOperations) clock() time.Time {
 if o.Now != nil { return o.Now().UTC() }
 return time.Now().UTC()
}

func (o *FeedOperations) load() (feedOperationsDisk,error) {
 data := feedOperationsDisk{Schema:feedOperationsSchema,Sources:map[string]FeedSourceHealth{}}
 raw,err:=os.ReadFile(o.Path)
 if errors.Is(err,os.ErrNotExist) { return data,nil }
 if err!=nil { return data,err }
 if err=json.Unmarshal(raw,&data);err!=nil { return data,err }
 if data.Schema!=feedOperationsSchema || data.Sources==nil { return data,ErrInvalidInput }
 for id,h:=range data.Sources {
  if id=="" || h.SourceID!=id || h.ConsecutiveFailures<0 { return data,ErrInvalidInput }
 }
 return data,nil
}

func (o *FeedOperations) save(data feedOperationsDisk) error {
 dir:=filepath.Dir(o.Path)
 if err:=os.MkdirAll(dir,0700);err!=nil{return err}
 raw,err:=json.MarshalIndent(data,"","  ")
 if err!=nil{return err}
 f,err:=os.CreateTemp(dir,".reefer-feed-ops-*")
 if err!=nil{return err}
 name:=f.Name()
 defer os.Remove(name)
 defer f.Close()
 if err=f.Chmod(0600);err!=nil{return err}
 if _,err=f.Write(raw);err!=nil{return err}
 if err=f.Sync();err!=nil{return err}
 if err=f.Close();err!=nil{return err}
 if err=os.Rename(name,o.Path);err!=nil{return err}
 d,err:=os.Open(dir)
 if err!=nil{return err}
 defer d.Close()
 return d.Sync()
}

func (o *FeedOperations) validate() error {
 if o==nil || o.Path=="" || o.Ingestor.Store==nil { return ErrInvalidInput }
 return ValidateNewsSourceRegistry(o.Sources)
}

func (o *FeedOperations) Health(ctx context.Context) ([]FeedSourceHealth,error) {
 if err:=o.validate();err!=nil{return nil,err}
 if err:=ctx.Err();err!=nil{return nil,err}
 o.mu.Lock();defer o.mu.Unlock()
 state,err:=o.load();if err!=nil{return nil,err}
 out:=make([]FeedSourceHealth,0,len(o.Sources.Sources))
 for _,src:=range o.Sources.Sources {
  h:=state.Sources[src.ID];h.SourceID=src.ID
  out=append(out,h)
 }
 return out,nil
}

// PollDue applies per-source cadence, exponential backoff and a bounded circuit
// breaker. Checkpoints are persisted after each source attempt, including 304s.
func (o *FeedOperations) PollDue(ctx context.Context) ([]NewsIngestStats,error) {
 if err:=o.validate();err!=nil{return nil,err}
 o.mu.Lock();defer o.mu.Unlock()
 state,err:=o.load();if err!=nil{return nil,err}
 now:=o.clock()
 var stats []NewsIngestStats
 var failures []error
 for _,src:=range o.Sources.EnabledSources() {
  if err:=ctx.Err();err!=nil{return stats,err}
  h:=state.Sources[src.ID];h.SourceID=src.ID
  if now.Before(h.NextAttempt) || now.Before(h.CircuitOpenUntil) { continue }
  h.LastAttempt=now
  entries,etag,modified,notModified,fetchErr:=o.Ingestor.Fetcher.FetchConditional(ctx,src,h.ETag,h.LastModified)
  if fetchErr==nil && !notModified {
   items:=make([]ExternalNewsItem,0,len(entries))
   for _,entry:=range entries {
    item,e:=normalizeNewsEntry(src,entry,now)
    if e==nil { items=append(items,item) }
   }
   var result NewsIngestStats
   result,fetchErr=o.Ingestor.Store.UpsertMany(ctx,items)
   result.SourceID=src.ID
   if fetchErr==nil { stats=append(stats,result) }
  }
  if fetchErr!=nil {
   h.ConsecutiveFailures++
   h.LastError=fetchErr.Error()
   if len(h.LastError)>256 { h.LastError=h.LastError[:256] }
   delay:=time.Minute
   for n:=1;n<h.ConsecutiveFailures && delay<time.Hour;n++ { delay*=2 }
   if delay>time.Hour { delay=time.Hour }
   h.NextAttempt=now.Add(delay)
   if h.ConsecutiveFailures>=5 { h.CircuitOpenUntil=now.Add(time.Hour) }
   failures=append(failures,fmt.Errorf("source %s: %w",src.ID,fetchErr))
  } else {
   h.ConsecutiveFailures=0
   h.LastError=""
   h.CircuitOpenUntil=time.Time{}
   h.LastSuccess=now
   h.LastNotModified=notModified
   h.NextAttempt=now.Add(time.Duration(src.PollIntervalMinutes)*time.Minute)
   if !notModified { h.ETag=etag;h.LastModified=modified }
  }
  state.Sources[src.ID]=h
  if err:=o.save(state);err!=nil{return stats,err}
 }
 return stats,errors.Join(failures...)
}

func (o *FeedOperations) Run(ctx context.Context, interval time.Duration) error {
 if interval<time.Second { return ErrInvalidInput }
 ticker:=time.NewTicker(interval)
 defer ticker.Stop()
 for {
  _,_ = o.PollDue(ctx)
  select {
  case <-ctx.Done(): return ctx.Err()
  case <-ticker.C:
  }
 }
}
