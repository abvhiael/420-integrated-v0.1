package account

import (
 "context"
 "errors"
 "net/http"
)

// All wallet linking routes require an existing verified AUTH-3 account session,
// the same browser-flow cookie and strict HTTPS/Origin/rate gates as AUTH-2.
// No wallet address may issue an account session. No public wallet lookup.
func (h *AcceptanceHandler) walletRoute(ctx context.Context,w http.ResponseWriter,r *http.Request,raw,digest []byte){
 token,e:=readSessionCookie(r)
 if e!=nil{deny(w,401);return}
 session,e:=h.sessions.Validate(ctx,token)
 if e!=nil{deny(w,401);return}
 id,e:=h.auth.store.Resolve(ctx,session.Subject)
 if e!=nil||!h.approved(ctx,id){deny(w,401);return}
 switch r.URL.Path{
 case "/v1/wallet/current":
  if !decodeRequest(raw,&struct{}{}){deny(w,400);return}
  v,e:=h.wallet.Current(ctx,token)
  if e!=nil{deny(w,401);return}
  reply(w,200,map[string]any{"wallet":v})
 case "/v1/wallet/start":
  var body struct{Address string;Kind string;ConsentAccepted bool}
  if !decodeRequest(raw,&body){deny(w,400);return}
  if _,e=canonicalWalletAddress(body.Address);e!=nil||!validWalletKind(body.Kind)||!body.ConsentAccepted{deny(w,400);return}
  v,e:=h.wallet.Begin(ctx,token,body.Address,body.Kind,body.ConsentAccepted,digest)
  if errors.Is(e,ErrConflict){deny(w,409);return}
  if errors.Is(e,ErrInvalid){deny(w,400);return}
  if e!=nil{deny(w,503);return}
  reply(w,200,v)
 case "/v1/wallet/finish":
  var body struct{ChallengeID string;Signature string}
  if !decodeRequest(raw,&body)||!validID(body.ChallengeID)||len(body.Signature)>4098{deny(w,400);return}
  v,e:=h.wallet.Complete(ctx,token,body.ChallengeID,body.Signature,digest)
  if errors.Is(e,ErrConflict){deny(w,409);return}
  if errors.Is(e,ErrAuthentication){deny(w,401);return}
  if e!=nil{deny(w,503);return}
  reply(w,200,map[string]any{"wallet":v})
 case "/v1/wallet/unlink":
  if !decodeRequest(raw,&struct{}{}){deny(w,400);return}
  e:=h.wallet.Unlink(ctx,token)
  if errors.Is(e,ErrUnavailable){deny(w,404);return}
  if errors.Is(e,ErrAuthentication){deny(w,401);return}
  if e!=nil{deny(w,503);return}
  reply(w,200,map[string]bool{"unlinked":true})
 default:deny(w,404)
 }
}
