package social

import (
 "context"
 "encoding/json"
 "errors"
 "fmt"
 "net/http"
 "strconv"
 "strings"
 "time"
)

// Account-bound session API, no wallet and no unqualified user game state.
func (h *Handler) classicSessionsHTTP(ctx context.Context,w http.ResponseWriter,r *http.Request,viewer string){
 if h.Sessions==nil{deny(w,404);return}
 path:=r.URL.Path
 if path=="/v1/classic-sessions"{
  switch r.Method{
  case "GET":
   items,e:=h.Sessions.List(ctx,viewer);if e!=nil{classicRoomError(w,e);return}
   writeJSON(w,200,map[string]any{"sessions":items,"onChain":false,"wager":false,"rewards":false})
  case "POST":
   var req struct{RoomID string `json:"roomId"`}
   if strictJSON(r,&req)!=nil{deny(w,400);return}
   session,e:=h.Sessions.Start(ctx,viewer,req.RoomID)
   if e!=nil{classicRoomError(w,e);return}
   writeJSON(w,201,map[string]any{"session":session,"onChain":false,"wager":false,"rewards":false})
  default:deny(w,405)
  }
  return
 }
 if !strings.HasPrefix(path,"/v1/classic-sessions/"){deny(w,404);return}
 parts:=strings.Split(strings.TrimPrefix(path,"/v1/classic-sessions/"),"/")
 if len(parts)<1||len(parts)>2||!uuid.MatchString(parts[0]){deny(w,404);return}
 id:=parts[0]
 if len(parts)==1&&r.Method=="GET"{
  state,e:=h.Sessions.Get(ctx,viewer,id);if e!=nil{classicRoomError(w,e);return}
  writeJSON(w,200,map[string]any{"session":state,"onChain":false,"wager":false,"rewards":false});return
 }
 if len(parts)==2&&parts[1]=="action"&&r.Method=="POST"{
  var req ClassicSessionAction
  if strictJSON(r,&req)!=nil{deny(w,400);return}
  state,e:=h.Sessions.Act(ctx,viewer,id,req)
  if e!=nil{classicRoomError(w,e);return}
  writeJSON(w,200,map[string]any{"session":state,"onChain":false,"wager":false,"rewards":false});return
 }
 if len(parts)==2&&parts[1]=="events"&&r.Method=="GET"{
  after,e:=sessionAfter(r)
  if e!=nil{deny(w,400);return}
  events,high,e:=h.Sessions.Events(ctx,viewer,id,after)
  if e!=nil{classicRoomError(w,e);return}
  writeJSON(w,200,map[string]any{"events":events,"sequence":high,"onChain":false,"wager":false,"rewards":false});return
 }
 if len(parts)==2&&parts[1]=="stream"&&r.Method=="GET"{
  if r.URL.RawQuery!=""{deny(w,400);return}
  h.classicSessionStream(ctx,w,r,viewer,id);return
 }
 deny(w,404)
}
func sessionAfter(r *http.Request)(int64,error){
 q:=r.URL.Query()
 if len(q)>1||len(q["after"])>1{return 0,ErrInvalid}
 if len(q)==0{return 0,nil}
 raw:=q.Get("after")
 if raw==""||len(raw)>18||strings.HasPrefix(raw,"+"){return 0,ErrInvalid}
 value,e:=strconv.ParseInt(raw,10,64)
 if e!=nil||value<0{return 0,ErrInvalid}
 return value,nil
}
// Bounded, re-authenticated SSE provides push-style reconnectable events.
// The equivalent GET /events?after=N endpoint provides proxy-safe polling.
// Neither transports concealed game state or a browser-supplied score.
func (h *Handler) classicSessionStream(ctx context.Context,w http.ResponseWriter,r *http.Request,viewer,id string){
 after:=int64(0)
 if head:=r.Header.Get("Last-Event-ID");head!=""{
  if len(head)>18{deny(w,400);return}
  var e error;after,e=strconv.ParseInt(head,10,64)
  if e!=nil||after<0{deny(w,400);return}
 }
 if _,_,e:=h.Sessions.Events(ctx,viewer,id,after);e!=nil{
  classicRoomError(w,e);return
 }
 flusher,ok:=w.(http.Flusher);if !ok{deny(w,503);return}
 w.Header().Set("Content-Type","text/event-stream")
 w.Header().Set("Cache-Control","no-store")
 w.Header().Set("X-Accel-Buffering","no")
 w.WriteHeader(200)
 _,_=fmt.Fprint(w,": 420ID session events\n\n");flusher.Flush()
 clock:=time.NewTicker(time.Second)
 defer clock.Stop()
 end:=time.NewTimer(6*time.Second)
 defer end.Stop()
 for{
  // Check both the cookie principal and seat/block permission before
  // every event batch, including during account revocations.
  principal,e:=h.SignOn.Verify(ctx,getCookie(r,sessionCookieName))
  if e!=nil||principal!=viewer{return}
  items,_,e:=h.Sessions.Events(ctx,viewer,id,after)
  if e!=nil{return}
  for _,event:=range items{
   data,e:=json.Marshal(event);if e!=nil{return}
   if _,e=fmt.Fprintf(w,"id: %d\nevent: state\ndata: %s\n\n",event.Sequence,data);e!=nil{return}
   after=event.Sequence
  }
  if len(items)>0{flusher.Flush()}
  select{
  case <-ctx.Done():return
  case <-end.C:return
  case <-clock.C:
  }
 }
}
