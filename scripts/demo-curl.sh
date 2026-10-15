#!/usr/bin/env bash
# Stage demo: send the 3 scenes to the public guard API and print the verdicts.
#   ./scripts/demo-curl.sh                       # local `pnpm dev:worker` (http://127.0.0.1:8787)
#   ./scripts/demo-curl.sh https://topiapause.<you>.workers.dev
#   RAW=1 ./scripts/demo-curl.sh                 # full JSON responses
set -euo pipefail

BASE="${1:-${BASE_URL:-http://127.0.0.1:8787}}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/demo" && pwd)"

summarize() {
  if [[ -n "${RAW:-}" ]]; then cat; return; fi
  if command -v jq >/dev/null 2>&1; then
    jq '{decision, findings: [.findings[].ruleId], counterOffer: .counterOffer.proposal.summary, recheck: .counterOffer.recheck, metrics: (.metrics | with_entries(select(.key | test("aMax|cap|share|Share|premium|monthly|protected"; "i")))), voice: .voiceText.th}'
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c '
import json, re, sys
v = json.load(sys.stdin)
co = v.get("counterOffer") or {}
print(json.dumps({
  "decision": v["decision"],
  "findings": [f["ruleId"] for f in v["findings"]],
  "counterOffer": (co.get("proposal") or {}).get("summary"),
  "recheck": co.get("recheck"),
  "metrics": {k: n for k, n in v["metrics"].items() if re.search("amax|cap|share|premium|monthly|protected", k, re.I)},
  "voice": v["voiceText"]["th"],
}, ensure_ascii=False, indent=2))'
  else
    cat
  fi
}

curl -fsS "$BASE/api/health" >/dev/null || { echo "API not reachable at $BASE (start it with: pnpm build && pnpm dev:worker)" >&2; exit 1; }

for scene in subscription stay crypto; do
  printf '\n\033[1m▶ %s\033[0m  %s\n' "$scene" "$(grep -m1 '"userText"' "$DIR/$scene.json" | sed 's/.*: "\(.*\)",/\1/')"
  echo "  curl -X POST $BASE/api/guard/check -H 'Content-Type: application/json' -d @scripts/demo/$scene.json"
  curl -fsS -X POST "$BASE/api/guard/check" -H 'Content-Type: application/json' --data-binary "@$DIR/$scene.json" | summarize
done
