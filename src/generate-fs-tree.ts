import * as fs from 'fs'
import * as gzip from './compress.ts'
import type { VfsNode, VfsTree } from './vfs'

const ptreeCache = `./fttree.json`
const proot = `../..`
const passets = `${proot}/assets`
let tree: VfsTree = {}

const fileExists = async (path: string) => !!(await fs.promises.stat(path).catch(_ => false))

;(async () => {
    const emptyOgg = await fs.promises.readFile('./empty.ogg')

    if (false && (await fileExists(ptreeCache))) {
        // tree = JSON.parse(await fs.promises.readFile(ptreeCache, 'utf8'))
    } else {
        function filterFile(name: string) {
            if (name.endsWith('.ts')) return false
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

        async function walk(path: string, node: VfsTree, depth: number): Promise<boolean> {
            if (depth >= 100) throw new Error(`Max depth reached! ${path}`)
            const files = await fs.promises.readdir(path, { withFileTypes: true })
            let fileCount = 0
            for (const file of files) {
                const npath = `${path}/${file.name}`
                if (file.isFile() && filterFile(file.name)) {
                    console.log(npath)
                    let data: string | Buffer
                    if (npath.endsWith('.ogg')) {
                        data = emptyOgg
                    } else if (npath.endsWith('.txt') || npath.endsWith('.json')) {
                        data = await fs.promises.readFile(npath, 'utf8')
                    } else {
                        data = await fs.promises.readFile(npath)
                    }

                    const compressedArr = await gzip.compress(data)
                    const compressed = Buffer.from(compressedArr).toString('base64')
                    node[file.name] = {
                        t: 'f',
                        c: compressed,
                    }
                    fileCount++
                } else if (
                    file.isDirectory() &&
                    filterDir(file.name) /*|| file.isSymbolicLink()*/
                ) {
                    const nnode: VfsNode = { t: 'd' } as any
                    if (await walk(npath, nnode as VfsTree, depth + 1)) {
                        fileCount++
                        node[file.name] = nnode
                    }
                }
            }
            return fileCount > 0
        }
        await walk(passets, tree, 0)

        const str = JSON.stringify(tree)
        await fs.promises.writeFile(ptreeCache, str)

        const res = await gzip.compress(str)
        await fs.promises.writeFile(ptreeCache + '.bin', res)
    }
    console.log('tree gathered')
})()
