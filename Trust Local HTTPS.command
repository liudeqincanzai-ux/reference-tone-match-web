#!/bin/zsh
set -e

cd "$(dirname "$0")"

if [[ ! -f ".cert/localhost.pem" ]]; then
  python3 -B server.py --help >/dev/null
  python3 -B - <<'PY'
import server
server.ensure_certificate()
PY
fi

echo "Adding Reference Tone Match local HTTPS certificate to your login keychain..."
security add-trusted-cert -d -r trustRoot -k "$HOME/Library/Keychains/login.keychain-db" ".cert/localhost.pem"
echo
echo "Done. Restart the browser, then open:"
echo "https://127.0.0.1:8443/"
echo
read -k 1 "?Press any key to close..."
