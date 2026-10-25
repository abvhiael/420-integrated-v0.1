"""Same-origin local daily-pool application and confidential custodian service."""
import argparse
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import json
from pathlib import Path
import sys
import threading
from urllib.parse import urlparse,parse_qs

sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from chain import Chain,hx
from custodian import Custodian


def safe(value):
    if isinstance(value,bytes):return hx(value)
    if type(value) is int and abs(value)>2**53-1:return str(value)
    if isinstance(value,dict):return {str(k):safe(v) for k,v in value.items()}
    if isinstance(value,(list,tuple)):return [safe(v) for v in value]
    return value


class Application:
    def __init__(self,config,private_directory):
        self.chain=Chain(config);self.custodian=Custodian(self.chain,private_directory);self.stopped=threading.Event();self.worker_errors=0
    def worker(self):
        while not self.stopped.wait(0.5):
            try:self.custodian.publish_due()
            except Exception:self.worker_errors+=1  # never log keys, ciphertext or decrypted data
    def public_config(self):
        c=self.chain.config
        return {"assetKind":self.chain.asset_kind,"chainID":c["chainID"],"genesisHash":hx(self.chain.w3.eth.get_block(0).hash),"engine":self.chain.engine.address,"asset":self.chain.token.address,"disputes":self.chain.disputes.address,"decimals":self.chain.decimals,"profiles":c["profiles"],"slates":c["slates"],"plannedPools":c["plannedPools"],"encryptionPublicKey":hx(self.custodian.public),"localQualification":c.get("localQualification",False)}


def handler_for(app,origin):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args):pass
        def send(self,status,value,content_type="application/json"):
            body=json.dumps(safe(value)).encode() if content_type=="application/json" else value
            self.send_response(status);self.send_header("Content-Type",content_type);self.send_header("Content-Length",str(len(body)));self.send_header("Cache-Control","no-store")
            self.send_header("X-Content-Type-Options","nosniff");self.send_header("Referrer-Policy","no-referrer")
            self.send_header("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
            self.end_headers();self.wfile.write(body)
        def do_GET(self):
            try:
                if self.headers.get("Host")!=urlparse(origin).netloc:return self.send(403,{"error":"untrusted host"})
                route=urlparse(self.path);q={k:v[0] for k,v in parse_qs(route.query).items()}
                if route.path=="/api/config":return self.send(200,app.public_config())
                if route.path=="/api/pools":return self.send(200,app.chain.pools())
                if route.path=="/api/pool":
                    value=app.chain.view(q["pool"],q["actor"],q.get("start",1))
                    with app.custodian.lock:
                        for claim in value["claims"]:
                            row=app.custodian.db.execute("SELECT text FROM evidence WHERE claim=?",(claim["id"],)).fetchone()
                            claim["evidenceText"]=row[0] if row else "Evidence reference not yet supplied"
                            decision=app.custodian.db.execute("SELECT text FROM decisions WHERE claim=?",(claim["id"],)).fetchone()
                            claim["decisionText"]=decision[0] if decision else ""
                    return self.send(200,value)
                if route.path=="/api/preflight":return self.send(200,app.chain.preflight(q["pool"],q["subject"],q["credential"],q["actor"]))
                if route.path=="/api/health":return self.send(200,{"ok":True,"publicationFailures":app.worker_errors})
                names={"/":"index.html","/app.js":"app.js","/styles.css":"styles.css","/ethers.js":"ethers.js"}
                if route.path not in names:return self.send(404,{"error":"not found"})
                file=Path(__file__).parent/"web-dist"/names[route.path]
                return self.send(200,file.read_bytes(),"text/html; charset=utf-8" if route.path=="/" else "text/css" if route.path.endswith(".css") else "text/javascript")
            except Exception:return self.send(400,{"error":"request could not be validated against the configured chain"})
        def do_POST(self):
            try:
                if self.headers.get("Host")!=urlparse(origin).netloc or self.headers.get("Origin")!=origin:return self.send(403,{"error":"same-origin request required"})
                if self.headers.get("Content-Type")!="application/json":return self.send(415,{"error":"JSON required"})
                size=int(self.headers.get("Content-Length","0"))
                if not 0<size<=16384:return self.send(413,{"error":"request size limit"})
                data=json.loads(self.rfile.read(size))
                if not isinstance(data,dict):raise ValueError()
                if self.path=="/api/authorize":
                    _,_,_,message=app.custodian.prepare(data);return self.send(200,{"message":message})
                if self.path=="/api/attest":return self.send(200,app.custodian.attest(data))
                if self.path=="/api/evidence":
                    from chain import b32
                    from nhl import k256
                    text=data["text"]
                    if not isinstance(text,str) or not 1<=len(text.encode())<=8192:raise ValueError()
                    claim=app.chain.disputes.functions.claimOf(b32(data["claim"])).call()
                    if not claim[6] or claim[4]!=k256(text.encode()):raise ValueError()
                    with app.custodian.lock:
                        app.custodian.db.execute("INSERT OR IGNORE INTO evidence VALUES (?,?)",(data["claim"],text));app.custodian.db.commit()
                    return self.send(200,{"retained":True})
                if self.path=="/api/decision":
                    from chain import b32
                    from nhl import k256
                    text=data['text']
                    if not isinstance(text,str) or not 10<=len(text.encode())<=8192:raise ValueError()
                    events=app.chain.disputes.events.Resolved().get_logs(from_block=app.chain.config['deploymentBlock'],to_block='latest',argument_filters={'claimId':b32(data['claim'])})
                    if not events or events[-1]['args']['reason']!=k256(text.encode()):raise ValueError()
                    with app.custodian.lock:
                        app.custodian.db.execute('INSERT OR IGNORE INTO decisions VALUES (?,?)',(data['claim'],text));app.custodian.db.commit()
                    return self.send(200,{'retained':True})
                if self.path=="/api/transaction":return self.send(200,{"transactions":app.chain.draft(data["action"],data["payload"],data["actor"])})
                return self.send(404,{"error":"not found"})
            except Exception:return self.send(400,{"error":"authorization, custody validation or transaction preparation failed"})
    return Handler


def main():
    p=argparse.ArgumentParser();p.add_argument("--config",required=True);p.add_argument("--private-directory",required=True);p.add_argument("--port",type=int,default=8420);a=p.parse_args()
    app=Application(json.loads(Path(a.config).read_text()),a.private_directory);origin=f"http://127.0.0.1:{a.port}"
    server=ThreadingHTTPServer(("127.0.0.1",a.port),handler_for(app,origin));thread=threading.Thread(target=app.worker,daemon=True);thread.start()
    print(json.dumps({"url":origin,"chainID":app.chain.config["chainID"]}),flush=True)
    try:server.serve_forever()
    finally:app.stopped.set();thread.join(timeout=35);server.server_close();app.custodian.close()

if __name__=="__main__":main()
