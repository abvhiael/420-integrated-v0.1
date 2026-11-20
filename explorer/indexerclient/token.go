package indexerclient
import(
 "context"
 "encoding/json"
 "net/url"
 "strconv"
 "github.com/420integrated/420-integrated/indexer/tokenread"
)
func(c *Client) TokenDeployment(ctx context.Context,chain uint64,token string)(tokenread.Projection,error){
 var out tokenread.Projection
 if chain==0||!tokenread.ValidAddress(token){return out,tokenread.ErrInvalid}
 var env struct{APIVersion string `json:"apiVersion"`;Data json.RawMessage `json:"data"`;Error json.RawMessage `json:"error"`}
 if err:=c.get(ctx,"/v1/token/deployments/"+url.PathEscape(token)+"?chainId="+strconv.FormatUint(chain,10),&env);err!=nil{return out,err}
 if env.APIVersion!="v1"||len(env.Error)>0&&string(env.Error)!="null"||json.Unmarshal(env.Data,&out)!=nil{return tokenread.Projection{},tokenread.ErrInvalid}
 if err:=out.Validate(chain,token);err!=nil{return tokenread.Projection{},err};return out,nil
}
