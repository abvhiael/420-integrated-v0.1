package indexerclient
import(
 "context"
 "net/url"
 "strconv"
 "github.com/420integrated/420-integrated/indexer/tokenread"
)
func(c *Client) TokenDeployment(ctx context.Context,token string)(tokenread.Projection,error){
 var out tokenread.Projection
 if !tokenread.ValidAddress(token){return out,tokenread.ErrInvalid}
 err:=c.getData(ctx,"/v1/token/deployments/"+url.PathEscape(token)+"?chainId="+strconv.FormatUint(c.requiredChainID,10),&out)
 if err!=nil{return tokenread.Projection{},err};if err=out.Validate(c.requiredChainID,token);err!=nil{return tokenread.Projection{},err};return out,nil
}
