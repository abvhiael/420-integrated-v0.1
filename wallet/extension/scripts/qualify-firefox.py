#!/usr/bin/env python3
"""Firefox MV3 event-page and EIP-1193 denied-access smoke on a real Firefox binary."""
from __future__ import annotations
import http.server
import socketserver
import tempfile
import threading
import zipfile
import os
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.support.ui import WebDriverWait

ROOT=Path(__file__).resolve().parents[1] / "dist-firefox"
assert (ROOT / "manifest.json").is_file(), "Build Firefox package before browser smoke"
class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type","text/html")
        self.end_headers()
        self.wfile.write(b"<!doctype html><meta charset=utf-8><title>Untrusted dapp</title><p>No account consent provided</p>")
    def log_message(self,*args): pass

class ReuseTCP(socketserver.TCPServer): allow_reuse_address=True
with ReuseTCP(("127.0.0.1",0),Handler) as site:
    thread=threading.Thread(target=site.serve_forever,daemon=True)
    thread.start()
    with tempfile.TemporaryDirectory() as d:
        archive=Path(d)/"wallet-firefox-smoke.xpi"
        with zipfile.ZipFile(archive,"w",zipfile.ZIP_DEFLATED) as z:
            for source in ROOT.rglob("*"):
                if source.is_file():
                    z.write(source,source.relative_to(ROOT).as_posix())
        opts=Options()
        opts.add_argument("-headless")
        driver=webdriver.Firefox(options=opts)
        try:
            extension=driver.install_addon(str(archive),temporary=True)
            assert extension, "Firefox refused temporary MV3 add-on"
            driver.get(f"http://127.0.0.1:{site.server_address[1]}/")
            WebDriverWait(driver,25).until(lambda d:d.execute_script(
                "return typeof window.ethereum==='object'&&window.ethereum.is420Wallet===true"))
            result=driver.execute_async_script("""
              const done=arguments[arguments.length-1];
              window.ethereum.request({method:'eth_accounts'}).then(
                accounts=>done({status:'ok',accounts}),
                error=>done({status:'denied',code:error.code,message:String(error.message)})
              );
            """)
            assert result["status"]=="denied" or result.get("accounts")==[], (
                "Unconfigured, unapproved origin unexpectedly received accounts: "+str(result))
            assert driver.execute_script("return window.ethereum.is420Wallet===true")
            print("PASS: real Firefox MV3 event-page loads; isolated EIP-1193 provider rehydrates; no account leaked to unapproved origin")
        finally:
            driver.quit()
    site.shutdown()
