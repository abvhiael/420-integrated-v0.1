package storage420

import (
 "encoding/hex"
 "encoding/binary"
 "fmt"
 "strings"
)

type ResourceGrantIdentifiers struct {
 ComponentID string `json:"componentId"`
 CapabilityID string `json:"capabilityId"`
 ScopeHash string `json:"scopeHash"`
 ScopeKind string `json:"scopeKind"`
}

type resourceIdentifier struct { preimage, kind string }
var resourceIdentifiers = map[string]resourceIdentifier{
 "ResourceIds420.COMPONENT_RESOURCE": {"420/RESOURCE/COMPONENT/V1", ""},
 "ResourceIds420.SERVICE_RELAY": {"420/RESOURCE/SERVICE/RELAY/V1", ""},
 "ResourceIds420.SERVICE_STORE": {"420/RESOURCE/SERVICE/STORE/V1", ""},
 "ResourceIds420.SERVICE_CACHE": {"420/RESOURCE/SERVICE/CACHE/V1", ""},
 "ResourceIds420.SERVICE_GATEWAY": {"420/RESOURCE/SERVICE/GATEWAY/V1", ""},
 "ResourceIds420.ACTION_REGISTER_PROVIDER": {"420/RESOURCE/ACTION/REGISTER_PROVIDER/V1", "provider"},
 "ResourceIds420.ACTION_UPDATE_PROVIDER": {"420/RESOURCE/ACTION/UPDATE_PROVIDER/V1", "provider"},
 "ResourceIds420.ACTION_SET_PROVIDER_STATE": {"420/RESOURCE/ACTION/SET_PROVIDER_STATE/V1", "provider"},
 "ResourceIds420.ACTION_REGISTER_NODE": {"420/RESOURCE/ACTION/REGISTER_NODE/V1", "node"},
 "ResourceIds420.ACTION_UPDATE_NODE": {"420/RESOURCE/ACTION/UPDATE_NODE/V1", "node"},
 "ResourceIds420.ACTION_SET_NODE_STATE": {"420/RESOURCE/ACTION/SET_NODE_STATE/V1", "node"},
 "ResourceIds420.ACTION_PUBLISH_OFFER": {"420/RESOURCE/ACTION/PUBLISH_OFFER/V1", "node"},
 "ResourceIds420.ACTION_SUBMIT_RECEIPT": {"420/RESOURCE/ACTION/SUBMIT_RECEIPT/V1", "node"},
 "ResourceIds420.ACTION_SETTLE": {"420/RESOURCE/ACTION/SETTLE/V1", "session"},
 "StorageIds420.ACTION_CONFIGURE_STORAGE_CAPACITY": {"420/STORAGE/ACTION/CONFIGURE_CAPACITY/V1", "node"},
 "StorageIds420.ACTION_RESERVE_STORAGE_CAPACITY": {"420/STORAGE/ACTION/RESERVE_CAPACITY/V1", "node"},
 "StorageIds420.RESERVATION_DOMAIN": {"420/STORAGE/CAPACITY_RESERVATION/V1", ""},
 "StorageProofIds420.PROOF_REPLICA_COMMITMENT": {"420/STORAGE/PROOF/REPLICA_COMMITMENT/V1", ""},
 "StorageProofIds420.PROOF_AVAILABILITY_WINDOW": {"420/STORAGE/PROOF/AVAILABILITY_WINDOW/V1", ""},
 "StorageProofIds420.PROOF_AUDIT_RESPONSE": {"420/STORAGE/PROOF/AUDIT_RESPONSE/V1", ""},
 "StorageProofIds420.ACTION_REGISTER_PROOF_SCHEME": {"420/STORAGE/ACTION/REGISTER_PROOF_SCHEME/V1", "proofScheme"},
 "StorageProofIds420.ACTION_SET_PROOF_SCHEME_STATE": {"420/STORAGE/ACTION/SET_PROOF_SCHEME_STATE/V1", "proofScheme"},
 "StorageProofIds420.ACTION_REGISTER_STORAGE_COMMITMENT": {"420/STORAGE/ACTION/REGISTER_STORAGE_COMMITMENT/V1", "node"},
 "StorageProofIds420.ACTION_ACCEPT_STORAGE_AGREEMENT": {"420/STORAGE/ACTION/ACCEPT_STORAGE_AGREEMENT/V1", "node"},
 "ServiceIds420.RESOURCE_PROTOCOL": {"420/service/resource-protocol/v1", ""},
}
var resourceScopeDomains = map[string]string{
 "provider": "420/RESOURCE/PROVIDER/SCOPE/V1",
 "node": "420/RESOURCE/NODE/SCOPE/V1",
 "session": "420/RESOURCE/SESSION/SCOPE/V1",
 "proofScheme": "420/STORAGE/PROOF_SCHEME/SCOPE/V1",
}
func resourceHash(data []byte) string { h:=keccak256(data); return "0x"+hex.EncodeToString(h[:]) }

// ResourceIdentifier returns a canonical named component, action, service or proof identifier.
func ResourceIdentifier(name string) (string,error) {
 v,ok:=resourceIdentifiers[name]; if !ok {return "",fmt.Errorf("unknown Resource identifier %q",name)}
 return resourceHash([]byte(v.preimage)),nil
}

// ResourceScopeHash encodes the typed domain exactly as Solidity abi.encode(string,bytes32...).
func ResourceScopeHash(kind string, ids ...string) (string,error) {
 domain,ok:=resourceScopeDomains[kind]; if !ok {return "",fmt.Errorf("unknown Resource scope %q",kind)}
 count:=1; if kind=="node" {count=2}; if len(ids)!=count {return "",fmt.Errorf("incorrect Resource scope arity")}
 head:=32*(count+1); data:=make([]byte,head+32+((len(domain)+31)/32)*32)
 binary.BigEndian.PutUint64(data[24:32],uint64(head))
 for i,id:=range ids {
  if len(id)!=66 || !strings.HasPrefix(id,"0x") {return "",fmt.Errorf("invalid bytes32")}
  raw,err:=hex.DecodeString(id[2:]); if err!=nil {return "",err}
  nonzero:=false; for _,b:=range raw {if b!=0 {nonzero=true}}
  if !nonzero {return "",fmt.Errorf("zero scope identifier")}
  copy(data[32*(i+1):],raw)
 }
 binary.BigEndian.PutUint64(data[head+24:head+32],uint64(len(domain)))
 copy(data[head+32:],domain)
 return resourceHash(data),nil
}

// DeriveResourceGrant constructs identifiers only; it confers no authority.
func DeriveResourceGrant(action string, ids ...string) (ResourceGrantIdentifiers,error) {
 v,ok:=resourceIdentifiers[action]; if !ok || v.kind=="" {return ResourceGrantIdentifiers{},fmt.Errorf("unsupported Resource action %q",action)}
 scope,err:=ResourceScopeHash(v.kind,ids...); if err!=nil {return ResourceGrantIdentifiers{},err}
 component,_:=ResourceIdentifier("ResourceIds420.COMPONENT_RESOURCE")
 return ResourceGrantIdentifiers{component,resourceHash([]byte(v.preimage)),scope,v.kind},nil
}
