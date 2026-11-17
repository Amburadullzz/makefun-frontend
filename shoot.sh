#!/usr/bin/env bash
# Take the three screenshots the entry hands in, from the running app on live make.fun data.
# Usage: ./shoot.sh <app-dir> <out-dir>
set -uo pipefail

APP=${1:-app}
OUT=${2:-screenshots}
PORT=8911

mkdir -p "$OUT"
cd "$(dirname "$0")" || exit 1

# serve app/ at the server root so root-relative paths resolve
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$APP" >/tmp/fe_serve.log 2>&1 &
SERVER=$!
sleep 2
curl -s -o /dev/null -w "serve: %{http_code}\n" "http://127.0.0.1:$PORT/index.html"

shoot() { # name route width height
  local name=$1 route=$2 w=$3 h=$4
  chromium --headless --disable-gpu --hide-scrollbars --no-sandbox \
    --window-size="$w,$h" --virtual-time-budget=15000 \
    --screenshot="$OUT/$name" \
    "http://127.0.0.1:$PORT/index.html$route" 2>/dev/null
  if [ -f "$OUT/$name" ]; then
    python3 - "$OUT/$name" <<'PY'
import struct, sys
d = open(sys.argv[1], 'rb').read()
w, h = struct.unpack('>II', d[16:24])
print(f"  {sys.argv[1]}: {w}x{h} {len(d)//1024} KB")
PY
  else
    echo "  FAILED $name"
  fi
}

shoot 1-board.jpg    "#/"                              1280 800
shoot 2-bounty.jpg   "#/bounty/makefun-frontend-01"         1280 800
shoot 3-leaderboard.jpg "#/bounty/token-radar-01/leaderboard" 1280 800

kill $SERVER 2>/dev/null
wait $SERVER 2>/dev/null
echo done
