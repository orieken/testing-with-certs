#!/bin/sh
set -eu
mkdir -p /tmp/saturday-cert/src
cp /source/packages/saturday-playwright-certs/src/index.ts /source/packages/saturday-playwright-certs/src/fixture.ts /tmp/saturday-cert/src/
cp /source/packages/saturday-playwright-certs/tsconfig.json /tmp/saturday-cert/
cp /source/packages/saturday-playwright-certs/README.md /source/LICENSE /source/NOTICE /tmp/saturday-cert/
cp /source/packages/saturday-playwright-certs/package.json /tmp/saturday-cert/
node --input-type=module -e 'import fs from "node:fs"; const p="/tmp/saturday-cert/package.json"; const j=JSON.parse(fs.readFileSync(p)); j.dependencies["@orieken/saturday-core"]="0.1.3"; j.files=["dist","README.md","LICENSE","NOTICE"]; delete j.scripts; fs.writeFileSync(p,JSON.stringify(j,null,2));'
ln -s /work/node_modules /tmp/saturday-cert/node_modules
cd /tmp/saturday-cert
/work/node_modules/.bin/tsup src/index.ts src/fixture.ts --dts --format cjs,esm --out-dir dist
npm pack --ignore-scripts --pack-destination /output
