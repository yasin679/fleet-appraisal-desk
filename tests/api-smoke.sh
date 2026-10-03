#!/usr/bin/env bash
# API smoke test: starts the API on port 5077 with a fresh SQLite file of demo data, checks sign-in,
# then walks one appraisal through every step (X-User header auth is switched on for this run only).
# Usage: bash tests/api-smoke.sh   (needs the .NET 8 SDK and curl)
set -u
cd "$(dirname "$0")/.."
# Offline machines: RESTORE_ARGS="-p:RestoreSources=/path/to/empty/folder" bash tests/api-smoke.sh
dotnet build src/Maritime.Appraisal.Api ${RESTORE_ARGS:-} >/tmp/appraisal-api-build.log 2>&1 || { echo "Build failed, see /tmp/appraisal-api-build.log"; exit 1; }
DB=$(mktemp -d)/smoke.db
Storage__SqlitePath=$DB Demo__AllowHeaderAuth=true dotnet run --no-build --project src/Maritime.Appraisal.Api --urls http://localhost:5077 >/tmp/appraisal-api.log 2>&1 &
PID=$!; trap 'kill $PID 2>/dev/null; rm -rf "$(dirname "$DB")"' EXIT
for i in $(seq 1 60); do curl -s --noproxy '*' -o /dev/null http://localhost:5077/health && break; sleep 1; done
B=http://localhost:5077/api; pass=0; fail=0
check() { # name, expected status, user, method, path, [body]
  local code; code=$(curl -s --noproxy '*' -o /tmp/smoke.json -w '%{http_code}' -X "$4" -H "X-User: $3" -H 'Content-Type: application/json' ${6:+--data-binary "$6"} "$B$5")
  if [ "$code" = "$2" ]; then pass=$((pass+1)); echo "  PASS  $1 ($code)"; else fail=$((fail+1)); echo "  FAIL  $1: expected $2, got $code: $(head -c 300 /tmp/smoke.json)"; fi
}
auth() { # name, expected status, curl args...
  local name=$1 want=$2; shift 2; local code; code=$(curl -s --noproxy '*' -o /tmp/smoke.json -w '%{http_code}' -c /tmp/smoke.cookies -b /tmp/smoke.cookies "$@")
  if [ "$code" = "$want" ]; then pass=$((pass+1)); echo "  PASS  $name ($code)"; else fail=$((fail+1)); echo "  FAIL  $name: expected $want, got $code"; fi
}
rm -f /tmp/smoke.cookies
auth "health check"                             200 http://localhost:5077/health
auth "API refuses without sign-in"              401 $B/worklist
auth "wrong password refused"                   401 -H 'Content-Type: application/json' -d '{"userId":"V1-2O","password":"nope"}' $B/auth/login
auth "sign in with demo password"               200 -H 'Content-Type: application/json' -d '{"userId":"V1-2O","password":"demo"}' $B/auth/login
auth "cookie gives access"                      200 $B/auth/me
auth "unknown API route is 404"                 404 $B/no-such-thing
auth "app page served for deep links"           200 http://localhost:5077/index.html
auth "sign out"                                 200 -X POST $B/auth/logout
auth "cookie no longer works"                   401 $B/auth/me
ID=A2026-V1-2O
check "seafarer reads own appraisal"            200 V1-2O   GET  /appraisals/$ID
check "another seafarer is refused"             403 V2-AB1  GET  /appraisals/$ID
check "submit self-evaluation too early"        422 V1-2O   POST /appraisals/$ID/self/submit
check "save self ratings"                       200 V1-2O   PUT  /appraisals/$ID/self '{"ratings":[{"goalId":"g1","rating":5,"note":"Led every drill."},{"goalId":"g2","rating":4},{"goalId":"g3","rating":4},{"goalId":"g4","rating":4},{"goalId":"g5","rating":4}],"summary":{"achievements":"Clean audits.","challenges":"","support":""}}'
check "submit self-evaluation"                  200 V1-2O   POST /appraisals/$ID/self/submit
check "seafarer can't evaluate themselves"      403 V1-2O   POST /appraisals/$ID/evaluation/submit
check "appraiser saves evaluation"              200 V1-CO   PUT  /appraisals/$ID/evaluation '{"ratings":[{"goalId":"g1","rating":4},{"goalId":"g2","rating":2,"note":"Two late items at audit."},{"goalId":"g3","rating":4},{"goalId":"g4","rating":4},{"goalId":"g5","rating":4}],"assessment":{"strengths":"Calm on watch.","improvements":"Close audit items sooner.","rehire":"Recommended","promotion":"ReadyNextYear","training":["ECDIS type-specific"],"comment":""}}'
check "appraiser submits"                       200 V1-CO   POST /appraisals/$ID/evaluation/submit
check "seafarer acknowledges"                   200 V1-2O   POST /appraisals/$ID/acknowledge '{"agrees":true}'
check "Master countersigns"                     200 V1-MST  POST /appraisals/$ID/countersign '{"comment":"Fair."}'
check "Approved blocked without decision"       422 CREWING POST /appraisals/$ID/approve '{"promotionApproved":false,"training":[],"remarks":""}'
check "office approves and closes"              200 CREWING POST /appraisals/$ID/approve '{"decision":"Approved","promotionApproved":false,"training":["ECDIS type-specific"],"remarks":""}'
grep -q '"stage":"Done"' /tmp/smoke.json && { pass=$((pass+1)); echo "  PASS  appraisal is Done"; } || { fail=$((fail+1)); echo "  FAIL  appraisal not Done"; }
check "compare Joseph (2026)"                   200 V1-2O   GET  "/compare/V1-2O?year=2026"
grep -q '"fleetRank":1' /tmp/smoke.json && { pass=$((pass+1)); echo "  PASS  Joseph is 1st in the fleet"; } || { fail=$((fail+1)); echo "  FAIL  fleet rank"; }
check "seafarer can't compare a colleague"      403 V1-2O   GET  "/compare/V1-3O?year=2025"
check "office sees fleet vs industry"           200 CREWING GET  "/compare/fleet-vs-industry?year=2025"
check "upload benchmark CSV"                    200 CREWING POST "/benchmark?source=Smoke%20test" 'company,rank,year,overall
Pool Co,2O,2026,3.9
Pool Co,2/O,2026,3.1'
check "only Crewing uploads benchmark"          403 MSUPT   POST /benchmark 'company,rank,year,overall'
check "back to sample benchmark"                200 CREWING DELETE /benchmark
check "worklist"                                200 V1-CO   GET  /worklist
check "dashboard"                               200 CREWING GET  /dashboard
echo; echo "$pass passed, $fail failed"; [ $fail -eq 0 ]
