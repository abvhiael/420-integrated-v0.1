#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then echo "install.sh must run as root" >&2; exit 2; fi
SRC="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
USER_NAME="node420compute"
INSTALL_DIR="/opt/420integrated/node420-compute"
CONFIG_DIR="/etc/420integrated/node420-compute"
STATE_DIR="/var/lib/420integrated/node420-compute"

if ! id "$USER_NAME" >/dev/null 2>&1; then
  useradd --system --home-dir "$STATE_DIR" --create-home --shell /usr/sbin/nologin "$USER_NAME"
fi
install -d -m 0755 "$INSTALL_DIR" "$CONFIG_DIR"
install -d -m 0700 -o "$USER_NAME" -g "$USER_NAME" "$STATE_DIR"
install -m 0755 "$SRC/node420-compute" "$INSTALL_DIR/node420-compute"
install -m 0755 "$SRC/run-node420-compute.sh" "$INSTALL_DIR/run-node420-compute.sh"
install -m 0644 "$SRC/node420-compute.service" /etc/systemd/system/node420-compute.service
if [[ ! -e "$CONFIG_DIR/worker.args.example" ]]; then
  install -m 0600 -o "$USER_NAME" -g "$USER_NAME" "$SRC/worker.args.example" "$CONFIG_DIR/worker.args.example"
fi
systemctl daemon-reload
echo "Installed node420-compute. Create $CONFIG_DIR/worker.args from worker.args.example, replace all identity placeholders, chmod 0600, then explicitly enable/start node420-compute."
