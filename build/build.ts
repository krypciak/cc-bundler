import * as esbuild from 'esbuild'
import * as fs from 'fs'
import * as zlib from 'zlib'
import AdmZip from 'adm-zip'

const favIconPath = '../../favicon.png'
async function handleCssImageReplacement(html: string) {
    const htmlImgs = html.split('\n').flatMap(line => [...line.matchAll(/url\((.*\.png)\)/g)])
    for (const entry of htmlImgs) {
        const url = entry[1]
        const path = `./assets/game/page/${url}`

        const replacement = path
        html = html.replace(new RegExp(url), replacement)
    }
    const favIconReplacement = '/favicon.png'
    html = html.replace(/@FAV_ICON/, favIconReplacement)
    return html
}

async function writeDistFile(path: string, data: Uint8Array | string) {
    const promises: Promise<void>[] = []
    promises.push(fs.promises.writeFile(path, data))
    if (gzipCompression) {
        const compPath = `${path}.gz`
        const func = async () => {
            const buf = await new Promise<Buffer>((resolve, reject) => {
                zlib.gzip(data, (error: Error | null, result: Buffer) => {
                    if (error) reject(error)
                    else resolve(result)
                })
            })
            await fs.promises.writeFile(compPath, buf)
        }
        promises.push(func())
    }
    await Promise.all(promises)
}

async function watch(ctx: esbuild.BuildContext) {
    await ctx.watch()
}
async function build(ctx: esbuild.BuildContext) {
    await ctx.rebuild()
    process.exit()
}

const gzipCompression: boolean = false

async function run() {
    const distDir = '../dist'
    try {
        const files = await fs.promises.readdir(distDir)
        for (const file of files) {
            await fs.promises.rm(distDir + '/' + file, { recursive: true })
        }
    } catch (e) {
        console.log(e)
    }
    await fs.promises.mkdir(distDir, { recursive: true })

    const outIndexPath = `${distDir}/index.html`

    const socketioPath = '../lib/socket.io.min.js'
    const socketioCode = await fs.promises.readFile(socketioPath, 'utf8')
    const outJsPath = './crosscode.js'
    const distJsPath = `${distDir}/${outJsPath}`

    let buildI = 0
    const plugin: esbuild.Plugin = {
        name: 'print',
        setup(build) {
            build.onStart(async () => {
                console.log()
                console.log('building...')

                const runtimeModDir = '../../ccloader3/dist/runtime'
                await fs.promises.stat(runtimeModDir)
                const zip = new AdmZip()
                zip.addLocalFolder(runtimeModDir)
                const buf = await zip.toBufferPromise()
                const dataBase64 = buf.toString('base64')
                const json = { data: dataBase64 }
                fs.promises.writeFile('../tmp/runtime.json', JSON.stringify(json))
            })
            build.onEnd(async res => {
                const code = res.outputFiles![0]?.text
                if (!code) return

                let html = await fs.promises.readFile('./index.html', 'utf8')
                html = await handleCssImageReplacement(html)

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
                    return appendJs(text)
                    // console.log('writing', text.slice(0, 100))
                }

                const socketioOutPath = './socket.io.js'
                await appendHtml(`<script src="${socketioOutPath}"></script>\n`)
                await writeDistFile(`${distDir}/${socketioOutPath}`, socketioCode)

                appendHtml(html.slice(html.indexOf(socketioTag) + socketioTag.length, html.indexOf(jsTag)))

                await appendHtml(`<script type="module" src="./crosscode.js">`)
                await fs.promises.writeFile(distJsPath, '')

                async function put(index: number) {
                    const str = code.slice(i, index)
                    await appendCode(str)
                    i = index
                }
                await put(code.length)

                await appendHtml(`</script>\n`)

                await appendHtml(html.slice(html.indexOf(jsTag) + jsTag.length))

                if (buildI == 0) {
                    // await writeVfsToDir(distDir, vfsData, dataRef)
                    await writeDistFile(`${distDir}/favicon.png`, await fs.promises.readFile(favIconPath))
                }
                if (gzipCompression) {
                    await writeDistFile(distJsPath, await fs.promises.readFile(distJsPath))
                }

                await fs.promises.cp(
                    '../../ccloader3/dist-ccmod-service-worker.js',
                    `${distDir}/dist-ccmod-service-worker.js`
                )

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
        target: 'es2022',
        format: 'esm',
        write: false,
        minify: false,
        // drop: ['debugger' /*'console'*/],
        sourcemap: 'inline',
        plugins: [plugin],
    })

    if (process.argv[2] == 'build') {
        await build(ctx)
    } else if (process.argv[2] == 'watch') {
        await watch(ctx)
    }
}
await run()
