import { updateUI, updateUploadStatusLabel } from './ui'
import paths from 'path-browserify'
import { fs } from './fs-proxy'
import { type Unzipped, unzipSync } from 'fflate/browser'

function getParentDirs(files: [string, File][]): string[] {
    const dirs = new Set<string>()

    for (const [path] of files) {
        const parent = '/' + paths.dirname(path)
        dirs.add(parent)
    }

    return [...dirs]
}

async function filesToCopy(files: File[], root: string) {
    const assetsFiles = files
        .map(file => [file.webkitRelativePath.substring(root.length), file] as [string, File])
        .filter(([path]) => path.startsWith('assets') && !path.startsWith('assets/modules'))

    const fileParentDirs: Record<string, [string, File][]> = {}
    for (const [path, file] of assetsFiles) {
        const parent = '/' + paths.dirname(path)

        ;(fileParentDirs[parent] ??= []).push([path, file])
    }

    interface TreeNode {
        dirs: Record<string, TreeNode>
        files?: [string, File][]
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
            for (let i = 2; i < sp.length; i++) {
                const dir = sp[i]
                currentNode = currentNode.dirs[dir] ??= emptyNode()
            }
            currentNode.files = files

            updateUploadStatusLabel(label, ++i, entries.length)
        }
        return tree
    }
    const tree = createTree()

    async function treeForEach(
        tree: TreeNode,
        func: (path: string, node: TreeNode) => Promise<boolean>,
        path = '/assets'
    ) {
        if (await func(path, tree)) {
            await Promise.all(Object.entries(tree.dirs).map(([dir, node]) => treeForEach(node, func, path + '/' + dir)))
        }
    }

    const toCopyFiles: [string, File][] = []

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
                for (const [path, file] of node.files) {
                    const exists = await fs.promises.exists(path)
                    if (!exists) {
                        toCopyFiles.push([path, file])
                    }

                    filesChecked++
                    updateUploadStatusLabel(label, filesChecked, filesTotal)
                }
            }

            return true
        }
    })

    toCopyFiles.sort((a, b) => a[0].length - b[0].length)

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

async function getUint8Array(file: File): Promise<Uint8Array> {
    if ('data' in file) return file.data as Uint8Array

    try {
        if (file.bytes) {
            return await file.bytes()
        } else {
            return new Uint8Array(await file.arrayBuffer())
        }
    } catch (e) {
        console.error(e)
        return new Uint8Array()
    }
}

async function copyFiles(toCopyFiles: [string, File][]) {
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
        toCopyFiles.map(async ([path, file], i) => {
            await waitPromises[i]
            const buffer = await getUint8Array(file)

            try {
                await fs.promises.writeFile(path, buffer)
            } catch (e) {
                console.error('error while writing file:', path, e)
                return
            }
            updateUploadStatusLabel('copying', ++filesCopied, toCopyFiles.length)

            runNext(i)
        })
    )

    const runNext = (i: number) => {
        const next = waitResolves[i + atOnce]
        next?.()
    }

    const atOnce = 100

    for (let i = 0; i < Math.min(atOnce, toCopyFiles.length); i++) {
        waitResolves[i]()
    }

    await copyPromises

    updateUploadStatusLabel('done, uploaded', toCopyFiles.length)
}

export async function uploadCrossCode(filesRaw: FileList) {
    updateUploadStatusLabel('preparing', 0, filesRaw!.length)
    let files = [...filesRaw]

    if (files.length == 1 && files[0].name.endsWith('.zip')) {
        updateUploadStatusLabel('fetching zip')
        const zipData = await getUint8Array(files[0])
        updateUploadStatusLabel('uncompressing zip')
        const unzipped: Unzipped = unzipSync(zipData)
        files = Object.entries(unzipped).map(
            ([path, data]) =>
                ({
                    webkitRelativePath: path,
                    data,
                }) as unknown as File
        )
    }

    function findCrossCode(files: File[]) {
        const root = files[0].webkitRelativePath.startsWith('assets/')
            ? ''
            : files[0].webkitRelativePath.substring(0, files[0].webkitRelativePath.indexOf('/') + 1)

        const hasDatabase = files.find(file => {
            return file.webkitRelativePath.substring(root.length) == 'assets/data/database.json'
        })
        if (!hasDatabase) return

        return root
    }

    const root = findCrossCode(files)
    if (root === undefined) {
        updateUploadStatusLabel('crosscode not detected!')
        return
    }

    const toCopyFiles = await filesToCopy(files, root)
    await copyFiles(toCopyFiles)

    updateUI()
}
