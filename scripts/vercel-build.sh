#!/usr/bin/env bash
set -e
cd apps/web
pnpm run build
node ../../scripts/patch-vercel.cjs
cp -r .vercel/output ../../.vercel/output
