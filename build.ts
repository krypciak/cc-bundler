import * as esbuild from 'esbuild'
import * as fs from 'fs'

const vfsData = await fs.promises.readFile('src/vfsData/fttree.json', 'utf8')
const dataRef: string[] = []
const dataRefPaths = (await fs.promises.readdir('src/vfsData')).filter(name => name.startsWith('fttreeDataRef'))
await Promise.all(
    dataRefPaths.map(async (fileName, i) => {
        const path = `src/vfsData/${fileName}`
        dataRef[i] = await fs.promises.readFile(path, 'utf8')
    })
)

let html = await fs.promises.readFile('./src/index.html', 'utf8')
const htmlImgs = html.split('\n').flatMap(line => [...line.matchAll(/url\((.*\.png)\)/g)])
for (const entry of htmlImgs) {
    const url = entry[1]
    let path: string = '../assets/game/page/' + url

    const data: string = await fs.promises.readFile(path, 'base64')
    html = html.replace(new RegExp(url), "'data:image/png;base64," + data + "'")
}
html = html.replace(/@FAV_ICON/, 'data:image/png;base64,' + (await fs.promises.readFile('../favicon.png', 'base64')))

const substitute = {
    VFS_DATA: vfsData,
    ...Object.fromEntries(
        new Array(15).fill(null).map((_, i) => {
            return [`REF_DATA_${i}`, dataRef[i] ?? '[]']
        })
    ),
}
const ctx = await esbuild.context({
    entryPoints: ['src/main.ts'],
    bundle: true,
    target: 'es2018',
    outfile: 'plugin.js',
    logOverride: {
        'suspicious-boolean-not': 'silent',
        // 'assign-to-define': 'silent'
    },
    write: false,
    minify: false,
    define: {
        'window.IG_GAME_CACHE': `""`,
        'window.IG_ROOT': `"/assets/"`,
        'window.IG_WIDTH': `568`,
        'window.IG_HEIGHT': `320`,
        'window.IG_SCREEN_MODE_OVERRIDE': `2`,
        'window.IG_WEB_AUDIO_BGM': `false`,
        'window.IG_FORCE_HTML5_AUDIO': `false`,
        'window.LOAD_LEVEL_ON_GAME_START': `null`,
        'window.IG_GAME_DEBUG': `false`,
        'window.IG_GAME_BETA': `false`,
        'window.IG_HIDE_DEBUG': `false`,
    },
    drop: ['debugger' /*'console'*/],
    plugins: [
        {
            name: 'print',
            setup(build) {
                build.onStart(() => {
                    console.log()
                    console.log('building...')
                })
                build.onEnd(async res => {
                    const code = res.outputFiles![0].text

                    await fs.promises.writeFile('./dist.html', html.slice(0, html.indexOf('@JS_SCRIPT')))

                    let i = 0
                    async function append(text: string) {
                        await fs.promises.writeFile('./dist.html', text, { flag: 'a+' })
                        // console.log('writing', text.slice(0, 100))
                    }
                    async function put(index: number) {
                        const str = code.slice(i, index)
                        await append(str)
                        i = index
                    }
                    for (const key in substitute) {
                        const to = substitute[key]
                        const index = code.indexOf(key)
                        await put(index)
                        i += key.length
                        await append(to)
                    }
                    await put(code.length)

                    await append(html.slice(html.indexOf('@JS_SCRIPT') + '@JS_SCRIPT'.length))

                    const stat = await fs.promises.stat('./dist.html')
                    const mb = stat.size / 1_048_576
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
    process.exit()
}

if (process.argv[2] == 'build') {
    await build()
} else if (process.argv[2] == 'watch') {
    await watch()
}
