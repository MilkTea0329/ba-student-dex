#!/bin/bash
# Build an unsigned .ipa on macOS.  Requires Xcode + XcodeGen (brew install xcodegen).
set -euo pipefail

cd "$(dirname "$0")/StudentDex"

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "xcodegen not found — run: brew install xcodegen"
  exit 1
fi

xcodegen generate

xcodebuild \
  -project StudentDex.xcodeproj \
  -scheme StudentDex \
  -configuration Release \
  -sdk iphoneos \
  -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  build

rm -rf Payload StudentDex.ipa
mkdir -p Payload
cp -R build/Build/Products/Release-iphoneos/StudentDex.app Payload/
zip -qry StudentDex.ipa Payload

echo ""
echo "✅ 已生成 $(pwd)/StudentDex.ipa"
echo "接下来用 Sideloadly / AltStore 使用你自己的 Apple ID 签名安装。"
