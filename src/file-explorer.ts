import { AsyncZippable, zip } from 'fflate/browser'
import './file-explorer-types'
import * as fe from './file-explorer-types'
import { buildZipTreeRecursive, throttleTasks } from './fs/fs-misc'
import { isMounted } from './fs/fs-proxy'

import { fs } from './fs/opfs'
import { getUint8Array } from './utils'

declare global {
    const filemanager: HTMLDivElement
}

function getPathFromPaths(paths: fe.Path[]): string {
    return paths.map(f => f[0]).join('/')
}

function getFolderPath(folder: fe.Folder): string {
    return getPathFromPaths(folder.GetPath())
}

function getEntryPath(folder: fe.Folder, entry: { name: string }): string {
    return getFolderPath(folder) + '/' + entry.name
}

function createEntry(name: string, isDir: boolean): fe.Entry {
    return {
        id: name,
        name: name,
        hash: name,
        type: isDir ? 'folder' : 'file',
    }
}

function downloadURI(uri: string, name: string) {
    var link = document.createElement('a')
    link.download = name
    link.href = uri
    link.click()
}

function zipFiles(zipTree: AsyncZippable) {
    return new Promise<Uint8Array>((resolve, reject) => {
        zip(zipTree, {}, (err, data) => {
            if (err) reject(err)
            else resolve(data)
        })
    })
}

let inited = false
export function initFileExplorer() {
    if (!isMounted || inited) return
    inited = true

    new window.FileExplorer(filemanager, {
        initpath: [['', 'CrossCode (/)', {}]],
        // tools: { cut: true },

        async onrefresh(folder, required) {
            // Ignore non-required refresh requests.  By default, folders are refreshed every 5 minutes so the widget has up-to-date information.
            if (!required) return

            const fsPath = getFolderPath(folder)
            const files = await fs.promises.readdir(fsPath, { withFileTypes: true })

            const entires: fe.Entry[] = files.map(f => createEntry(f.name, f.isDirectory()))
            folder.SetEntries(entires)
        },
        async onrename(renamedCb, folder, entry, newname) {
            try {
                const origPath = getEntryPath(folder, entry)
                const newPath = getEntryPath(folder, { name: newname })
                console.log('rename', origPath, 'to', newPath)
                const isDir = (await fs.promises.stat(origPath)).isDirectory()
                await fs.promises.rename(origPath, newPath)
                renamedCb(createEntry(newname, isDir))
            } catch (e) {
                renamedCb(false)
            }
        },
        async onnewfolder(created, folder) {
            try {
                const name = 'New Folder'
                const path = getEntryPath(folder, { name })
                await fs.promises.mkdir(path)

                created(createEntry(name, true))
            } catch (e) {
                created(false)
            }
        },
        async onnewfile(created, folder) {
            try {
                const name = 'New File'
                const path = getEntryPath(folder, { name })
                await fs.promises.writeFile(path, '')

                created(createEntry(name, false))
            } catch (e) {
                created(false)
            }
        },
        async ondelete(deleted, folder, _ids, entries, _recycle) {
            try {
                await Promise.all(
                    entries.map(async entry => {
                        const filePath = getEntryPath(folder, entry)
                        await fs.promises.rm(filePath, { recursive: true })
                    })
                )
                deleted(true)
            } catch (e) {
                deleted(false)
            }
        },
        async oncopy(copied, srcPathRaw, srcIds, destFolder) {
            try {
                const srcPathBase = getPathFromPaths(srcPathRaw)
                const destPathBase = getFolderPath(destFolder)
                for (const fileName of srcIds) {
                    const srcPath = srcPathBase + '/' + fileName
                    const destPath = destPathBase + '/' + fileName
                    if (srcPath == destPath) continue
                    await fs.promises.cp(srcPath, destPath, { recursive: true })
                }
                copied(true)
            } catch (e) {
                copied(false)
            }
        },
        async onopenfile(folder, entry) {
            const filePath = getEntryPath(folder, entry)
            const data = await fs.promises.readFile(filePath, 'utf8')
            alert(data)
        },
        async oninitupload(startupload, fileinfo, _queuestarted) {
            startupload(false)

            this.SetNamedStatusBarText(
                'message',
                this.EscapeHTML(this.FormatStr(this.Translate('Uploading "{0}"...'), fileinfo.fullPath)),
                this.settings.messagetimeout! * 5
            )

            try {
                const data = await getUint8Array(fileinfo.file)
                const path = getEntryPath(fileinfo.folder, { name: fileinfo.file.name })

                await fs.promises.writeFile(path, data.buffer as FileSystemWriteChunkType)

                this.SetNamedStatusBarText(
                    'message',
                    this.EscapeHTML(this.FormatStr(this.Translate('Uploaded "{0}"'), fileinfo.fullPath)),
                    this.settings.messagetimeout! * 5
                )
                this.RefreshFolders(true)
            } catch (e) {
                this.SetNamedStatusBarText(
                    'message',
                    this.EscapeHTML(
                        this.FormatStr(this.Translate('Error uploading "{0}" ({1})'), fileinfo.fullPath, `${e}`)
                    ),
                    this.settings.messagetimeout! * 5
                )
            }
        },
        async oninitdownload(startdownload, folder, _ids, entries) {
            const files = entries.map(entry => ({
                type: entry.type,
                path: getEntryPath(folder, entry),
                name: entry.name,
            }))

            let data!: ArrayBuffer
            let fileName!: string

            if (files.length == 1 && files[0].type == 'file') {
                const file = files[0]
                const filePath = file.path
                data = await fs.promises.readFile(filePath, 'uint8array')
                fileName = file.name
            } else {
                const allFilePaths: string[] = (
                    await Promise.all(
                        files.map(async file => {
                            const path = file.path.substring(1)
                            const stat = await fs.promises.stat(path)
                            if (stat.isFile()) {
                                return path
                            } else {
                                const paths = await fs.promises.readdir(path, { recursive: true, withFileTypes: true })
                                return paths.filter(d => d.isFile()).map(d => path + '/' + d.parentPath + '/' + d.name)
                            }
                        })
                    )
                ).flat()

                const treeEntries = await throttleTasks(allFilePaths, async path => {
                    const buffer = await fs.promises.readFile(path, 'uint8array')
                    return { path, data: new Uint8Array(buffer) }
                })

                const tree = buildZipTreeRecursive(treeEntries)
                data = (await zipFiles(tree)).buffer as ArrayBuffer
                fileName =
                    files
                        .splice(0, 3)
                        .map(f => f.name)
                        .join('-') + '.zip'
            }

            if (data && fileName) {
                const blob = new Blob([data], { type: 'application/octet-stream' })
                const url = URL.createObjectURL(blob)

                downloadURI(url, fileName)
            }

            startdownload()
        },
    })
}
