package indexerclient
import ("context";"github.com/420integrated/420-integrated/indexer/tokenread")
func(c *Client) TokenDeployment(ctx context.Context,chain uint64,token string)(tokenread.Projection,error){return tokenread.ReadHTTP(ctx,c.http,c.baseURL,chain,token)}
