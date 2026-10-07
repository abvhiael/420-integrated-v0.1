"""Loopback-only DoobTube non-production launcher.

This is deliberately not a production ingress. It exposes public DoobTube
read endpoints and the built static client. Authority-bearing writes require a
real deployment authentication/session gateway and are therefore rejected.
"""
from __future__ import annotations

import argparse
from functools import partial
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from doobtube.api import Backend, Request, RuntimeConfig
from doobtube.ops.config import NonProductionConfig

def runtime_config(cfg: NonProductionConfig) -> dict:
    origin=f"http://{cfg.host}:{cfg.port}"
    return {
        "schema":"doobtube-web-runtime-v1",
        "site":{"name":"DoobTube","productionOrigin":None},
        "network":{"chainId":cfg.chain_id,"network":cfg.network},
        "services":{
            "doobtube":{"baseUrl":origin},
            "media":{"serviceId":"420/service/media/v1","baseUrl":None},
            "search":{"serviceId":"420/service/search/v1","baseUrl":None},
            "notifications":{"serviceId":"420/service/notifications/v1","baseUrl":None},
        },
        "features":{
            "feed":True,"search":True,"playback":True,"library":True,
            "upload":True,"livestreaming":True,"subscriptions":True,
            "moderation":True,"preferences":True,"delete":False,"export":False,
        },
        "execution":{
            "status":"NONPRODUCTION_LOOPBACK_DEPENDENCIES_UNRESOLVED",
            "requireWalletChainMatch":True,
            "requireHTTPS":False,
        },
    }

class Handler(BaseHTTPRequestHandler):
    server_version="DoobTubeNonProduction/1"

    def _json(self,status:int,body:dict) -> None:
        data=json.dumps(body,separators=(",",":")).encode()
        self.send_response(status)
        self.send_header("Content-Type","application/json")
        self.send_header("Cache-Control","no-store")
        self.send_header("X-Content-Type-Options","nosniff")
        self.send_header("Content-Length",str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _backend(self) -> bool:
        parsed=urlparse(self.path)
        if parsed.path not in {"/v1/health","/v1/readiness","/v1/feed"}:
            return False
        query={k:v[-1] for k,v in parse_qs(parsed.query,keep_blank_values=True).items()}
        response=self.server.backend.handle(Request("GET",parsed.path,query,{},{}))
        self._json(response.status,dict(response.body))
        return True

    def _file(self,path: Path,content_type: str) -> None:
        if not path.exists() or not path.is_file():
            self.send_error(404)
            return
        data=path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type",content_type)
        self.send_header("Cache-Control","no-store")
        self.send_header("X-Content-Type-Options","nosniff")
        self.send_header("Content-Length",str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        parsed=urlparse(self.path)
        if parsed.path=="/runtime-config.json":
            return self._json(200,runtime_config(self.server.cfg))
        if self._backend():
            return
        rel=parsed.path.lstrip("/") or "index.html"
        if ".." in Path(rel).parts:
            self.send_error(400);return
        target=(self.server.web_root/rel).resolve()
        if self.server.web_root not in target.parents and target!=self.server.web_root:
            self.send_error(403);return
        if target.is_dir():
            target=target/"index.html"
        if not target.exists() and "." not in Path(rel).name:
            target=self.server.web_root/"index.html"
        suffix=target.suffix.lower()
        ctype={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".svg":"image/svg+xml",".json":"application/json"}.get(suffix,"application/octet-stream")
        self._file(target,ctype)

    def do_POST(self):
        self._json(501,{"version":"v1","error":{"code":"NONPRODUCTION_AUTH_NOT_CONFIGURED","message":"authority-bearing writes require a qualified deployment authentication gateway"}})

    do_PUT=do_POST
    do_DELETE=do_POST

    def log_message(self,format,*args):
        # Never echo headers/body/auth material.
        super().log_message(format,*args)

class Server(ThreadingHTTPServer):
    def __init__(self,cfg:NonProductionConfig,backend:Backend):
        self.cfg=cfg
        self.backend=backend
        self.web_root=Path(cfg.web_root).resolve()
        super().__init__((cfg.host,cfg.port),Handler)

def create_server(cfg:NonProductionConfig) -> Server:
    cfg.validate()
    root=Path(cfg.web_root)
    if not root.exists() or not (root/"index.html").exists():
        raise FileNotFoundError("web build missing; run npm --prefix doobtube/web run build")
    db=Path(cfg.database_path)
    db.parent.mkdir(parents=True,exist_ok=True)
    backend=Backend(
        RuntimeConfig(cfg.chain_id,cfg.network,str(db),secret_provider_ref="nonproduction://none"),
        dependency_probe=lambda:{"420Media":cfg.media_available,"420Registry":cfg.registry_available},
    )
    return Server(cfg,backend)

def main(argv=None) -> int:
    parser=argparse.ArgumentParser(description="Run loopback-only DoobTube non-production deployment")
    parser.add_argument("--config",default="doobtube/deploy/nonproduction.example.json")
    args=parser.parse_args(argv)
    cfg=NonProductionConfig.load(args.config)
    server=create_server(cfg)
    print(f"DoobTube non-production deployment: http://{cfg.host}:{cfg.port}")
    print("Authority-bearing writes are disabled until a qualified auth/session gateway is integrated.")
    try:
        server.serve_forever()
    finally:
        server.backend.close()
        server.server_close()
    return 0

if __name__=="__main__":
    raise SystemExit(main())
