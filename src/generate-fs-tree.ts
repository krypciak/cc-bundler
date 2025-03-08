import * as fs from 'fs'
import * as gzip from './compress.ts'
import type * as vfs from './vfs.ts'

const ptree = `./vfsData/fttree.json`
const pdataRef = `./vfsData/fttreeDataRef_@ID.json`
const proot = `../..`
const passets = `${proot}/assets`
let tree: vfs.VfsTree = {}

const dataRef: vfs.DataRef = [[]]
const dataRefLens: number[] = [0]
const oggList: {
    data: string
    node: vfs.NodeRef
}[] = []

const fileExists = async (path: string) => !!(await fs.promises.stat(path).catch(_ => false))

;(async () => {
    const emptyOgg = Buffer.from(
        await gzip.compress(await fs.promises.readFile('./empty.ogg'))
    ).toString('base64')
    dataRef[0].push(emptyOgg)
    dataRefLens[0] += emptyOgg.length

    if (false && (await fileExists(ptree))) {
        // tree = JSON.parse(await fs.promises.readFile(ptreeCache, 'utf8'))
    } else {
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
        function filterDir(name: string) {
            if (name == 'node_modules') return false
            if (name == '.git') return false
            if (name == 'GameData') return false
            if (name == 'cache') return false
            if (name.startsWith('greenworks')) return false
            if (name == 'fonts') return false
            return true
        }

        async function walk(path: string, node: vfs.VfsTree, depth: number): Promise<boolean> {
            if (depth >= 100) throw new Error(`Max depth reached! ${path}`)
            const files = await fs.promises.readdir(path, { withFileTypes: true })
            let fileCount = 0
            for (const file of files) {
                const npath = `${path}/${file.name}`
                if (file.isFile() && filterFile(file.name)) {
                    console.log(npath)
                    let data: string | Buffer
                    if (npath.endsWith('.txt') || npath.endsWith('.json')) {
                        data = await fs.promises.readFile(npath, 'utf8')
                    } else {
                        data = await fs.promises.readFile(npath)
                    }

                    const compressedArr = await gzip.compress(data)
                    const compressed = Buffer.from(compressedArr).toString('base64')

                    if (npath.endsWith('.ogg')) {
                        node[file.name] = { t: 'r', fi: 0, i: 0 }
                        oggList.push({
                            data: compressed,
                            node: node[file.name] as vfs.NodeRef,
                        })
                    } else {
                        node[file.name] = {
                            t: 'f',
                            c: compressed,
                        }
                    }
                    fileCount++
                } else if (
                    file.isDirectory() &&
                    filterDir(file.name) /*|| file.isSymbolicLink()*/
                ) {
                    const nnode: vfs.VfsNode = { t: 'd' } as any
                    if (await walk(npath, nnode as vfs.VfsTree, depth + 1)) {
                        fileCount++
                        node[file.name] = nnode
                    }
                }
            }
            return fileCount > 0
        }
        await walk(passets, tree, 0)

        // const addToDataRef = () => {
        //     const fi = dataRef.length - 1
        //     node[file.name] = {
        //         t: 'f',
        //         c: emptyOgg,
        //     }
        //     node[file.name] = {
        //         t: 'r',
        //         fi,
        //         i: dataRef[fi].length,
        //     }
        //     dataRef[fi].push(compressed)
        //     dataRefLens[fi] += compressed.length
        //
        //     if (dataRefLens[fi] > 50000000) {
        //         dataRef.push([])
        //         dataRefLens.push(0)
        //     }
        // }

        // sort from smallest to biggest
        oggList.sort((a, b) => a.data.length - b.data.length)
        let oggTotalBytes = 0
        const oggByteLimit = 1024 * 1024 * 100 // 100 MiB
        const fileSizeLimit = 1024 * 1024 * 50 // 50 MiB
        for (const { data, node } of oggList) {
            const fi = dataRef.length - 1
            node.fi = fi
            node.i = dataRef[fi].length

            dataRef[fi].push(data)
            dataRefLens[fi] += data.length

            oggTotalBytes += data.length
            if (oggTotalBytes >= oggByteLimit) break

            if (dataRefLens[fi] > fileSizeLimit) {
                dataRef.push([])
                dataRefLens.push(0)
            }
        }

        await Promise.all([
            fs.promises.writeFile(ptree, JSON.stringify(tree)),
            dataRef.map((arr, i) =>
                fs.promises.writeFile(pdataRef.replace(/@ID/, i.toString()), JSON.stringify(arr))
            ),
        ])

        // let res = await gzip.compress(str)
        // await fs.promises.writeFile(ptreeCache + '.bin', a)
    }
    console.log('tree gathered')
})()
