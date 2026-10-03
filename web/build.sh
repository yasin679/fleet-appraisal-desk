#!/usr/bin/env bash
# Builds the single-file front end from the sources in this folder.
#   -> src/Maritime.Appraisal.Api/wwwroot/index.html   (server version, talks to /api)
#   -> prototype/fleet-appraisal-desk.html             (stand-alone version, runs in the browser with demo data)
set -euo pipefail
cd "$(dirname "$0")"
JS="a_data.js b_core.js c_rules.js d_shell.js e_appraisal.js f_compare.js g_rest.js"
body() { cat 0_head.html; echo '<div id="app"></div>'; echo '<script>'; cat $JS; echo '</script>'; }
HEAD='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fleet Appraisal Desk</title></head><body>'
{ echo "$HEAD"; echo '<script>window.FAD_API="/api";</script>'; body; echo '</body></html>'; } > ../src/Maritime.Appraisal.Api/wwwroot/index.html
{ echo "$HEAD"; body; echo '</body></html>'; } > ../prototype/fleet-appraisal-desk.html
if command -v node >/dev/null; then cat $JS | node -e 'new Function(require("fs").readFileSync(0,"utf8")); console.log("web: syntax ok")'; fi
echo "web: built wwwroot/index.html and prototype/fleet-appraisal-desk.html"
