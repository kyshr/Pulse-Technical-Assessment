#!/usr/bin/env bash
# Probes the signal API's auth, state machine, rate limits and validation.
# Needs a running server: `npm run dev`, then `bash scripts/security-check.sh [host]`.
# Exits non-zero if any probe returns an unexpected status.
H=${1:-localhost:3000}; J='content-type: application/json'; FAIL=0
new() { node -p "crypto.randomUUID()"; }
pid() { node -p "require('crypto').createHash('sha256').update('$1').digest('hex')"; }
join() { curl -s -o /dev/null -X POST "$H/api/join" -H "$J" -d "{\"secret\":\"$1\",\"lat\":51.5,\"lng\":-0.1}"; }
sig() { curl -s -o /dev/null -X POST "$H/api/signal" -H "$J" -H "Authorization: Bearer $1" -d "{\"toId\":\"$2\",\"type\":\"$3\"$4}" -w %{http_code}; }
check() { # check <expected> <actual> <label>
  if [ "$1" = "$2" ]; then echo "ok   $2  $3"; else echo "FAIL $2 (want $1)  $3"; FAIL=1; fi
}

A=$(new); B=$(new); X=$(new); S=$(new); AI=$(pid "$A"); BI=$(pid "$B"); SI=$(pid "$S")
for s in "$A" "$B" "$X"; do join "$s"; done
# Heartbeat so nobody goes stale mid-run.
( while true; do for s in "$A" "$B" "$X" "$S"; do curl -s -o /dev/null "$H/api/poll" -H "Authorization: Bearer $s" & done; sleep 2; done ) & HB=$!
trap 'kill $HB 2>/dev/null; for s in "$A" "$B" "$X" "$S"; do curl -s -o /dev/null -X POST "$H/api/leave" -d "{\"secret\":\"$s\"}"; done' EXIT

check 401 "$(sig not-a-secret "$BI" request)"          "forged sender"
check 403 "$(sig "$X" "$BI" accept)"                   "stranger accepts"
check 403 "$(sig "$X" "$BI" offer ',"payload":"{}"')"  "offer while not connected"
check 403 "$(sig "$X" "$BI" end)"                      "end a link you're not in"
check 400 "$(sig "$X" "$AI" request ',"payload":"hi"')" "request with payload"
check 200 "$(sig "$A" "$BI" request)"                  "A requests B"
check 200 "$(sig "$B" "$AI" accept)"                   "B accepts A"
check 200 "$(sig "$A" "$BI" offer ',"payload":"{\"type\":\"offer\"}"')" "A offers B"
check 400 "$(sig "$A" "$BI" offer ',"payload":"<script>"')" "offer with non-JSON payload"
check 403 "$(sig "$X" "$AI" end)"                      "stranger ends A<->B"
check 200 "$(sig "$A" "$BI" end)"                      "A hangs up"

# A declined request must not leave a link the target can accept later.
check 200 "$(sig "$X" "$SI" request)"                  "X requests offline S (auto-declined)"
join "$S"
check 403 "$(sig "$S" "$(pid "$X")" accept)"           "S accepts the declined request"

# Cooldown: of 5 parallel requests exactly one may pass.
sleep 3
codes=$(for i in 1 2 3 4 5; do sig "$A" "$BI" request & done; wait)
check 1 "$(grep -o 200 <<<"$codes" | wc -l | tr -d ' ')" "parallel requests passing cooldown"

exit $FAIL
