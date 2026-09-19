package discovery

import (
 "errors"
 "fmt"
 "net/url"
 "strings"
 "time"

 eventdiscovery "github.com/420integrated/420-integrated/events/discovery"
 "github.com/420integrated/420-integrated/search/architecture"
 searchresult "github.com/420integrated/420-integrated/search/result"
)

// EventProjection is a rebuildable, read-only adapter from the public 420Events
// discovery snapshot. It never changes event lifecycle or access control.
type EventProjection struct { Index *eventdiscovery.Index; Now func() time.Time }

const maxEventProjectionRows = 10000

// Project returns a complete bounded set of public occurrence results. The
// caller must Rebuild the event index from the canonical repository before
// projecting; Search never gains authority over private event state.
func (p EventProjection) Project(from,to time.Time)([]searchresult.Result,error){
 if p.Index==nil{return nil,errors.New("event discovery index required")}
 if p.Now==nil{return nil,errors.New("projection clock required")}
 indexedAt:=p.Now().UTC();if indexedAt.IsZero(){return nil,errors.New("invalid projection time")}
 output:=make([]searchresult.Result,0)
 for offset:=0;;offset+=eventdiscovery.MaxResults{
  if offset>=maxEventProjectionRows{return nil,errors.New("event projection capacity exceeded")}
  rows,err:=p.Index.Search(eventdiscovery.Query{From:from,To:to,Limit:eventdiscovery.MaxResults,Offset:offset})
  if err!=nil{return nil,err}
  for _,entry:=range rows{
   // Use both the canonical event ID and original occurrence start as a
   // stable identity. A series produces distinct, reproducible result IDs.
   key:=fmt.Sprintf("%s|%s",entry.EventID,entry.OriginalStartAt.UTC().Format(time.RFC3339Nano))
   presentation:=searchresult.Presentation{
    Title:entry.Title,Category:"event",
    CanonicalURL:"/events/"+url.PathEscape(entry.EventID)+"?occurrence="+url.QueryEscape(entry.OriginalStartAt.UTC().Format(time.RFC3339Nano)),
    Tags:append([]string(nil),entry.Tags...),
   }
   r,err:=searchresult.New(architecture.ResultDomain("event"),key,architecture.SearchModeDiscovery,
    searchresult.Provenance{Source:architecture.SourceBoundary("420Events:public"),Authority:"420Events canonical public event repository",Finality:searchresult.FinalityUnknown,IndexedAt:indexedAt},presentation)
   if err!=nil{return nil,err}
   if strings.TrimSpace(r.Presentation.Title)==""{return nil,errors.New("event projection missing title")}
   output=append(output,r)
  }
  if len(rows)<eventdiscovery.MaxResults{break}
 }
 return output,nil
}
