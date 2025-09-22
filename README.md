# cc-bundler

cc-bundler is a offline progressive web app that allows uploading the game assets and running the game in the browser.  
Full modding support with ccloader3 preinstalled.
Filesystem emulation through a custom `node:fs` emulation layer that's based on the [Origin Private File System](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system) web API.

## Build instructions

```bash
# cd /my/crosscode/directory/with/ccloader3
git clone https://github.com/krypciak/cc-bundler
cd cc-bundler
pnpm install
pnpm run build # pnpm run watch
# should produce ./dist

pnpm run httpServer
```
