package account

import (
 "context"
 "errors"
 "net/http"
)

// These are first-party 420ID owner-only endpoints. No payment provider,
// browser-supplied wallet, reward amount or payout identifier is accepted.
func (h *AcceptanceHandler) monetizationRoute(ctx context.Context,w http.ResponseWriter,r *http.Request,raw []byte){
 token,e:=readSessionCookie(r);if e!=nil{deny(w,401);return}
 session,e:=h.sessions.Validate(ctx,token);if e!=nil{deny(w,401);return}
 id,e:=h.auth.store.Resolve(ctx,session.Subject)
 if e!=nil||!h.approved(ctx,id){deny(w,401);return}
 switch r.URL.Path{
 case "/v1/monetization/status":
  if !decodeRequest(raw,&struct{}{}){deny(w,400);return}
  v,e:=h.monetization.Current(ctx,token)
  if e!=nil{deny(w,503);return}
  reply(w,200,v)
 case "/v1/monetization/consent":
  var body struct{
   RewardOptIn bool
   CreatorOptIn bool
   ConsentAccepted bool
   ExpectedVersion *int64
  }
  if !decodeRequest(raw,&body)||body.ExpectedVersion==nil||
    (body.RewardOptIn||body.CreatorOptIn)&&!body.ConsentAccepted{
   deny(w,400);return
  }
  v,e:=h.monetization.Set(ctx,token,body.RewardOptIn,body.CreatorOptIn,*body.ExpectedVersion)
  if errors.Is(e,ErrConflict){deny(w,409);return}
  if errors.Is(e,ErrInvalid){deny(w,400);return}
  if errors.Is(e,ErrAuthentication){deny(w,401);return}
  if e!=nil{deny(w,503);return}
  reply(w,200,v)
 default:deny(w,404)
 }
}
