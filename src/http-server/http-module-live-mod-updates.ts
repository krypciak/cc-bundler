import type { IncomingMessage, ServerResponse } from 'http'
import { spawn } from 'child_process'
import { zip } from 'fflate'
import type { AsyncZippable } from 'fflate'
import * as fs from 'fs'
import type { HandleFunction } from './http-module-mod-proxy'

interface LiveModConfig {
    id: string
    repoPath: string
    buildCmd: string
    buildArguments: string[]
}

function concatBuffersIntoUint8Array(arrays: Buffer[]): Uint8Array {
    const totalLength = arrays.reduce((acc, curr) => acc + curr.length, 0)
    const result = new Uint8Array(totalLength)

    let offset = 0
    for (const arr of arrays) {
        result.set(arr, offset)
        offset += arr.length
    }

    return result
}

async function buildPluginJs(mod: LiveModConfig): Promise<Uint8Array> {
    const process = spawn(mod.buildCmd, mod.buildArguments, { cwd: mod.repoPath })

    const buffers: Buffer[] = []
    process.stdout.on('data', data => buffers.push(data))

    process.stderr.on('data', data => {
        console.error(`buildMod ${mod.id} stderr: ${data}`)
    })

    await new Promise<void>((resolve, reject) => {
        process.on('close', code => {
            if (code === 0) {
                resolve()
            } else {
                reject()
                console.log(`child process exited with code ${code}`)
            }
        })
    })

    return concatBuffersIntoUint8Array(buffers)
}

async function buildMod(mod: LiveModConfig): Promise<Uint8Array> {
    type AssetEntry = { path: string; data: Buffer }

    const [pluginJs, iconData, licenseData, ccmodData, assetsFiles] = await Promise.all([
        buildPluginJs(mod),
        fs.promises.readFile(`${mod.repoPath}/icon/icon.png`),
        fs.promises.readFile(`${mod.repoPath}/LICENSE`),
        fs.promises.readFile(`${mod.repoPath}/ccmod.json`),
        new Promise<AssetEntry[]>(async resolve => {
            const assets: fs.Dirent[] = (
                await fs.promises
                    .readdir(`${mod.repoPath}/assets`, { recursive: true, withFileTypes: true })
                    .catch(_e => {
                        resolve([])
                        return [] as fs.Dirent[]
                    })
            ).filter(dirent => dirent.isFile())

            const files = await Promise.all(
                assets.map(async dirent => {
                    const path = `${dirent.parentPath}/${dirent.name}`

                    const assetPath = `${path.substring(path.lastIndexOf('assets/') + 'assets/'.length)}`
                    return { path: assetPath, data: await fs.promises.readFile(path) }
                })
            )
            resolve(files)
        }),
    ])

    function buildTreeRecursive(entries: AssetEntry[], currentPath: string = ''): AsyncZippable {
        const tree: AsyncZippable = {}

        const baseDirs: Record<string, AssetEntry[]> = {}

        for (const entry of entries) {
            const path = entry.path.substring(currentPath.length)
            const slashIndex = path.indexOf('/')
            if (slashIndex == -1) {
                tree[path] = entry.data
            } else {
                const baseDir = path.substring(0, slashIndex)
                ;(baseDirs[baseDir] ??= []).push(entry)
            }
        }

        for (const dir in baseDirs) {
            tree[dir] = buildTreeRecursive(baseDirs[dir], currentPath + '/' + dir)
        }

        return tree
    }
    const assetsTree = buildTreeRecursive(assetsFiles)

    const zipTree: AsyncZippable = {
        'plugin.js': pluginJs,
        icon: { 'icon.png': iconData },
        LICENSE: licenseData,
        'ccmod.json': ccmodData,
        assets: assetsTree,
    }

    return new Promise<Uint8Array>((resolve, reject) => {
        zip(zipTree, {}, (err, data) => {
            if (err) reject(err)
            else resolve(data)
        })
    })
}

const buildCache: Map<LiveModConfig, Uint8Array> = new Map()

async function watchMod(mod: LiveModConfig) {
    const pluginJsPath = `${mod.repoPath}/plugin.js`
    const watcher = fs.promises.watch(pluginJsPath, {
        persistent: false,
    })
    for await (const event of watcher) {
        if (event.eventType == 'change') {
            buildCache.delete(mod)
        }
    }
}

async function requestMod(mod: LiveModConfig): Promise<Uint8Array> {
    if (buildCache.has(mod)) return buildCache.get(mod)!

    const data = await buildMod(mod)
    buildCache.set(mod, data)

    return data
}

let mods: Record<string, LiveModConfig> = {}

export function setModConfigs(entries: LiveModConfig[]) {
    mods = Object.fromEntries(entries.map(entry => [entry.id, entry]))
}

export function startWatchingMods() {
    for (const mod of Object.values(mods)) {
        watchMod(mod)
    }
}

async function sha256(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const result = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return result
}

export const handleFunction: HandleFunction = async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? ''

    try {
        if (url.startsWith('/liveModUpdate')) {
            const matches = url.match(/\?id=(.+)/)
            const modId = decodeURI(matches?.[1] ?? '')

            const mod = mods[modId]
            if (!mod) {
                res.writeHead(404, {})
                res.end()

                return
            }

            const data = await requestMod(mod)
            const etag = await sha256(data)

            res.writeHead(200, {
                'Content-Type': 'application/zip',
                Etag: etag,
            })
            res.write(data)
            res.end()
        } else {
            res.emit('next')
        }
    } catch (e) {
        console.error(e)
        res.emit('next')
    }
}
