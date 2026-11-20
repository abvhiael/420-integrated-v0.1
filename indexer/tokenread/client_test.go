package tokenread
import("context";"encoding/json";"errors";"net/http";"net/http/httptest";"testing")
func TestTokenConsumerEnvelope(t *testing.T){
 b,cp,token,logs:=fixture();p,err:=Project(b,cp,token,logs);if err!=nil{t.Fatal(err)}
 for _,tc:=range []struct{name string;status int;body any;want error}{
 {"valid",200,map[string]any{"apiVersion":"v1","data":p},nil},
 {"not observed",404,map[string]any{"apiVersion":"v1","error":map[string]string{"code":"not_found"}},ErrNotFound},
 {"unavailable",503,map[string]any{"apiVersion":"v1","error":map[string]string{"code":"unavailable"}},ErrUnavailable},
 {"malformed",200,map[string]any{"apiVersion":"v1","data":map[string]any{"authoritative":true}},ErrInvalid},
 }{t.Run(tc.name,func(t *testing.T){s:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){if r.URL.Query().Get("chainId")!="31337"||r.URL.Path!="/v1/token/deployments/"+token{t.Error("unexpected route")};w.WriteHeader(tc.status);json.NewEncoder(w).Encode(tc.body)}));defer s.Close();_,err:=ReadHTTP(context.Background(),s.Client(),s.URL,b.ChainID,token);if !errors.Is(err,tc.want){t.Fatalf("%v != %v",err,tc.want)}})}
}
