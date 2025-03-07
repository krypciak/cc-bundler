import * as _vfs from './fttree.json'
const vfs: FileSystemTree = _vfs as any
import * as gzip from './compress'

import 'core-js/actual/typed-array/to-base64'

type Node = DirectoryNode | FileNode
export type FileSystemTree = Record<string, Node>
export interface DirectoryNode {
    directory: FileSystemTree
}
export interface FileNode {
    file: {
        contents: string
    }
}

function resolvePath(path: string): Node {
    path = path.trim()
    if (path.startsWith('/')) path = path.substring('/'.length)
    if (path.startsWith('assets/')) path = path.substring('assets/'.length)
    const sp = path.split('/')
    let obj = vfs
    for (let i = 0; i < sp.length - 1; i++) {
        const next = obj[sp[i]]
        if (!next || 'file' in next)
            throw new Error(`vfs: No such file or directory (dir traversal): ${path}`)
        obj = next.directory
    }
    const ret = obj[sp[sp.length - 1]]
    if (!ret) throw new Error(`vfs: No such file or directory (excuse me?) ${ret} ${path}`)
    return ret
}

async function base64ToBufferAsync(base64: string) {
    var dataUrl = 'data:application/octet-binary;base64,' + base64

    const buf = await fetch(dataUrl).then(res => res.arrayBuffer())
    return new Uint8Array(buf)
}

async function readFile(path: string, encoding: 'utf-8'): Promise<string>
async function readFile(path: string, encoding?: string): Promise<Uint8Array>
async function readFile(path: string, encoding?: string): Promise<string | Uint8Array> {
    const node = resolvePath(path)
    if (!('file' in node)) throw new Error(`vfs: Not a file: ${path}`)
    const compressedStr = node.file.contents
    const compressedBuf = await base64ToBufferAsync(compressedStr)
    let ret
    if (encoding == 'utf-8') ret = await gzip.decompressToString(compressedBuf)
    else ret = await gzip.decompressToChunks(compressedBuf)

    return ret
}

async function readDir(
    path: string,
    options: {
        withFileTypes?: false | undefined
        recursive?: boolean | undefined
    } = {}
): Promise<string[]> {
    if (options.withFileTypes) throw new Error(`vfs: readdir: unsupported option: withFileTypes`)
    if (options.recursive) throw new Error(`vfs: readdir: unsupported option: recursive`)

    const node = resolvePath(path)
    if (!('directory' in node)) throw new Error(`vfs: Not a directory: ${path}`)
    return Object.keys(node.directory)
}

export const fs = {
    promises: {
        // @ts-expect-error
        readFile: readFile,
        // @ts-expect-error
        readdir: readDir,
    },
} satisfies Partial<typeof import('fs')>

function initAjax() {
    $.ajax = (settings?: JQuery.AjaxSettings | string): JQuery.jqXHR => {
        if (!settings) throw new Error(`vfs: $.ajax: settings not set`)
        if (typeof settings == 'string')
            throw new Error(`vfs: $.ajax: unsupported argument (string)`)
        ;(async () => {
            if (!settings.url) throw new Error(`vfs: $.ajax: settings.url not set`)
            if (!settings.success)
                throw new Error(`vfs: $.ajax: settings.success not set, what are you doing??`)
            if (typeof settings.success != 'function')
                throw new Error(
                    `vfs: $.ajax: unsupported settings.success type: ${typeof settings.error}`
                )
            if (typeof settings.error != 'function')
                throw new Error(
                    `vfs: $.ajax: unsupported settings.error type: ${typeof settings.error}`
                )

            let data
            if (
                settings.url ==
                ig.root + 'page/api/get-extension-list.php?debug=' + (window.IG_GAME_DEBUG ? 1 : 0)
            ) {
                data = await readDir('extension')
                data = data.filter(dir => dir != 'readme.txt')
            } else {
                try {
                    const dataStr: string = await fs.promises.readFile(settings.url, 'utf-8')

                    if (settings.dataType == 'json') {
                        data = JSON.parse(dataStr)
                    } else
                        throw new Error(
                            `vfs: $.ajax: unsupported settings.dataType: ${settings.dataType}`
                        )
                } catch (e) {
                    console.error(e)
                    if (settings.error) {
                        settings.error.call(
                            settings.context,
                            undefined as any,
                            undefined as any,
                            undefined as any
                        )
                    }
                    return
                }
            }
            settings.success.call(settings.context, data, undefined as any, undefined as any)
        })()
        return undefined as any
    }
}

function initIgImage() {
    ig.Image.inject({
        loadInternal() {
            this.data = new Image()
            this.data.onload = this.onload.bind(this)
            this.data.onerror = this.onerror.bind(this)

            fs.promises.readFile(this.path).then(data => {
                // @ts-expect-error
                const base64 = data.toBase64()
                const src = 'data:image/png;base64,' + base64
                this.data.src = src
            })
        },
    })
}

export async function initVfs() {
    initAjax()
    initIgImage()
}
