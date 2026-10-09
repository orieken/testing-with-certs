#!/bin/sh
set -eu

case "${1:-}" in
  generate|check|validator) ;;
  *) echo 'Usage: contract-tooling-container.sh generate|check|validator' >&2; exit 2 ;;
esac

export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
export CI=true
npm install --global --ignore-scripts --no-audit --no-fund pnpm@12.9.1
pnpm install --frozen-lockfile --filter @magic-shop/contracts --filter @magic-shop/testing
pnpm --filter @magic-shop/contracts run lint

case "$1" in
  generate)
    pnpm --filter @magic-shop/contracts run generate
    pnpm --filter @magic-shop/contracts run typecheck
    ;;
  check)
    pnpm --filter @magic-shop/contracts run check
    pnpm --filter @magic-shop/contracts run typecheck
    ;;
  validator)
    pnpm --filter @magic-shop/contracts run check
    pnpm --filter @magic-shop/contracts run typecheck
    pnpm --filter @magic-shop/testing run typecheck
    pnpm --filter @magic-shop/testing run contracts:validator
    ;;
esac
