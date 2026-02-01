#!/usr/bin/env bash
set -euo pipefail

if command -v openclaw >/dev/null 2>&1; then
  echo "[openclaw] already installed"
else
  echo "[openclaw] installing..."
  curl -fsSL https://openclaw.bot/install.sh | bash
fi

cat <<'EOF'

[openclaw] Next steps (interactive, run in your terminal):
  1) openclaw setup
  2) openclaw onboard --install-daemon
  3) openclaw gateway --port 18789

If openclaw is not on PATH, add:
  export PATH="/opt/homebrew/opt/node@22/bin:$PATH"

EOF
