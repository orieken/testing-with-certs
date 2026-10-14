#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
# Re-execute unit tests even when Docker reused successful build layers.
docker build --platform linux/amd64 --target build -t magic-shop-all-catalog-tests:local -f services/catalog-api/Containerfile .
docker run --rm --platform linux/amd64 --network none --entrypoint go magic-shop-all-catalog-tests:local test -count=1 ./...
docker run --rm --network none --mount type=bind,source="$PWD/contracts/bundled/customer.json",target=/work/contracts/bundled/customer.json,readonly --entrypoint sh magic-shop-customer-api:03 -c 'node --test /app/dist/*.test.js'
docker run --rm --network none --entrypoint python magic-shop-insights-api:03 -m unittest discover -s /app -p 'test_*.py'
