package indexerclient

import (
 "context"
 "encoding/json"
 "errors"
 "net/url"
 "strconv"
 "github.com/420integrated/420-integrated/indexer/treasuryread"
)

// TreasuryProjection exposes the same read boundary used by Analytics.
// The release commitment is never promoted to verified Vault payment evidence.
type TreasuryProjection struct {
 Data json.RawMessage `json:"data"`
 Authoritative bool `json:"authoritative"`
 VaultReleaseVerified bool `json:"vaultReleaseVerified"`
}

func (c *Client) TreasuryRead(ctx context.Context, chain uint64, kind,id string) (TreasuryProjection,error) {
 var out TreasuryProjection
 if kind!="budgets" && kind!="disbursements" && kind!="asset-policies" {return out,treasuryread.ErrInvalid}
 var env struct { APIVersion string `json:"apiVersion"`; Data json.RawMessage `json:"data"`; Error json.RawMessage `json:"error"` }
 path:="/v1/treasury/"+kind+"/"+url.PathEscape(id)+"?chainId="+strconv.FormatUint(chain,10)
 if err:=c.get(ctx,path,&env);err!=nil{return out,err}
 if env.APIVersion!="v1"||len(env.Error)>0&&string(env.Error)!="null"{return out,treasuryread.ErrInvalid}
 if err:=treasuryread.Validate(env.Data,chain,kind,id);err!=nil{
  if errors.Is(err,treasuryread.ErrAuthority){return out,ErrIndexerAuthorityViolation}
  return out,err
 }
 out.Data=env.Data
 return out,nil
}
