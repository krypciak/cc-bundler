import * as esbuild from 'esbuild'
import * as fs from 'fs'
import type { DataRef, VfsTree } from '../src/vfs'
import { forEachNode, isFile, isDir, isRef, uncompressData } from '../src/vfs'

async function loadVfsData() {
    const vfsDataDir = './vfsData'
    const vfsData = await fs.promises.readFile(`${vfsDataDir}/fttree.json`, 'utf8')
    const dataRef: string[] = []
    const dataRefPaths = (await fs.promises.readdir(vfsDataDir)).filter(name => name.startsWith('fttreeDataRef'))
    await Promise.all(
        new Array(dataRefPaths.length).fill(null).map(async (_, i) => {
            const path = `${vfsDataDir}/fttreeDataRef_${i}.json`
            dataRef[i] = await fs.promises.readFile(path, 'utf8')
        })
    )
    return { vfsData, dataRef }
}

const favIconPath = '../../favicon.png'
async function handleCssImageReplacement(html: string, singleFile: boolean) {
    const htmlImgs = html.split('\n').flatMap(line => [...line.matchAll(/url\((.*\.png)\)/g)])
    for (const entry of htmlImgs) {
        const url = entry[1]
        const path = `./assets/game/page/${url}`

        const replacement = singleFile ? `'data:image/png;base64,${await fs.promises.readFile(`../../${path}`, 'base64')}'` : path
        html = html.replace(new RegExp(url), replacement)
    }
    const favIconReplacement = singleFile ? 'data:image/png;base64,' + (await fs.promises.readFile(favIconPath, 'base64')) : '/favicon.png'
    html = html.replace(/@FAV_ICON/, favIconReplacement)
    return html
}

async function loadSubstitutions(vfsData: string, dataRef: string[], singleFile: boolean) {
    const substitute: Record<string, string> = {}
    Object.assign(substitute, {
        VFS_DATA: vfsData,
    })
    Object.assign(substitute, {
        ...Object.fromEntries(
            new Array(15).fill(null).map((_, i) => {
                return [`REF_DATA_${i}`, (singleFile ? dataRef[i] : undefined) ?? '[]']
            })
        ),
    })
    return substitute
}

async function writeVfsToDir(distDir: string, vfsDataStr: string, dataRefStr: string[]) {
    distDir += '/assets'
    const vfsData: VfsTree = JSON.parse(vfsDataStr)
    const dataRef: DataRef = dataRefStr.map(a => JSON.parse(a))

    await forEachNode(vfsData, async (node, _fileName, filePath) => {
        const newPath = `${distDir}${filePath}`
        if (!isDir(node)) return
        await fs.promises.mkdir(newPath, { recursive: true })
    })

    await forEachNode(vfsData, async (node, _fileName, filePath) => {
        if (isDir(node)) return

        const newPath = `${distDir}${filePath}`
        let dataStr: string
        if (isFile(node)) {
            throw new Error('how')
            // dataStr = node.c
        } else if (isRef(node)) {
            dataStr = dataRef[node.fi][node.i]
        } else throw new Error('huh')

        const data = await uncompressData(dataStr)
        await fs.promises.writeFile(newPath, data)
    })
}

async function watch(ctx: esbuild.BuildContext) {
    await ctx.watch()
}
async function build(ctx: esbuild.BuildContext) {
    await ctx.rebuild()
    process.exit()
}

async function run() {
    const distDir = '../dist'
    await fs.promises.rm(distDir, { recursive: true })
    await fs.promises.mkdir(distDir, { recursive: true })

    const outIndexPath = `${distDir}/index.html`

    const singleFile: boolean = false

    const { vfsData, dataRef } = await loadVfsData()

    let html = await fs.promises.readFile('./index.html', 'utf8')
    html = await handleCssImageReplacement(html, singleFile)

    const substitute = await loadSubstitutions(vfsData, dataRef, singleFile)

    const socketioPath = '../lib/socket.io.min.js'
    const socketioCode = await fs.promises.readFile(socketioPath, 'utf8')
    const outJsPath = './crosscode.js'
    const distJsPath = `${distDir}/${outJsPath}`

    let buildI = 0
    const plugin: esbuild.Plugin = {
        name: 'print',
        setup(build) {
            build.onStart(() => {
                console.log()
                console.log('building...')
            })
            build.onEnd(async res => {
                const code = res.outputFiles![0].text

                const socketioTag = '@SOCKETIO_SCRIPT'
                const jsTag = '@JS_SCRIPT'
                await fs.promises.writeFile(outIndexPath, html.slice(0, html.indexOf(socketioTag)))
                // await fs.promises.writeFile(outIndexPath, html.slice(0, html.indexOf(jsTag)))

                let i = 0
                async function appendHtml(text: string) {
                    await fs.promises.writeFile(outIndexPath, text, { flag: 'a+' })
                }
                async function appendJs(text: string) {
                    await fs.promises.writeFile(distJsPath, text, { flag: 'a+' })
                }
                async function appendCode(text: string) {
                    if (singleFile) {
                        return appendHtml(text)
                    } else {
                        return appendJs(text)
                    }
                    // console.log('writing', text.slice(0, 100))
                }

                if (singleFile) {
                    await appendHtml(`<script>\n${socketioCode}\n</script>\n`)
                } else {
                    const socketioOutPath = './socket.io.js'
                    await appendHtml(`<script src="${socketioOutPath}"></script>\n`)
                    await fs.promises.writeFile(`${distDir}/${socketioOutPath}`, socketioCode)
                }
                appendHtml(html.slice(html.indexOf(socketioTag) + socketioTag.length, html.indexOf(jsTag)))

                if (singleFile) {
                    await appendHtml(`<script type="module">\n`)
                } else {
                    await appendHtml(`<script type="module" src="${outJsPath}">`)
                    await fs.promises.writeFile(distJsPath, '')
                }

                async function put(index: number) {
                    const str = code.slice(i, index)
                    await appendCode(str)
                    i = index
                }
                for (const key in substitute) {
                    const to = substitute[key]
                    const index = code.indexOf(key)
                    if (index == -1) continue
                    await put(index)
                    i += key.length
                    await appendCode(to)
                }
                await put(code.length)

                await appendHtml(`</script>\n`)

                await appendHtml(html.slice(html.indexOf(jsTag) + jsTag.length))

                if (!singleFile && buildI == 0) {
                    await writeVfsToDir(distDir, vfsData, dataRef)
                    await fs.promises.writeFile(`${distDir}/favicon.png`, await fs.promises.readFile(favIconPath))
                }

                const stat = await fs.promises.stat(outIndexPath)
                const mb = stat.size / 1_048_576
                console.log('build done, index.html size:', mb.toFixed(2), 'MB')
                buildI++
            })
        },
    }

    const ctx = await esbuild.context({
        entryPoints: ['../src/main.ts'],
        bundle: true,
        target: 'es2018',
        outfile: 'plugin.js',
        logOverride: {
            'suspicious-boolean-not': 'silent',
            // 'assign-to-define': 'silent'
            'direct-eval': 'silent',
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
            'window.CHOSEN_FS_PROXY': singleFile ? '"vfs"' : '"webfs"',
        },
        drop: ['debugger' /*'console'*/],
        sourcemap: 'inline',
        plugins: [plugin],
        external: ['nw.gui', 'fs', 'http', 'crypto'],
    })

    if (process.argv[2] == 'build') {
        await build(ctx)
    } else if (process.argv[2] == 'watch') {
        await watch(ctx)
    }
}
await run()
