package social

import (
 "context"
 "errors"
 "net/http"
 "strings"
)

// All routes use the existing 420ID session introspection, Origin/CSRF
// restrictions, strict JSON decoder and subject-keyed rate limits.
func (h *Handler) classicRoomsHTTP(ctx context.Context,w http.ResponseWriter,r *http.Request,viewer string){
 if h.Rooms==nil{deny(w,404);return}
 path:=r.URL.Path
 if path=="/v1/classic-rooms"{
  if r.Method=="GET"{
   rooms,e:=h.Rooms.List(ctx,viewer);if e!=nil{classicRoomError(w,e);return}
   writeJSON(w,200,map[string]any{"rooms":rooms,"onChain":false,"wager":false,"rewards":false,"playable":false});return
  }
  if r.Method=="POST"{
   var req struct{
    GameID string `json:"gameId"`
    Visibility string `json:"visibility"`
    SeatCount int `json:"seatCount"`
   }
   if strictJSON(r,&req)!=nil{deny(w,400);return}
   room,e:=h.Rooms.Create(ctx,viewer,req.GameID,req.Visibility,req.SeatCount)
   if e!=nil{classicRoomError(w,e);return}
   writeJSON(w,201,map[string]any{"room":room,"onChain":false,"wager":false,"rewards":false,"playable":false});return
  }
  deny(w,405);return
 }
 if path=="/v1/classic-rooms/friends"{
  if r.Method!="GET"{deny(w,405);return}
  friends,e:=h.Rooms.Friends(ctx,viewer);if e!=nil{classicRoomError(w,e);return}
  writeJSON(w,200,map[string]any{"friends":friends,"onChain":false});return
 }
 if !strings.HasPrefix(path,"/v1/classic-rooms/"){deny(w,404);return}
 parts:=strings.Split(strings.TrimPrefix(path,"/v1/classic-rooms/"),"/")
 if len(parts)<1||len(parts)>2||!uuid.MatchString(parts[0]){deny(w,404);return}
 id:=parts[0]
 if len(parts)==1&&r.Method=="GET"{
  room,e:=h.Rooms.Get(ctx,viewer,id);if e!=nil{classicRoomError(w,e);return}
  writeJSON(w,200,map[string]any{"room":room,"onChain":false,"wager":false,"rewards":false,"playable":false});return
 }
 if len(parts)==2&&parts[1]=="change"&&r.Method=="POST"{
  var req RoomChange
  if strictJSON(r,&req)!=nil{deny(w,400);return}
  room,e:=h.Rooms.Change(ctx,viewer,id,req)
  if e!=nil{classicRoomError(w,e);return}
  writeJSON(w,200,map[string]any{"room":room,"onChain":false,"wager":false,"rewards":false,"playable":false});return
 }
 deny(w,404)
}
func classicRoomError(w http.ResponseWriter,e error){
 switch{
 case errors.Is(e,ErrInvalid):deny(w,400)
 case errors.Is(e,ErrNotFound):deny(w,404)
 case errors.Is(e,ErrForbidden):deny(w,403)
 case errors.Is(e,ErrConflict):deny(w,409)
 default:deny(w,503)
 }
}
