"""BNB-5.6 separately instantiated Search/Travel consumer runtime.

Repository-only service process. Its identity is pinned at startup, not supplied
by the incoming request. No live publication, notifications or provider keys.
"""
import os
import sys
import psycopg
from fastapi import FastAPI, Header, HTTPException
import discovery_transport as transport
from authority import verify_authority

def create_consumer_app(consumer, connect, *, receipt_signer=None):
    if consumer not in transport.CONSUMERS or not callable(connect):
        raise ValueError("CONSUMER_RUNTIME_INVALID")
    app=FastAPI(title="420BnB "+consumer+" isolated consumer",version="1.0")
    @app.post("/v1/discovery/accept",status_code=201)
    def accept(body:dict,x_discovery_proof:str|None=Header(None)):
        if not x_discovery_proof:raise HTTPException(401,"DISCOVERY_PROOF_REQUIRED")
        claims=verify_authority(x_discovery_proof,"BNB_DISCOVERY_CONSUMER",
                                "discovery-accept")
        for key,value in (("consumer",consumer),("transport_digest",body.get("transport_digest")),
                          ("epoch",body.get("epoch")),("cursor",body.get("cursor")),
                          ("property_id",body.get("property_id")),
                          ("revision",body.get("revision"))):
            if claims.get(key)!=value:raise HTTPException(403,"DISCOVERY_SCOPE_MISMATCH")
        if (claims.get("current_consumer_grant_verified") is not True or
                claims.get("consumer_revoked") is not False):
            raise HTTPException(403,"CONSUMER_REVOKED")
        with connect() as conn:
            result=transport.accept_repository_consumer(conn,consumer,body,
                authorize=lambda c,a:c==consumer and a=="discovery-accept")
        # A separately approved signer is required for network acceptance.
        # Never sign until after the consumer transaction has committed.
        if not callable(receipt_signer):
            raise HTTPException(503,"CONSUMER_RECEIPT_SIGNER_UNAVAILABLE")
        signed=receipt_signer(consumer,body)
        if not isinstance(signed,str) or not signed or len(signed)>8192:
            raise HTTPException(503,"CONSUMER_RECEIPT_SIGNING_FAILED")
        return dict(result,receipt_proof=signed)
    return app

def main():
    import uvicorn
    # This worker is not a separately approved production consumer deployment.
    if os.getenv("BNB_CONSUMER_FIXTURE")!="isolated-ci":
        raise RuntimeError("CONSUMER_DEPLOYMENT_NOT_APPROVED")
    consumer=os.getenv("BNB_CONSUMER_KIND")
    dsn=os.getenv("BNB_CONSUMER_DATABASE_DSN")
    if consumer not in transport.CONSUMERS or not dsn:
        raise RuntimeError("CONSUMER_CONFIG_REQUIRED")
    def connect():return psycopg.connect(dsn)
    app=create_consumer_app(consumer,connect)
    # TLS termination must be established separately by an isolated trusted
    # ingress; never bind this unencrypted internal process publicly.
    uvicorn.run(app,host="127.0.0.1",port=int(os.getenv("BNB_CONSUMER_PORT","8765")))

if __name__=="__main__":
    try:main()
    except Exception:
        print("CONSUMER_START_FAILED",file=sys.stderr)
        sys.exit(1)
