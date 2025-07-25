import * as esbuild from 'esbuild'
import * as fs from 'fs'
import * as zlib from 'zlib'
import AdmZip from 'adm-zip'

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

                await Promise.all([
                    writeDistFile(outIndexPath, await fs.promises.readFile('./index.html')),
                    writeDistFile(`${distDir}/favicon.png`, await fs.promises.readFile('../../favicon.png')),
                    writeDistFile(
                        `${distDir}/socket.io.js`,
                        await fs.promises.readFile('../lib/socket.io.min.js', 'utf8')
                    ),
                    writeDistFile(`${distDir}/crosscode.js`, code),
                    writeDistFile(
                        `${distDir}/dist-ccmod-service-worker.js`,
                        await fs.promises.readFile('../../ccloader3/dist-ccmod-service-worker.js')
                    ),
                ])

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
        sourcemap: 'inline',
        // drop: ['debugger' /*'console'*/],
        plugins: [plugin],
    })

    if (process.argv[2] == 'build') {
        await build(ctx)
    } else if (process.argv[2] == 'watch') {
        await watch(ctx)
    }
}
await run()
