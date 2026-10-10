package complianceauth

import (
 "context"
 "crypto/sha256"
 "encoding/hex"
 "errors"
 "fmt"
 "io"
 "net"
 "net/http"
 "net/netip"
 "net/url"
 "strings"
 "sync"
 "time"
)
var ErrUnsafeSource=errors.New("unsafe compliance source")
var ErrTooLarge=errors.New("compliance source exceeds size limit")
var ErrThrottled=errors.New("compliance source throttled")
type SourcePolicy struct {
 ID string
 URL string
 Host string
 MaxBytes int64
 MinInterval time.Duration
 AllowArchive bool
}
type Snapshot struct {
 SourceID string
 Status int
 ContentType string
 Body []byte
 Digest string
 ETag string
 LastModified string
 RetrievedAt time.Time
 NotModified bool
 Archived bool
}
// SourceFetcher never follows redirects. DNS/IP filtering must also be applied at dial time,
// so changing DNS answers between validation and connection cannot bypass SSRF controls.
type SourceFetcher struct {
 Client *http.Client
 mu sync.Mutex
 last map[string]time.Time
}
func publicAddress(ip net.IP)bool{
 a,ok:=netip.AddrFromSlice(ip)
 if !ok{return false}
 a=a.Unmap()
 return a.IsGlobalUnicast()&&!a.IsPrivate()&&!a.IsLoopback()&&!a.IsLinkLocalUnicast()&&!a.IsLinkLocalMulticast()&&!a.IsMulticast()&&!a.IsUnspecified()
}
func validateSource(p SourcePolicy)error{
 u,err:=url.Parse(p.URL)
 if err!=nil||u.Scheme!="https"||u.Hostname()!=p.Host||u.Port()!=""||u.User!=nil||u.Fragment!=""||u.RawQuery!=""||p.ID==""||p.Host==""||p.MaxBytes<1||p.MaxBytes>16<<20||p.MinInterval<time.Second{return ErrUnsafeSource}
 if net.ParseIP(u.Hostname())!=nil||strings.HasSuffix(p.Host,".")||strings.Contains(p.Host,".."){return ErrUnsafeSource}
 return nil
}
func NewSourceClient(hosts map[string]bool)*http.Client{
 dialer:=&net.Dialer{Timeout:5*time.Second}
 transport:=&http.Transport{Proxy:nil,ForceAttemptHTTP2:true,TLSHandshakeTimeout:5*time.Second,ResponseHeaderTimeout:10*time.Second,DisableKeepAlives:true,DialContext:func(ctx context.Context,network,address string)(net.Conn,error){
 host,port,err:=net.SplitHostPort(address)
 if err!=nil||!hosts[host]||port!="443"{return nil,ErrUnsafeSource}
 ips,err:=net.DefaultResolver.LookupIP(ctx,"ip",host)
 if err!=nil||len(ips)==0{return nil,ErrUnsafeSource}
 for _,ip:=range ips{if !publicAddress(ip){return nil,ErrUnsafeSource}}
 return dialer.DialContext(ctx,network,net.JoinHostPort(ips[0].String(),port))
 }}
 return &http.Client{Timeout:20*time.Second,Transport:transport,CheckRedirect:func(_ *http.Request,_ []*http.Request)error{return http.ErrUseLastResponse}}
}
func (f *SourceFetcher) Fetch(ctx context.Context,p SourcePolicy,etag,modified string,now time.Time)(Snapshot,error){
 if err:=validateSource(p);err!=nil{return Snapshot{},err}
 if f.Client==nil{return Snapshot{},ErrUnsafeSource}
 f.mu.Lock()
 if f.last==nil{f.last=map[string]time.Time{}}
 if t,ok:=f.last[p.ID];ok&&now.Sub(t)<p.MinInterval {f.mu.Unlock();return Snapshot{},ErrThrottled}
 f.last[p.ID]=now
 f.mu.Unlock()
 req,err:=http.NewRequestWithContext(ctx,http.MethodGet,p.URL,nil);if err!=nil{return Snapshot{},err}
 req.Header.Set("Accept","text/html,application/pdf")
 if etag!=""&&!strings.ContainsAny(etag,"\r\n"){req.Header.Set("If-None-Match",etag)}
 if modified!=""&&!strings.ContainsAny(modified,"\r\n"){req.Header.Set("If-Modified-Since",modified)}
 client:=*f.Client
 client.CheckRedirect=func(_ *http.Request,_ []*http.Request)error{return http.ErrUseLastResponse}
 res,err:=client.Do(req);if err!=nil{return Snapshot{},err}
 defer res.Body.Close()
 if res.Request!=nil && (res.Request.URL==nil||res.Request.URL.String()!=p.URL){return Snapshot{},ErrUnsafeSource}
 if res.StatusCode>=300&&res.StatusCode<400&&res.StatusCode!=http.StatusNotModified{return Snapshot{},ErrUnsafeSource}
 if res.StatusCode!=http.StatusOK&&res.StatusCode!=http.StatusNotModified{return Snapshot{},fmt.Errorf("official source HTTP %d",res.StatusCode)}
 snap:=Snapshot{SourceID:p.ID,Status:res.StatusCode,ETag:res.Header.Get("ETag"),LastModified:res.Header.Get("Last-Modified"),RetrievedAt:now,NotModified:res.StatusCode==http.StatusNotModified}
 if snap.NotModified{return snap,nil}
 typ:=strings.ToLower(strings.TrimSpace(strings.Split(res.Header.Get("Content-Type"),";")[0]))
 if typ!="text/html"&&typ!="application/pdf"{return Snapshot{},ErrUnsafeSource}
 if res.ContentLength>p.MaxBytes{return Snapshot{},ErrTooLarge}
 body,err:=io.ReadAll(io.LimitReader(res.Body,p.MaxBytes+1));if err!=nil{return Snapshot{},err}
 if int64(len(body))>p.MaxBytes{return Snapshot{},ErrTooLarge}
 if typ=="application/pdf"&&!strings.HasPrefix(string(body),"%PDF-"){return Snapshot{},ErrUnsafeSource}
 if typ=="text/html"{lower:=strings.ToLower(string(body));for _,active:=range []string{"<script","<iframe","<object","<embed","<base","<meta http-equiv=\"refresh\""}{if strings.Contains(lower,active){return Snapshot{},ErrUnsafeSource}}}
 h:=sha256.Sum256(body)
 snap.Body=body;snap.ContentType=typ;snap.Digest=hex.EncodeToString(h[:]);snap.Archived=p.AllowArchive
 return snap,nil
}
