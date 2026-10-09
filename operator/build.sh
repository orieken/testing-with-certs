#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
arch=$(uname -m)
case "$arch" in arm64|aarch64) goarch=arm64;; x86_64|amd64) goarch=amd64;; *) echo "Unsupported host architecture: $arch" >&2; exit 2;; esac
case "$(uname -s)" in Darwin) goos=darwin;; Linux) goos=linux;; *) echo 'Unsupported host OS' >&2; exit 2;; esac
mkdir -p "$root/artifacts/operator/bin"
docker run --rm -v "$root/operator:/src" -v "$root/artifacts/operator/bin:/out" -w /src \
  -e GOOS="$goos" -e GOARCH="$goarch" -e CGO_ENABLED=0 \
  golang:1.26.0-bookworm@sha256:2a0ba12e116687098780d3ce700f9ce3cb340783779646aafbabed748fa6677c \
  go build -trimpath -o /out/magic-shop-operator .
