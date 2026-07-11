#!/usr/bin/env python3
import argparse
import os
import ssl
import subprocess
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
CERT_DIR = ROOT / ".cert"
CERT_FILE = CERT_DIR / "localhost.pem"
KEY_FILE = CERT_DIR / "localhost-key.pem"
CONF_FILE = CERT_DIR / "localhost.cnf"


def ensure_certificate():
    CERT_DIR.mkdir(exist_ok=True)
    if CERT_FILE.exists() and KEY_FILE.exists():
        return

    CONF_FILE.write_text(
        """
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
CN = localhost

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
IP.2 = ::1
""".strip()
        + "\n",
        encoding="utf-8",
    )
    subprocess.run(
        [
            "openssl",
            "req",
            "-x509",
            "-nodes",
            "-newkey",
            "rsa:2048",
            "-days",
            "365",
            "-keyout",
            str(KEY_FILE),
            "-out",
            str(CERT_FILE),
            "-config",
            str(CONF_FILE),
            "-extensions",
            "v3_req",
        ],
        check=True,
    )


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    parser = argparse.ArgumentParser(description="Reference Tone Match web server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8443)
    parser.add_argument("--http", action="store_true", help="Run without TLS for browsers that block local certificates")
    args = parser.parse_args()

    os.chdir(ROOT)

    httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    if not args.http:
        ensure_certificate()
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(certfile=str(CERT_FILE), keyfile=str(KEY_FILE))
        httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

    scheme = "http" if args.http else "https"
    print(f"Reference Tone Match Web running at {scheme}://{args.host}:{args.port}/")
    if not args.http:
        print("First visit will show a self-signed certificate warning; choose continue for local testing.")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
