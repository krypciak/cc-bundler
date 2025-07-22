#!/bin/sh
cd ../..
cd assets
mkdir -p ../cc-bundler/build/assets
ouch c -S * ../cc-bundler/tmp/_assets.zip

cd ..
cd ccloader3/dist/runtime
ouch c -S * ../../../cc-bundler/tmp/runtime.ccmod --format zip
