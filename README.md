# Build instructions

```bash
# cd /my/crosscode/directory
git clone https://github.com/krypciak/cc-bundler
cd cc-bundler
pnpm install
# edit src/mods.ts to select which mods you want to include
# if you do not include the mod cc-alybox, edit src/generate-fs-tree.ts and comment out the entire function alybox()
tsc # should return no errors
pnpm run genVfs
pnpm run build
```
