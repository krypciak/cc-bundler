import { updateUI, updateUploadStatusLabel } from './ui'
import { path as paths } from './nwjs-fix'
import { fs } from './fs-proxy'
import { type Unzipped, unzipSync } from 'fflate/browser'

interface FileEntry {
    path: string
    uint8Array(): Promise<Uint8Array>
}

function fileEntryFromFile(file: File, addPrefix = ''): FileEntry {
    return {
        path: addPrefix + file.webkitRelativePath,
        async uint8Array() {
            try {
                return getUint8ArrayFromFile(file)
            } catch (e) {
                console.error(e)
                return new Uint8Array()
            }
        },
    }
}

function getParentDirs(files: FileEntry[]): string[] {
    const dirs = new Set<string>()

    for (const { path } of files) {
        const parent = '/' + paths.dirname(path)
        dirs.add(parent)
    }

    return [...dirs]
}

async function filesToCopy(filesUnfiltered: FileEntry[]) {
    const files = filesUnfiltered.filter(
        ({ path }) =>
            (path.startsWith('assets') || path.startsWith('dist/runtime')) && !path.startsWith('assets/modules')
    )

    const fileParentDirs: Record<string, FileEntry[]> = {}
    for (const file of files) {
        const parent = '/' + paths.dirname(file.path)

        ;(fileParentDirs[parent] ??= []).push(file)
    }

    interface TreeNode {
        dirs: Record<string, TreeNode>
        files?: FileEntry[]
    }

    const createTree = () => {
        function emptyNode(): TreeNode {
            return { dirs: {} }
        }
        const tree: TreeNode = emptyNode()

        const label = 'creating tree'
        const entries = Object.entries(fileParentDirs)
        updateUploadStatusLabel(label, 0, entries.length)
        let i = 0
        for (const [dirPath, files] of entries) {
            const sp = dirPath.split('/')
            let currentNode: TreeNode = tree
            for (let i = 1; i < sp.length; i++) {
                const dir = sp[i]
                currentNode = currentNode.dirs[dir] ??= emptyNode()
            }
            currentNode.files = files

            updateUploadStatusLabel(label, ++i, entries.length)
        }
        return tree
    }
    const tree = createTree()

    async function treeForEach(tree: TreeNode, func: (path: string, node: TreeNode) => Promise<boolean>, path = '/') {
        if (await func(path, tree)) {
            await Promise.all(Object.entries(tree.dirs).map(([dir, node]) => treeForEach(node, func, path + '/' + dir)))
        }
    }

    const toCopyFiles: FileEntry[] = []

    let filesTotal = 0
    let filesChecked = 0
    await treeForEach(tree, async (path, node) => {
        const label = 'filtering out existing files'
        updateUploadStatusLabel(label, filesChecked, ++filesTotal)
        const exists = await fs.promises.exists(path)
        updateUploadStatusLabel(label, ++filesChecked, filesTotal)

        if (!exists) {
            await treeForEach(node, async (_path, node) => {
                if (node.files) {
                    toCopyFiles.push(...node.files)
                }
                return true
            })
            return false
        } else {
            if (node.files) {
                filesTotal += node.files.length
                for (const file of node.files) {
                    const exists = await fs.promises.exists(file.path)
                    if (!exists) {
                        toCopyFiles.push(file)
                    }

                    filesChecked++
                    updateUploadStatusLabel(label, filesChecked, filesTotal)
                }
            }

            return true
        }
    })

    toCopyFiles.sort((a, b) => a.path.length - b.path.length)

    return toCopyFiles
}

async function mkdirs(dirs: string[]) {
    dirs.sort((a, b) => a.length - b.length)
    const label = 'creating directories'
    updateUploadStatusLabel(label, 0, dirs.length)

    for (let i = 0; i < dirs.length; i++) {
        const dir = dirs[i]
        await fs.promises.mkdir(dir, { recursive: true })
        updateUploadStatusLabel(label, i, dirs.length)
    }
    updateUploadStatusLabel(label, dirs.length, dirs.length)
}

async function copyFiles(toCopyFiles: FileEntry[], fetchRateLimit: boolean) {
    const dirs = getParentDirs(toCopyFiles)
    await mkdirs(dirs)

    updateUploadStatusLabel('copying', 0, toCopyFiles.length)

    const waitResolves: (() => void)[] = []
    const waitPromises = toCopyFiles.map(
        (_, i) =>
            new Promise<void>(resolve => {
                waitResolves[i] = resolve
            })
    )

    let filesCopied = 0
    const copyPromises = Promise.all(
        toCopyFiles.map(async (file, i) => {
            await waitPromises[i]
            const buffer = await file.uint8Array()

            await fs.promises.writeFile(file.path, buffer)
            updateUploadStatusLabel('copying', ++filesCopied, toCopyFiles.length)

            runNext(i)
        })
    )

    const runNext = (i: number) => {
        const next = waitResolves[i + atOnce]
        next?.()
    }

    const atOnce = fetchRateLimit ? 100 : 1000

    for (let i = 0; i < Math.min(atOnce, toCopyFiles.length); i++) {
        waitResolves[i]()
    }

    await copyPromises

    updateUploadStatusLabel('done, uploaded', toCopyFiles.length)
}

async function zipToFileEntryList(zipData: Uint8Array, addPrefix = ''): Promise<FileEntry[]> {
    updateUploadStatusLabel('uncompressing zip')
    const unzipped: Unzipped = unzipSync(zipData)
    return Object.entries(unzipped)
        .map(([path, data]) => ({
            path: addPrefix + path,
            async uint8Array() {
                return data
            },
        }))
        .filter(({ path }) => !path.endsWith('/'))
}

import runtimeModJson from '../tmp/runtime.json'
import { getUint8ArrayFromFile } from './opfs'

async function loadRuntimeModData(): Promise<Uint8Array> {
    return Uint8Array.from(atob(runtimeModJson.data), c => c.charCodeAt(0))
}

async function getRuntimeModFiles(): Promise<FileEntry[]> {
    const data = await loadRuntimeModData()
    const runtimeModFiles = await zipToFileEntryList(data, 'dist/runtime/')
    return runtimeModFiles
}

export async function uploadCrossCode(filesRaw: FileList) {
    updateUploadStatusLabel('preparing', 0, filesRaw!.length)
    let files = [...filesRaw].map(file => fileEntryFromFile(file))
    let fetchRateLimit = true

    if (files.length == 1 && filesRaw[0].name.endsWith('.zip')) {
        updateUploadStatusLabel('fetching zip')
        const zipData = await files[0].uint8Array()
        files = await zipToFileEntryList(zipData)
        fetchRateLimit = false
    }

    function findCrossCode(files: FileEntry[]): boolean {
        const root = files[0].path.startsWith('assets/')
            ? ''
            : files[0].path.substring(0, files[0].path.indexOf('/') + 1)

        const hasDatabase = files.find(file => {
            return file.path.substring(root.length) == 'assets/data/database.json'
        })
        if (!hasDatabase) return false

        for (const file of files) {
            file.path = file.path.substring(root.length)
        }

        return true
    }

    if (!findCrossCode(files)) {
        updateUploadStatusLabel('crosscode not detected!')
        return
    }

    files.push(...(await getRuntimeModFiles()))

    const toCopyFiles = await filesToCopy(files)
    await copyFiles(toCopyFiles, fetchRateLimit)

    updateUI()
}
