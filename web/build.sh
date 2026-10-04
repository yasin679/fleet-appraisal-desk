#!/usr/bin/env bash
# Builds the single-file front end from the sources in this folder.
#   -> src/Maritime.Appraisal.Api/wwwroot/index.html   (server version, talks to /api)
#   -> prototype/fleet-appraisal-desk.html             (stand-alone version, demo data in memory)
#   -> mobile/www/index.html                           (mobile app / installable web app, demo data kept on the device)
set -euo pipefail
cd "$(dirname "$0")"
JS="a_data.js b_core.js c_rules.js d_shell.js e_appraisal.js f_compare.js g_rest.js"
body() { cat 0_head.html; echo '<div id="app"></div>'; echo '<script>'; cat $JS; echo '</script>'; }
HEAD='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fleet Appraisal Desk</title></head><body>'
{ echo "$HEAD"; echo '<script>window.FAD_API="/api";</script>'; body; echo '</body></html>'; } > ../src/Maritime.Appraisal.Api/wwwroot/index.html
{ echo "$HEAD"; body; echo '</body></html>'; } > ../prototype/fleet-appraisal-desk.html

# Mobile: no web fonts (works offline), safe-area padding for notches, web-app manifest and offline cache.
MHEAD='<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#13212E"><meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Fleet Appraisal">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" href="icons/apple-touch-180.png">
<link rel="icon" type="image/png" href="icons/pwa-192.png"><title>Fleet Appraisal Desk</title>
<style>.bar{top:0!important;padding-top:env(safe-area-inset-top)}#app{padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);padding-bottom:env(safe-area-inset-bottom)}html{-webkit-text-size-adjust:100%}button,a,input,select,textarea{touch-action:manipulation}</style>
</head><body>'
{ echo "$MHEAD"; echo '<script>window.FAD_DEVICE=true;</script>'
  body | grep -v 'fonts.googleapis.com\|fonts.gstatic.com'
  echo '<script>if(location.protocol==="https:"&&"serviceWorker" in navigator){navigator.serviceWorker.register("sw.js").catch(function(){});}</script>'
  echo '</body></html>'; } > ../mobile/www/index.html

if command -v node >/dev/null; then cat $JS | node -e 'new Function(require("fs").readFileSync(0,"utf8")); console.log("web: syntax ok")'; fi
echo "web: built wwwroot/index.html, prototype/fleet-appraisal-desk.html and mobile/www/index.html"
