package social

import (
 "context"
 "errors"
 "net/http"
 "strings"
)

// These are private off-chain account features, never the chain-backed
// /messages or /games authority. Caller identity comes exclusively from
// a freshly introspected 420ID app session in ServeHTTP.
func (h *Handler) accountExtras(ctx context.Context,w http.ResponseWriter,r *http.Request,viewer string){
 if h.Messages==nil||h.Games==nil{deny(w,404);return}
 path:=r.URL.Path
 if path=="/v1/messages"{
  if r.Method=="GET"{
   items,e:=h.Messages.Inbox(ctx,viewer);if e!=nil{deny(w,503);return}
   writeJSON(w,200,map[string]any{"peers":items,"onChain":false,"encryption":"server-at-rest"});return
  }
  if r.Method=="POST"{
   var req struct{Target string `json:"target"`;Body string `json:"body"`}
   if strictJSON(r,&req)!=nil{deny(w,400);return}
   message,e:=h.Messages.Send(ctx,viewer,req.Target,req.Body)
   if errors.Is(e,ErrInvalid){deny(w,400);return}
   if errors.Is(e,ErrNotFound){deny(w,404);return}
   if errors.Is(e,ErrForbidden){deny(w,403);return}
   if e!=nil{deny(w,503);return}
   writeJSON(w,201,map[string]any{"message":message,"onChain":false});return
  }
  deny(w,405);return
 }
 if strings.HasPrefix(path,"/v1/messages/item/"){
  id:=strings.TrimPrefix(path,"/v1/messages/item/")
  if !uuid.MatchString(id)||r.Method!="DELETE"{deny(w,404);return}
  if strictJSON(r,&struct{}{})!=nil{deny(w,400);return}
  e:=h.Messages.Delete(ctx,viewer,id)
  if errors.Is(e,ErrNotFound){deny(w,404);return}
  if errors.Is(e,ErrInvalid){deny(w,400);return}
  if e!=nil{deny(w,503);return}
  writeJSON(w,200,map[string]bool{"deletedForCaller":true});return
 }
 if strings.HasPrefix(path,"/v1/messages/"){
  target:=strings.TrimPrefix(path,"/v1/messages/")
  if r.Method!="GET"||!uuid.MatchString(target){deny(w,404);return}
  messages,e:=h.Messages.Thread(ctx,viewer,target)
  if errors.Is(e,ErrForbidden){deny(w,403);return}
  if errors.Is(e,ErrInvalid){deny(w,400);return}
  if e!=nil{deny(w,503);return}
  writeJSON(w,200,map[string]any{"messages":messages,"onChain":false,"encryption":"server-at-rest"});return
 }
 if path=="/v1/account-games"{
  if r.Method=="GET"{
   games,e:=h.Games.List(ctx,viewer);if e!=nil{deny(w,503);return}
   writeJSON(w,200,map[string]any{"games":games,"onChain":false,"wager":false,"rewards":false});return
  }
  if r.Method=="POST"{
   var req struct{Target string `json:"target"`;Kind string `json:"kind"`}
   if strictJSON(r,&req)!=nil{deny(w,400);return}
   game,e:=h.Games.Invite(ctx,viewer,req.Target,req.Kind)
   if errors.Is(e,ErrInvalid){deny(w,400);return}
   if errors.Is(e,ErrNotFound){deny(w,404);return}
   if errors.Is(e,ErrForbidden){deny(w,403);return}
   if e!=nil{deny(w,503);return}
   writeJSON(w,201,map[string]any{"game":game,"onChain":false,"wager":false});return
  }
  deny(w,405);return
 }
 if strings.HasPrefix(path,"/v1/account-games/"){
  parts:=strings.Split(strings.TrimPrefix(path,"/v1/account-games/"),"/")
  if len(parts)>2||len(parts)<1||!uuid.MatchString(parts[0]){deny(w,404);return}
  id:=parts[0]
  if len(parts)==1&&r.Method=="GET"{
   game,moves,e:=h.Games.Get(ctx,viewer,id)
   if errors.Is(e,ErrNotFound){deny(w,404);return}
   if e!=nil{deny(w,503);return}
   writeJSON(w,200,map[string]any{"game":game,"history":moves,"onChain":false,"wager":false,"rewards":false});return
  }
  if len(parts)==2&&parts[1]=="respond"&&r.Method=="POST"{
   var req struct{Accept *bool `json:"accept"`}
   if strictJSON(r,&req)!=nil||req.Accept==nil{deny(w,400);return}
   game,e:=h.Games.Respond(ctx,viewer,id,*req.Accept)
   h.gameResponse(w,game,e);return
  }
  if len(parts)==2&&parts[1]=="move"&&r.Method=="POST"{
   var req struct{Position int `json:"position"`;ExpectedMove int `json:"expectedMove"`}
   if strictJSON(r,&req)!=nil{deny(w,400);return}
   game,e:=h.Games.Move(ctx,viewer,id,req.Position,req.ExpectedMove)
   h.gameResponse(w,game,e);return
  }
  deny(w,404);return
 }
 deny(w,404)
}
func (h *Handler) gameResponse(w http.ResponseWriter,g Game,e error){
 if errors.Is(e,ErrInvalid){deny(w,400);return}
 if errors.Is(e,ErrNotFound){deny(w,404);return}
 if errors.Is(e,ErrForbidden){deny(w,403);return}
 if errors.Is(e,ErrConflict){deny(w,409);return}
 if e!=nil{deny(w,503);return}
 writeJSON(w,200,map[string]any{"game":g,"onChain":false,"wager":false,"rewards":false})
}
