package account

import (
 "context"
 "errors"
 "net/http"
)

// AUTH-6 endpoints never set authentication cookies, modify contracts, sign
// messages or transfer wallet/Names/Identity control. Every operation is
// an allowlisted AUTH-3 account session + browser flow + exact Origin POST.
func (h *AcceptanceHandler) identityRoute(ctx context.Context,w http.ResponseWriter,r *http.Request,raw []byte){
 token,e:=readSessionCookie(r);if e!=nil{deny(w,401);return}
 session,e:=h.sessions.Validate(ctx,token);if e!=nil{deny(w,401);return}
 id,e:=h.auth.store.Resolve(ctx,session.Subject)
 if e!=nil||!h.approved(ctx,id){deny(w,401);return}
 switch r.URL.Path{
 case "/v1/identity/preview":
  var body struct{IdentityProfileID string;NameLabelHash string}
  if !decodeRequest(raw,&body){deny(w,400);return}
  if _,e=canonicalBytes32(body.IdentityProfileID,false);e!=nil{deny(w,400);return}
  if _,e=canonicalBytes32(body.NameLabelHash,true);e!=nil{deny(w,400);return}
  verified,e:=h.identity.Preview(ctx,token,body.IdentityProfileID,body.NameLabelHash)
  if errors.Is(e,ErrAuthentication)||errors.Is(e,ErrConflict){deny(w,409);return}
  if e!=nil{deny(w,503);return}
  reply(w,200,map[string]any{"verification":verified})
 case "/v1/identity/save":
  var body struct{
   IdentityProfileID string
   NameLabelHash string
   ConsentAccepted bool
   ExpectedRevision int64
  }
  if !decodeRequest(raw,&body){deny(w,400);return}
  if _,e=canonicalBytes32(body.IdentityProfileID,false);e!=nil||body.ExpectedRevision<0||!body.ConsentAccepted{deny(w,400);return}
  if _,e=canonicalBytes32(body.NameLabelHash,true);e!=nil{deny(w,400);return}
  pref,e:=h.identity.Save(ctx,token,body.IdentityProfileID,body.NameLabelHash,body.ConsentAccepted,body.ExpectedRevision)
  if errors.Is(e,ErrConflict)||errors.Is(e,ErrAuthentication){deny(w,409);return}
  if errors.Is(e,ErrInvalid){deny(w,400);return}
  if e!=nil{deny(w,503);return}
  reply(w,200,map[string]any{"preference":pref})
 case "/v1/identity/current":
  if !decodeRequest(raw,&struct{}{}){deny(w,400);return}
  pref,e:=h.identity.Current(ctx,token)
  if errors.Is(e,ErrAuthentication){deny(w,409);return}
  if e!=nil{deny(w,503);return}
  reply(w,200,map[string]any{"preference":pref})
 case "/v1/identity/clear":
  if !decodeRequest(raw,&struct{}{}){deny(w,400);return}
  e:=h.identity.Clear(ctx,token)
  if errors.Is(e,ErrAuthentication){deny(w,401);return}
  if e!=nil{deny(w,503);return}
  reply(w,200,map[string]bool{"cleared":true})
 default:deny(w,404)
 }
}
