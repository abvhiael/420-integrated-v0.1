package discovery

import (
 "errors"
 "sort"
 "strings"
 "sync"
 "time"

 "github.com/420integrated/420-integrated/events/model"
 "github.com/420integrated/420-integrated/events/recurrence"
)

// Source is the canonical event repository, not a secondary lifecycle authority.
type Source interface { ListAll() []model.Event }

type Entry struct {
 EventID string
 Title string
 PlaceID string
 Tags []string
 StartAt time.Time
 EndAt time.Time
 OriginalStartAt time.Time
 Timezone string
 Version uint32
}

type Query struct {
 From time.Time
 To time.Time
 PlaceID string
 Tag string
 Text string
 Limit int
 Offset int
}

const MaxResults = 100
const MaxWindow = 366 * 24 * time.Hour
const MaxIndexed = 100000

type Index struct {
 mu sync.RWMutex
 entries []Entry
}

func New() *Index { return &Index{} }

func public(e model.Event) bool {
 return e.Visibility==model.VisibilityPublic && (e.Status==model.StatusScheduled || e.Status==model.StatusLive)
}

// Rebuild atomically replaces the projection. Failed rebuilds preserve the old
// snapshot. Public discovery never exposes private or cancelled events.
func (i *Index) Rebuild(source Source, from,to time.Time) error {
 if source==nil{return errors.New("event discovery source is required")}
 if err:=window(from,to);err!=nil{return err}
 next:=make([]Entry,0)
 for _,e:=range source.ListAll(){
  if !public(e){continue}
  if err:=e.Validate();err!=nil{return err}
  occurrences:=[]recurrence.Occurrence{}
  if e.Recurrence!=nil {
   expanded,err:=recurrence.ExpandEvent(e,from,to);if err!=nil{return err}
   occurrences=expanded
  }else if !e.StartAt.Before(from)&&!e.StartAt.After(to){
   occurrences=[]recurrence.Occurrence{{EventID:e.ID,StartAt:e.StartAt.UTC(),EndAt:e.EndAt.UTC(),OriginalStartAt:e.StartAt.UTC(),Timezone:e.Timezone}}
  }
  for _,o:=range occurrences {
   if o.Cancelled {continue}
   next=append(next,Entry{EventID:e.ID,Title:e.Title,PlaceID:e.PlaceID,Tags:append([]string(nil),e.Tags...),StartAt:o.StartAt,EndAt:o.EndAt,OriginalStartAt:o.OriginalStartAt,Timezone:o.Timezone,Version:e.Version})
   if len(next)>MaxIndexed{return errors.New("event discovery index capacity exceeded")}
  }
 }
 sort.Slice(next,func(a,b int)bool{
  x,y:=next[a],next[b]
  if !x.StartAt.Equal(y.StartAt){return x.StartAt.Before(y.StartAt)}
  if x.EventID!=y.EventID{return x.EventID<y.EventID}
  return x.OriginalStartAt.Before(y.OriginalStartAt)
 })
 i.mu.Lock();i.entries=next;i.mu.Unlock()
 return nil
}

func window(from,to time.Time)error{
 if from.IsZero()||to.IsZero()||to.Before(from)||to.Sub(from)>MaxWindow{return errors.New("invalid or excessive discovery time window")}
 return nil
}

// Search never exposes the backing slices. The requested window must be
// covered by the caller's most recent Rebuild window; rebuilding is explicit
// so repository changes cannot silently produce partially updated results.
func(i *Index) Search(q Query)([]Entry,error){
 if err:=window(q.From,q.To);err!=nil{return nil,err}
 if q.Limit<1||q.Limit>MaxResults||q.Offset<0{return nil,errors.New("invalid discovery pagination")}
 place:=strings.TrimSpace(q.PlaceID)
 tag:=strings.ToLower(strings.TrimSpace(q.Tag))
 phrase:=strings.ToLower(strings.TrimSpace(q.Text))
 i.mu.RLock();defer i.mu.RUnlock()
 out:=make([]Entry,0,q.Limit)
 skipped:=0
 for _,entry:=range i.entries{
  if entry.StartAt.Before(q.From)||entry.StartAt.After(q.To)||place!=""&&entry.PlaceID!=place{continue}
  if phrase!=""&&!strings.Contains(strings.ToLower(entry.Title),phrase){continue}
  if tag!=""{
   found:=false
   for _,v:=range entry.Tags{if strings.EqualFold(v,tag){found=true;break}}
   if !found{continue}
  }
  if skipped<q.Offset{skipped++;continue}
  copy:=entry;copy.Tags=append([]string(nil),entry.Tags...)
  out=append(out,copy)
  if len(out)==q.Limit{break}
 }
 return out,nil
}
