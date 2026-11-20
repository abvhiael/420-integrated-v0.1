package account

import (
 "bytes"
 "context"
 "crypto/sha256"
 "crypto/tls"
 "encoding/hex"
 "encoding/json"
 "io"
 "net"
 "net/http"
 "regexp"
 "time"
)

const resendEndpoint = "https://api.resend.com/emails"
var resendKeyPattern = regexp.MustCompile("^re_[A-Za-z0-9_-]{16,252}$")
var resendIDPattern = regexp.MustCompile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")

// ResendMailer is an HTTPS transactional-mail adapter. The production
// endpoint is fixed, API keys never enter a browser or log, redirects are
// disabled and provider acceptance is not interpreted as inbox delivery.
type ResendMailer struct {
 key, from, endpoint string
 client *http.Client
}

func NewResendMailer(key, from string) (*ResendMailer,error) {
 clean,e:=normalizeEmail(from)
 if e!=nil||!resendKeyPattern.MatchString(key){return nil,ErrInvalid}
 transport:=&http.Transport{
  DialContext:(&net.Dialer{Timeout:4*time.Second,KeepAlive:30*time.Second}).DialContext,
  TLSClientConfig:&tls.Config{MinVersion:tls.VersionTLS12},
  TLSHandshakeTimeout:4*time.Second,
  ResponseHeaderTimeout:7*time.Second,
  IdleConnTimeout:30*time.Second,
  MaxIdleConnsPerHost:4,
  MaxConnsPerHost:8,
  DisableCompression:true,
 }
 return &ResendMailer{key:key,from:clean,endpoint:resendEndpoint,client:&http.Client{
  Transport:transport,Timeout:10*time.Second,
  CheckRedirect:func(*http.Request,[]*http.Request)error{return http.ErrUseLastResponse},
 }},nil
}

func (m *ResendMailer) SendVerification(ctx context.Context, recipient, secret string) error {
 email,e:=normalizeEmail(recipient);if e!=nil{return e}
 if _,e=decodeToken(secret);e!=nil{return e}
 payload:=struct{
  From string `json:"from"`
  To []string `json:"to"`
  Subject string `json:"subject"`
  Text string `json:"text"`
 }{m.from,[]string{email},"Your 420ID sign-in code",verificationText(secret)}
 raw,e:=json.Marshal(payload);if e!=nil{return ErrUnavailable}
 req,e:=http.NewRequestWithContext(ctx,http.MethodPost,m.endpoint,bytes.NewReader(raw));if e!=nil{return ErrUnavailable}
 req.Header.Set("Authorization","Bearer "+m.key)
 req.Header.Set("Content-Type","application/json")
 req.Header.Set("Accept","application/json")
 // One logical message gets one opaque idempotency key. No automatic
 // retry or SMTP fallback on uncertain delivery or quota exhaustion.
 digest:=sha256.Sum256(raw)
 req.Header.Set("Idempotency-Key","420id-"+hex.EncodeToString(digest[:]))
 resp,e:=m.client.Do(req);if e!=nil{return ErrUnavailable}
 defer resp.Body.Close()
 if resp.StatusCode!=http.StatusOK&&resp.StatusCode!=http.StatusCreated{return ErrUnavailable}
 data,e:=io.ReadAll(io.LimitReader(resp.Body,4097))
 if e!=nil||len(data)>4096||!uniqueObject(data){return ErrUnavailable}
 var result struct{ID string `json:"id"`}
 if json.Unmarshal(data,&result)!=nil||!resendIDPattern.MatchString(result.ID){return ErrUnavailable}
 return nil
}

func verificationText(secret string)string{
 return "Enter this one-time code in the browser where you requested it:\r\n\r\n"+secret+"\r\n\r\nIt expires in 10 minutes. Never share the code. If you did not request it, ignore this email.\r\n"
}
