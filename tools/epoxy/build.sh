#!/usr/bin/env bash
# builds epoxy/index.js (epoxy-transport 3.0.2 + patched epoxy-tls 2.1.20-1); usage in README.md, "The Epoxy build"
set -euo pipefail
P=/p
OUT=/out
mkdir -p $OUT /src
cd /src
[ -d epoxy-tls ] || git clone -q https://github.com/MercuryWorkshop/epoxy-tls.git
git -C epoxy-tls checkout -q -f 9cde724aea1a0f5e46b1c962b3d19ca1389af074
git -C epoxy-tls clean -q -fdx -e target
[ -d hyper-util-wasm ] || git clone -q https://github.com/r58Playz/hyper-util-wasm.git
git -C hyper-util-wasm checkout -q -f 07117dd90174688341c27df2fdeb023c71015e4a
git -C hyper-util-wasm apply $P/hyper-util-wasm.patch
git -C epoxy-tls apply $P/epoxy-tls.patch
rustc -V; wasm-bindgen -V; wasm-opt --version

cd /src/epoxy-tls/client
RELEASE=1 bash build.sh > $OUT/epoxy-tls-build.log 2>&1 || { tail -n 40 $OUT/epoxy-tls-build.log; exit 1; }

rm -rf /src/et && mkdir -p /src/et && cd /src/et
npm pack -s @mercuryworkshop/epoxy-transport@3.0.2 > /dev/null
tar xzf mercuryworkshop-epoxy-transport-3.0.2.tgz
cd package
npm install --no-audit --no-fund --loglevel=error > /dev/null
npm install --no-save --no-audit --no-fund --loglevel=error typescript@5 > /dev/null
# check first: npm epoxy-tls must rebuild to published dist/index.js (pnpm path comment aside)
node esbuild.bundle.mjs > /dev/null 2>&1
sed -i 's#// node_modules/@mercuryworkshop/epoxy-tls/full/#// node_modules/.pnpm/@mercuryworkshop+epoxy-tls@2.1.20-1/node_modules/@mercuryworkshop/epoxy-tls/full/#' dist/index.js
echo "transport rebuild of npm original: $(sha256sum < dist/index.js | cut -c1-64) (expect 55ac6bb88d2c27f43ddddc42b86097db34e03783bddcae3141a69605abe49108)"
rm -rf node_modules/@mercuryworkshop/epoxy-tls/full dist
cp -r /src/epoxy-tls/client/pkg node_modules/@mercuryworkshop/epoxy-tls/full
node esbuild.bundle.mjs > /dev/null 2>&1
cp dist/index.js $OUT/index.js
sha256sum $OUT/index.js
