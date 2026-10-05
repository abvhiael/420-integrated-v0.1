#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then echo "install.sh must run as root" >&2; exit 2; fi
SRC="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
USER_NAME="node420compute"
INSTALL_DIR="/usr/local/libexec/420integrated/node420-compute"
CONFIG_DIR="/Library/Application Support/420Integrated/node420-compute"
LOG_DIR="/Library/Logs/420Integrated"
PLIST="/Library/LaunchDaemons/org.420integrated.node420-compute.plist"

if ! id "$USER_NAME" >/dev/null 2>&1; then
  echo "Required dedicated account node420compute does not exist. Create the local service account explicitly, then rerun this installer." >&2
  exit 2
fi
install -d -m 0755 "$INSTALL_DIR" "$CONFIG_DIR" "$LOG_DIR"
chown "$USER_NAME" "$CONFIG_DIR" "$LOG_DIR"
chmod 0700 "$CONFIG_DIR"
install -m 0755 "$SRC/node420-compute" "$INSTALL_DIR/node420-compute"
install -m 0755 "$SRC/run-node420-compute.sh" "$INSTALL_DIR/run-node420-compute.sh"
install -m 0644 "$SRC/org.420integrated.node420-compute.plist" "$PLIST"
if [[ ! -e "$CONFIG_DIR/worker.args.example" ]]; then
  install -m 0600 "$SRC/worker.args.example" "$CONFIG_DIR/worker.args.example"
  chown "$USER_NAME" "$CONFIG_DIR/worker.args.example"
fi
echo "Installed node420-compute packaging. Create $CONFIG_DIR/worker.args with canonical identities and mode 0600, then explicitly bootstrap $PLIST with launchctl."
