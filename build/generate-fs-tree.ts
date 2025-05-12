import type {} from 'ultimate-crosscode-typedefs'
import type { DataRef, NodeDir, NodeFile, NodeRef, VfsNode, VfsTree } from '../src/vfs'
import { forEachNode, isDir, isFile, isRef, resolvePath } from '../src/vfs'
import * as fs from 'fs'
import * as gzip from '../src/compress'
import 'core-js/actual/typed-array/to-base64'
import stripJsonComments from '../../assets/mods/simplify/lib/strip-json-comments'
import * as patchSteps from '../../assets/mods/simplify/lib/patch-steps-lib/src/patchsteps'
import * as modloader from '../src/mods'

function assert(v: any, msg?: string): asserts v {
    if (!v) throw new Error(`Assertion error${msg ? `: ${msg}` : ''}`)
}

const pvfsDir = './vfsData'
const ptree = `${pvfsDir}/fttree.json`
const pdataRef = `${pvfsDir}/fttreeDataRef_@ID.json`
const proot = `../..`
const passets = `${proot}/assets`

type FlatDataRef = { c: string | Uint8Array; nodes: NodeRef[] }

async function loadMods() {
    global.window = global as any
    await modloader.init(true)

    async function registerCustomPatchSteps() {
        async function alybox() {
            global.window.ccmod = {
                patchStepsLib: patchSteps,
            } as any
            global.ccmod = window.ccmod

            await import('../../assets/mods/cc-alybox/src/logic-steps.js')
        }
        await alybox()
    }
    await registerCustomPatchSteps()

    return {
        modIds: new Set(modloader.mods.map(mod => mod.baseDirectory.substring('mods/'.length))),
    }
}

async function buildTree(modIds: Set<string>) {
    function filterFile(name: string) {
        if (name.endsWith('.ts')) return false
        if (name.endsWith('.js')) return false
        if (name.endsWith('.html')) return false
        if (name.endsWith('.css')) return false
        if (name.endsWith('.php')) return false
        if (name.endsWith('.kra')) return false
        if (name.endsWith('~')) return false
        if (name.endsWith('.yml')) return false
        if (name.endsWith('.yaml')) return false
        if (name.endsWith('.md')) return false
        if (name.endsWith('.sh')) return false
        if (name.endsWith('.ccmod')) return false
        if (name.endsWith('.bkp')) return false
        if (name == '.npmrc') return false
        if (name == '.prettierrc.json') return false
        if (name == '.gitignore') return false
        if (name == 'LICENSE') return false
        if (name == '.eslintignore') return false
        if (name == '.eslintrc.js') return false
        if (name.startsWith('fttree')) return false
        if (name == 'tsconfig.json') return false

        // if (name.endsWith('.ogg')) return false
        // if (name.endsWith('.png')) return false
        // if (name.endsWith('.json')) return false
        return true
    }
    function filterDir(name: string, path: string) {
        if (name == 'node_modules') return false
        if (name == '.git') return false
        if (name == 'GameData') return false
        if (name.startsWith('greenworks')) return false
        if (name == 'fonts') return false
        if (path.endsWith('mods') && !modIds.has(name)) return false

        return true
    }

    function isTextFile(name: string) {
        return name.endsWith('.txt') || name.endsWith('.json') || name.endsWith('.json.patch')
    }
    const tree: VfsTree = {}

    async function walk(path: string, node: VfsTree, depth: number): Promise<boolean> {
        assert(depth <= 100, `Max depth reached! ${path}`)
        const files = await fs.promises.readdir(path, { withFileTypes: true })
        let fileCount = 0
        for (let file of files) {
            const npath = `${path}/${file.name}`

            let fileInfo: fs.Dirent | fs.Stats = file
            if (file.isSymbolicLink()) {
                const linkRealPath = await fs.promises.readlink(npath)
                fileInfo = await fs.promises.stat(linkRealPath)
            }

            if (fileInfo.isFile()) {
                if (filterFile(file.name)) {
                    const encoding = isTextFile(file.name) ? 'utf8' : undefined
                    const data: Uint8Array | string = await fs.promises.readFile(npath, encoding)

                    node[file.name] = {
                        t: 'f',
                        c: data as any,
                    }

                    fileCount++
                }
            } else if (fileInfo.isDirectory() && filterDir(file.name, path)) {
                const nnode: VfsNode = node[file.name] ?? ({ t: 'd' } as any)
                if (await walk(npath, nnode as VfsTree, depth + 1)) {
                    fileCount++
                    node[file.name] = nnode
                }
            }
        }
        return fileCount > 0
    }
    await walk(passets, tree, 0)

    return { tree }
}

function changeFileNodeToRef(node: NodeFile, flatDataRef: FlatDataRef[], overrideRef?: number): NodeRef {
    const data = node.c
    // @ts-expect-error
    delete node.c

    const node1 = node as VfsNode
    node1.t = 'r'
    assert(isRef(node1))
    node1.fi = 0

    if (overrideRef !== undefined) {
        node1.i = overrideRef
    } else {
        node1.i = flatDataRef.length
        flatDataRef.push({ c: data, nodes: [node1] })
    }
    return node1
}

async function handleModAssets(tree: VfsTree, flatDataRef: FlatDataRef[]) {
    function aliasAsset(node: NodeRef, path: string, toPath: string, print: boolean) {
        const sp = toPath.split('/')
        const lastName = sp[sp.length - 1]

        let obj = tree
        for (let i = 0; i < sp.length - 1; i++) {
            let next = obj[sp[i]]
            if (!next) {
                next = obj[sp[i]] = { t: 'd' } as NodeDir
            } else if (next.t != 'd') throw new Error(`vfs: No such directory: ${path}`)
            obj = next
        }
        const node1 = obj[lastName]
        if (node1) {
            if (isDir(node1)) throw new Error(`vfs: mkdir: cannot replace dir with mod asset`)
            if (isFile(node1)) {
                if (print) console.log('replacing game asset', toPath, 'with', path)
            } else if (isRef(node1)) {
                if (print) console.warn('mod asset conflict at', toPath, ', taking the last one:', path)
            } else assert(false, 'vfs: not implemented')
        } else {
            if (print) console.log('adding mod asset', toPath, 'from', path)
        }
        obj[lastName] = node
    }

    const promises: Promise<void>[] = []
    await forEachNode(tree, async (node, fileName, path) => {
        if (node.t != 'f') return

        const isPatchExt = fileName.endsWith('.json.patch') || fileName.endsWith('.patch.json')
        const isJson = fileName.endsWith('.json') || isPatchExt

        const underModAssets = path.substring(passets.length).includes('assets')
        const underExtensions = path.includes('extension')
        const underPatches = path.includes('patches')

        if (isJson && underModAssets) {
            assert(typeof node.c == 'string')
            node.c = stripJsonComments(node.c, { trailingCommas: true })
        }

        // console.log(path)

        if ((underPatches && fileName.endsWith('.json')) || (underModAssets && isPatchExt)) {
            let toPath: string = path
            let modName: string
            if (underPatches) {
                modName = toPath.substring('mods/'.length + 1, toPath.indexOf('patches') - 1)
                toPath = toPath.substring(toPath.indexOf('patches') + 'patches/'.length)
            } else {
                modName = toPath.substring('mods/'.length + 1, toPath.indexOf('assets') - 1)
                toPath = toPath.substring(toPath.indexOf('assets') + 'assets/'.length)
            }

            if (fileName.endsWith('.json.patch')) toPath = toPath.slice(0, -'.json.patch'.length)
            else if (fileName.endsWith('.patch.json')) toPath = toPath.slice(0, -'.patch.json'.length)
            else if (fileName.endsWith('.json')) toPath = toPath.slice(0, -'.json'.length)
            else assert(false)
            toPath += '.json'

            function getDataHoldingObj(node: VfsNode) {
                if (isFile(node)) return node
                else if (isRef(node)) return flatDataRef[node.i]
                assert(false)
            }
            const patchDataNode = getDataHoldingObj(node)
            let sourceNode: VfsNode
            try {
                sourceNode = resolvePath(toPath, tree)
            } catch (e) {
                /* source file doesn't exist, this can happen when a mod 
                  tries to patch another mod asset that isn't loaded */
                return
            }
            const sourceDataNode = getDataHoldingObj(sourceNode)

            assert(typeof patchDataNode.c == 'string')
            assert(typeof sourceDataNode.c == 'string')
            const patchJson = JSON.parse(patchDataNode.c)
            const sourceJson = JSON.parse(sourceDataNode.c)

            // console.log('patching ', path, 'into', toPath)
            await patchSteps.patch(
                sourceJson,
                patchJson,
                async (fromGame: boolean, url: string) => {
                    if (!fromGame) {
                        const origUrl = url
                        url = 'mods/' + modName
                        if (!url.startsWith('/')) url += '/'
                        url += origUrl
                    }
                    const node = getDataHoldingObj(resolvePath(url, tree))
                    assert(typeof node.c == 'string')
                    const data = JSON.parse(node.c)
                    // console.log('getting data', url, !!data)
                    return data
                },
                undefined
            )
            const patchedData = JSON.stringify(sourceJson)
            sourceDataNode.c = patchedData
        } else if (underModAssets || underExtensions) {
            const nodeRef = changeFileNodeToRef(node, flatDataRef)
            let toPath: string
            if (underModAssets) {
                toPath = path.substring(path.lastIndexOf('assets') + 'assets/'.length)
            } else if (underExtensions) {
                toPath = path.substring(path.indexOf('extension') + 'extension/'.length)
                toPath = toPath.substring(toPath.indexOf('/') + 1)
                if (!toPath.includes('/')) return
            } else assert(false)
            aliasAsset(nodeRef, path, toPath, false && underModAssets)
        }
    })

    await Promise.all(promises)
}

async function compressNodes(tree: VfsTree, flatDataRef: FlatDataRef[]) {
    async function compress(data: Uint8Array | string): Promise<string> {
        const compressedArr = await gzip.compress(data)
        const compressed = Buffer.from(compressedArr).toString('base64')
        return compressed
    }

    const toCompress: { c: string | Uint8Array }[] = [...flatDataRef]
    await forEachNode(tree, node => {
        if (node.t != 'f') return
        toCompress.push(node)
    })
    await Promise.all(
        toCompress.map(async obj => {
            const compressed = await compress(obj.c)
            obj.c = compressed
        })
    )
}

async function filterOggs(tree: VfsTree, flatDataRef: FlatDataRef[]) {
    const oggList: NodeFile[] = []
    await forEachNode(tree, (node, fileName) => {
        if (isFile(node) && fileName.endsWith('.ogg')) {
            oggList.push(node)
        }
    })
    // sort from smallest to biggest
    oggList.sort((a, b) => a.c.length - b.c.length)

    let oggTotalBytes = 0
    const oggByteLimit = 1024 * 1024 * 1000 // 0 MiB
    let i = 0
    let oggTotalBytesWhenLimitHit: number | undefined
    for (; i < oggList.length; i++) {
        oggTotalBytes += oggList[i].c.length
        if (oggTotalBytes >= oggByteLimit) oggTotalBytesWhenLimitHit ??= oggTotalBytes
        changeFileNodeToRef(oggList[i], flatDataRef, oggTotalBytes < oggByteLimit ? undefined : 0)
    }
    if (oggTotalBytesWhenLimitHit === undefined) oggTotalBytesWhenLimitHit = oggTotalBytes
    console.log(
        '   ogg:',
        (oggTotalBytesWhenLimitHit / 1024 / 1024).toFixed(2),
        'MB written,',
        ((oggTotalBytes - oggTotalBytesWhenLimitHit) / 1024 / 1024).toFixed(2),
        'MB left'
    )
}

async function changeAllFilesToRef(tree: VfsTree, flatDataRef: FlatDataRef[]) {
    forEachNode(tree, (node, _fileName) => {
        if (isFile(node)) {
            changeFileNodeToRef(node, flatDataRef)
        }
    })
}

async function partitionDataRef(flatDataRef: FlatDataRef[]) {
    const dataRef: DataRef = [[]]
    const fileSizeLimit = 1024 * 1024 * 50 // 50 MiB
    let size = 0
    for (const obj of flatDataRef) {
        assert(typeof obj.c == 'string')
        const fi = dataRef.length - 1
        for (const node of obj.nodes) {
            node.fi = fi
            node.i = dataRef[fi].length
        }
        dataRef[fi].push(obj.c)
        size += obj.c.length
        if (size > fileSizeLimit) {
            dataRef.push([])
            size = 0
        }
    }

    return { dataRef }
}

async function write(tree: VfsTree, dataRef: DataRef) {
    await fs.promises.mkdir(pvfsDir, { recursive: true })
    await Promise.all([
        fs.promises.writeFile(ptree, JSON.stringify(tree)),
        dataRef.map((arr, i) => fs.promises.writeFile(pdataRef.replace(/@ID/, i.toString()), JSON.stringify(arr))),
    ])
}

async function run() {
    console.log('loading mods...')
    const { modIds } = await loadMods()

    console.log('building tree...')
    const { tree } = await buildTree(modIds)

    const flatDataRef: FlatDataRef[] = []
    tree['empty.ogg'] = { t: 'r', fi: 0, i: 0 }
    flatDataRef.push({ c: await fs.promises.readFile('./empty.ogg'), nodes: [tree['empty.ogg']] })

    console.log('handling mod assets...')
    await handleModAssets(tree, flatDataRef)
    console.log('compressing files...')
    await compressNodes(tree, flatDataRef)
    console.log("filtering ogg's...")
    await filterOggs(tree, flatDataRef)
    console.log('changing all files to references...')
    await changeAllFilesToRef(tree, flatDataRef)
    console.log('partitioning dataRef...')
    const { dataRef } = await partitionDataRef(flatDataRef)
    console.log('writing...')
    await write(tree, dataRef)
    console.log('done')
}
run()
