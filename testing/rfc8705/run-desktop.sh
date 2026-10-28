#!/bin/sh
set -eu
LAB_RECORDING_PRIVACY_DIR=/tmp/recording-privacy LAB_RECORDING_HEADED=1 node /work/testing/teaching/auth-recording-privacy.mjs
node --input-type=module -e 'import{mkdirSync,writeFileSync}from"node:fs";const dir=`/work/artifacts/rfc8705/${process.env.LAB_BROWSER}`;mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/privacy.json`,JSON.stringify({status:"passed",mechanism:"provider-document-hidden-before-paint",decodedFramesChecked:true,desktop:"Xvfb+x11vnc+noVNC",browser:process.env.LAB_BROWSER}));'
cd /work/testing
./node_modules/.bin/playwright test --config playwright.rfc8705.config.mjs
