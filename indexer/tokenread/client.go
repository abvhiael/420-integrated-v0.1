package tokenread

import (
 "context"
 "encoding/json"
 "io"
 "net/http"
 "net/url"
 "strconv"
)

// ReadHTTP shares one strict public v1 consumer contract across Explorer and Search.
func ReadHTTP(ctx context.Context, client *http.Client, base string, chain uint64, token string)(Projection,error){
 var p Projection
 if chain==0||!ValidAddress(token){return p,ErrInvalid}
 req,err:=http.NewRequestWithContext(ctx,http.MethodGet,base+"/v1/token/deployments/"+url.PathEscape(token)+"?chainId="+strconv.FormatUint(chain,10),nil)
 if err!=nil{return p,ErrUnavailable}
 res,err:=client.Do(req);if err!=nil{return p,ErrUnavailable};defer res.Body.Close()
 var env struct{Version string `json:"apiVersion"`;Data json.RawMessage `json:"data"`;Error *struct{Code string `json:"code"`} `json:"error"`}
 d:=json.NewDecoder(io.LimitReader(res.Body,65536))
 if d.Decode(&env)!=nil||d.Decode(new(any))!=io.EOF||env.Version!="v1"{return p,ErrUnavailable}
 if res.StatusCode==404&&env.Error!=nil&&env.Error.Code=="not_found"&&len(env.Data)==0{return p,ErrNotFound}
 if res.StatusCode!=200||env.Error!=nil{return p,ErrUnavailable}
 if json.Unmarshal(env.Data,&p)!=nil{return Projection{},ErrInvalid}
 if err=p.Validate(chain,token);err!=nil{return Projection{},err};return p,nil
}
