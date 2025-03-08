import * as esbuild from 'esbuild'
import * as fs from 'fs'

function injectVfsData(): esbuild.Plugin {
    return {
        name: 'replace-string',
        setup(build) {
            build.onLoad({ filter: /vfs.ts/ }, async args => {
                const source = await fs.promises.readFile(args.path, 'utf8')
                const vfsData = await fs.promises.readFile('src/fttree.json', 'utf8')
                const contents = source.replace(/@VFS_DATA/, vfsData)
                return { contents: contents, loader: 'ts' }
            })
        },
    }
}

const ctx = await esbuild.context({
    entryPoints: ['src/main.ts'],
    bundle: true,
    target: 'es2018',
    outfile: 'plugin.js',
    logOverride: { 'suspicious-boolean-not': 'silent' },
    write: false,
    plugins: [
        injectVfsData(),
        {
            name: 'print',
            setup(build) {
                build.onStart(() => {
                    console.log()
                    console.log('building...')
                })
                build.onEnd(async a => {
                    const txt = a.outputFiles![0].text

                    let html = await fs.promises.readFile('./src/index.html', 'utf8')
                    html = html.replace(/@JS_SCRIPT/, txt)

                    await fs.promises.writeFile('./dist.html', html)

                    const mb = a.outputFiles![0].contents.length / 1_048_576
                    console.log('build done, size:', mb.toFixed(2), 'MB')
                })
            },
        },
        //
    ],
    external: ['nw.gui'],
})
async function watch() {
    await ctx.watch()
}
async function build() {
    await ctx.rebuild()
}

if (process.argv[2] == 'build') {
    await build()
} else if (process.argv[2] == 'watch') {
    await watch()
}
