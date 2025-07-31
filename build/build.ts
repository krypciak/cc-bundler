import * as esbuild from 'esbuild'
import * as fs from 'fs'
import AdmZip from 'adm-zip'

const commonOptions: esbuild.BuildOptions = {
    format: 'esm',
    platform: 'browser',
    target: 'es2022',

    write: false,
    bundle: true,
    minify: false,
    sourcemap: 'inline',
    // drop: ['debugger' /*'console'*/],
} as const

const isWatch = process.argv[2] === 'watch'
const distDir = '../dist'

function donePlugin(outfile: string): esbuild.Plugin {
    return {
        name: 'done plugin',
        setup(build) {
            build.onEnd(async res => {
                let code = res.outputFiles![0]?.text
                if (!code) return // when compile errors

                version++
                await Promise.all([
                    fs.promises.writeFile(`${distDir}/version`, version.toString()),
                    fs.promises.writeFile(outfile, code),
                ])

                const bytes = code.length
                const kb = bytes / 1024
                console.log(outfile, `${kb.toFixed(1)}kb`)
            })
        },
    }
}

async function copyRuntimeCCMod() {
    const runtimeModDir = '../../ccloader3/dist/runtime'
    await fs.promises.stat(runtimeModDir)
    const zip = new AdmZip()
    zip.addLocalFolder(runtimeModDir)
    zip.writeZipPromise('../dist/runtime.zip')
}

let version: number = 0
try {
    const versionStr = await fs.promises.readFile('../dist/version')
    version = Number(versionStr)
} catch (e) {}

function main(): esbuild.BuildOptions {
    const outfile = `${distDir}/crosscode.js`
    return {
        entryPoints: ['../src/main.ts'],

        ...commonOptions,

        plugins: [
            donePlugin(outfile),
            {
                name: 'copy-files',
                setup(build) {
                    build.onEnd(async () => {
                        await Promise.all([
                            ...(await fs.promises.readdir('./assets')).map(file =>
                                file.endsWith('~') || file.endsWith('.kra')
                                    ? undefined
                                    : fs.promises.cp(`./assets/${file}`, `${distDir}/${file}`)
                            ),
                            fs.promises.cp('../lib/socket.io.min.js', `${distDir}/socket.io.js`),
                            fs.promises.cp('../../ccloader3/main.css', `${distDir}/ccloader3-main.css`),
                            copyRuntimeCCMod(),
                        ])
                    })
                },
            },
        ],
    }
}

function ccmodServiceWorker(): esbuild.BuildOptions {
    return {
        entryPoints: ['../src/service-worker/service-worker.ts'],

        ...commonOptions,

        plugins: [donePlugin(`${distDir}/dist-ccmod-service-worker.js`)],
    }
}

const modules: Array<() => esbuild.BuildOptions> = [main, ccmodServiceWorker]

async function run(): Promise<void> {
    try {
        const files = await fs.promises.readdir(distDir)
        for (const file of files) {
            await fs.promises.rm(distDir + '/' + file, { recursive: true })
        }
    } catch (e) {
        console.log(e)
    }
    await fs.promises.mkdir(distDir, { recursive: true })

    if (isWatch) {
        console.clear()
        await Promise.all(
            modules.map(async module => {
                const ctx = await esbuild.context(module())
                await ctx.watch()
            })
        )
    } else {
        await Promise.all(
            modules.map(async module => {
                await esbuild.build(module())
            })
        )
        process.exit() // because esbuild keeps the process alive for some reason
    }
}
run()
