#!/usr/bin/env bash
# Builds Fleet Appraisal Desk for Android without Gradle.
#
# Tools are found in this order:
#   1. explicit env vars: AAPT2, ANDROID_JAR, D8_JAR, APKSIGNER_JAR, JAVAC (or ECJ_JAR)
#   2. an Android SDK in $ANDROID_HOME / $ANDROID_SDK_ROOT (build-tools + platforms/android-34)
#
# Signing: set KEYSTORE, KEYSTORE_PASS, KEY_ALIAS (and optionally KEY_PASS).
# Without them a local keystore is created in mobile/android/keystore/ (keep it safe:
# Android only accepts updates signed with the same key).
#
# Output: mobile/android/dist/FleetAppraisalDesk-<version>.apk
set -euo pipefail
cd "$(dirname "$0")"
HERE=$(pwd)
VERSION_NAME=${VERSION_NAME:-2.1.0}
VERSION_CODE=${VERSION_CODE:-210}
MIN_SDK=24
TARGET_SDK=34

SDK=${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}
if [ -n "$SDK" ] && [ -d "$SDK/build-tools" ]; then
  BT=$(ls -d "$SDK"/build-tools/*/ | sort -V | tail -1)
  AAPT2=${AAPT2:-$BT/aapt2}
  D8_JAR=${D8_JAR:-$BT/lib/d8.jar}
  APKSIGNER_JAR=${APKSIGNER_JAR:-$BT/lib/apksigner.jar}
  ANDROID_JAR=${ANDROID_JAR:-$(ls -d "$SDK"/platforms/android-3[4-9]/android.jar 2>/dev/null | sort -V | tail -1)}
fi
: "${AAPT2:?Set AAPT2 or ANDROID_HOME}"; : "${ANDROID_JAR:?Set ANDROID_JAR or ANDROID_HOME}"
: "${D8_JAR:?Set D8_JAR or ANDROID_HOME}"; : "${APKSIGNER_JAR:?Set APKSIGNER_JAR or ANDROID_HOME}"

B=$HERE/build; rm -rf "$B"; mkdir -p "$B/gen" "$B/classes" "$B/dex" dist

echo "1/6 web bundle"
bash ../../web/build.sh >/dev/null
rm -rf "$B/assets"; mkdir -p "$B/assets/www"; cp -r ../www/. "$B/assets/www/"

echo "2/6 resources"
"$AAPT2" compile --dir res -o "$B/res.zip"
"$AAPT2" link -o "$B/base.apk" -I "$ANDROID_JAR" --manifest AndroidManifest.xml -A "$B/assets" \
  --min-sdk-version $MIN_SDK --target-sdk-version $TARGET_SDK --version-code $VERSION_CODE --version-name "$VERSION_NAME" \
  --java "$B/gen" --auto-add-overlay "$B/res.zip"

echo "3/6 compile Java"
SRC=$(find src "$B/gen" -name '*.java')
if [ -n "${ECJ_JAR:-}" ]; then
  java -jar "$ECJ_JAR" -source 8 -target 8 -nowarn -encoding UTF-8 -bootclasspath "$ANDROID_JAR" -classpath "$ANDROID_JAR" -d "$B/classes" $SRC
else
  ${JAVAC:-javac} -source 8 -target 8 -nowarn -Xlint:-options -encoding UTF-8 -bootclasspath "$ANDROID_JAR" -classpath "$ANDROID_JAR" -d "$B/classes" $SRC
fi

echo "4/6 dex"
java -cp "$D8_JAR" com.android.tools.r8.D8 --release --min-api $MIN_SDK --lib "$ANDROID_JAR" --output "$B/dex" $(find "$B/classes" -name '*.class')

echo "5/6 package and align"
cp "$B/base.apk" "$B/unaligned.apk"
(cd "$B/dex" && python3 - <<'PY'
import zipfile
z = zipfile.ZipFile('../unaligned.apk', 'a', zipfile.ZIP_DEFLATED)
z.write('classes.dex', 'classes.dex')
z.close()
PY
)
python3 zipalign.py "$B/unaligned.apk" "$B/aligned.apk"

echo "6/6 sign"
if [ -z "${KEYSTORE:-}" ]; then
  KEYSTORE=$HERE/keystore/fleetappraisal-release.jks; KEY_ALIAS=fleetappraisal
  KEYSTORE_PASS=${KEYSTORE_PASS:-fleetappraisal}
  if [ ! -f "$KEYSTORE" ]; then
    mkdir -p "$(dirname "$KEYSTORE")"
    keytool -genkeypair -keystore "$KEYSTORE" -storepass "$KEYSTORE_PASS" -keypass "$KEYSTORE_PASS" -alias "$KEY_ALIAS" \
      -keyalg RSA -keysize 3072 -validity 10000 -dname "CN=Fleet Appraisal Desk, O=Yasin Jariwala, C=IN" >/dev/null 2>&1
    echo "   created $KEYSTORE (password: $KEYSTORE_PASS) - keep it safe"
  fi
fi
OUT=dist/FleetAppraisalDesk-$VERSION_NAME.apk
java -jar "$APKSIGNER_JAR" sign --ks "$KEYSTORE" --ks-pass "pass:$KEYSTORE_PASS" --ks-key-alias "$KEY_ALIAS" \
  --key-pass "pass:${KEY_PASS:-$KEYSTORE_PASS}" --min-sdk-version $MIN_SDK --out "$OUT" "$B/aligned.apk"
java -jar "$APKSIGNER_JAR" verify --min-sdk-version $MIN_SDK "$OUT"
echo "built $OUT ($(du -h "$OUT" | cut -f1))"
