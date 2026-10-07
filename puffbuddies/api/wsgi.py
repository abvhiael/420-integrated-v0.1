"""Minimal WSGI adapter for the PB-14 hardened transport.

The adapter trusts only WSGI's effective scheme/host values supplied by the configured
ingress. It deliberately does not interpret X-Forwarded-* headers.
"""
from __future__ import annotations

from .hardening import ApiRequest, ApiTransport, MEDIA_LIMIT


def create_wsgi_app(transport: ApiTransport):
    def app(environ, start_response):
        raw_length = environ.get("CONTENT_LENGTH", "") or "0"
        try:
            length = int(raw_length)
        except ValueError:
            length = MEDIA_LIMIT + 1
        if length < 0 or length > MEDIA_LIMIT:
            body = b'{"error":"request_denied"}'
            start_response("413 Payload Too Large", [
                ("Content-Type", "application/json; charset=utf-8"),
                ("Cache-Control", "no-store, max-age=0"),
                ("Content-Length", str(len(body))),
            ])
            return [body]
        body = environ["wsgi.input"].read(length) if length else b""
        headers = {}
        for key, value in environ.items():
            if key.startswith("HTTP_"):
                headers[key[5:].replace("_", "-")] = str(value)
        if environ.get("CONTENT_TYPE"):
            headers["Content-Type"] = str(environ["CONTENT_TYPE"])
        if environ.get("CONTENT_LENGTH"):
            headers["Content-Length"] = str(environ["CONTENT_LENGTH"])
        response = transport.handle(ApiRequest(
            method=str(environ.get("REQUEST_METHOD", "GET")),
            path=str(environ.get("PATH_INFO", "")),
            headers=headers,
            body=body,
            scheme=str(environ.get("wsgi.url_scheme", "")),
            host=str(environ.get("HTTP_HOST", "")),
            now_epoch=int(environ.get("puffbuddies.now_epoch", 0)),
        ))
        reason = {
            200:"OK",201:"Created",202:"Accepted",204:"No Content",400:"Bad Request",
            401:"Unauthorized",403:"Forbidden",404:"Not Found",405:"Method Not Allowed",
            409:"Conflict",413:"Payload Too Large",415:"Unsupported Media Type",
            429:"Too Many Requests",503:"Service Unavailable",
        }.get(response.status, "Error")
        hdrs = list(response.headers.items())
        hdrs.append(("Content-Length", str(len(response.body))))
        start_response(f"{response.status} {reason}", hdrs)
        return [response.body]
    return app
