package complianceauth
import("bytes";"context";"errors";"io";"net";"net/http";"strings";"testing";"time")
type sourceRoundTrip func(*http.Request)(*http.Response,error)
func(f sourceRoundTrip)RoundTrip(r *http.Request)(*http.Response,error){return f(r)}
func TestSafeOfficialIngestion(t *testing.T){
 now:=time.Date(2026,10,10,18,0,0,0,time.UTC)
 p:=SourcePolicy{ID:"FED-ACT",URL:"https://laws-lois.justice.gc.ca/eng/acts/C-24.5/",Host:"laws-lois.justice.gc.ca",MaxBytes:1024,MinInterval:time.Minute,AllowArchive:true}
 for _,u:=range []string{"http://laws-lois.justice.gc.ca/","https://127.0.0.1/","https://laws-lois.justice.gc.ca@evil.example/","https://laws-lois.justice.gc.ca:444/","https://laws-lois.justice.gc.ca/?target=localhost","https://evil.example/"}{x:=p;x.URL=u;if validateSource(x)==nil{t.Errorf("unsafe URL accepted %s",u)}}
 for _,ip:=range []string{"127.0.0.1","10.10.0.2","169.254.169.254","::1","fc00::1","0.0.0.0"}{if publicAddress(net.ParseIP(ip)){t.Fatalf("SSRF IP accepted: %s",ip)}}
 good:=func(body string,status int,typ string)sourceRoundTrip{return func(r *http.Request)(*http.Response,error){
 if r.Header.Get("Accept")!="text/html,application/pdf"{t.Error("accept header")}
 return &http.Response{StatusCode:status,Body:io.NopCloser(strings.NewReader(body)),Header:http.Header{"Content-Type":[]string{typ},"ETag":[]string{"v1"}},Request:r},nil
 }}
 f:=&SourceFetcher{Client:&http.Client{Transport:good("<html>official</html>",200,"text/html")}}
 snap,err:=f.Fetch(context.Background(),p,"v0","Wed, 01 Jan 2025 00:00:00 GMT",now)
 if err!=nil||len(snap.Body)==0||snap.Digest==""||!snap.Archived {t.Fatalf("unexpected snapshot %+v %v",snap,err)}
 if _,err=f.Fetch(context.Background(),p,"","",now.Add(time.Second));!errors.Is(err,ErrThrottled){t.Fatal("missing throttle",err)}
 cases:=[]struct{name string;body string;status int;typ string;want error}{
 {"redirect","",302,"text/html",ErrUnsafeSource},
 {"invalid media","{} ",200,"application/json",ErrUnsafeSource},
 {"false PDF","not pdf",200,"application/pdf",ErrUnsafeSource},
 {"too big",strings.Repeat("x",1100),200,"text/html",ErrTooLarge},
 }
 for _,tc:=range cases{t.Run(tc.name,func(t *testing.T){x:=&SourceFetcher{Client:&http.Client{Transport:good(tc.body,tc.status,tc.typ)}};_,err:=x.Fetch(context.Background(),p,"","",now);if !errors.Is(err,tc.want){t.Fatalf("got %v want %v",err,tc.want)}})}
 notModified:=&SourceFetcher{Client:&http.Client{Transport:good("",304,"")}}
 result,err:=notModified.Fetch(context.Background(),p,"","",now)
 if err!=nil||!result.NotModified||len(result.Body)!=0{t.Fatal("bad conditional response",err)}
 pdf:=&SourceFetcher{Client:&http.Client{Transport:good("%PDF-1.7\n",200,"application/pdf")}}
 result,err=pdf.Fetch(context.Background(),p,"","",now);if err!=nil||!bytes.HasPrefix(result.Body,[]byte("%PDF-")){t.Fatal("valid PDF rejected",err)}
 if _,err=(&SourceFetcher{}).Fetch(context.Background(),p,"","",now);!errors.Is(err,ErrUnsafeSource){t.Fatal("nil client accepted")}
}
