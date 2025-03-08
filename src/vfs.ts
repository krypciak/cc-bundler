import 'core-js/actual/typed-array/to-base64'
import * as gzip from './compress'

// import * as _vfs from './fttree.json'
// const _vfsRaw = VFS_DATA
// const _vfs = JSON.parse(_vfsRaw)
// @ts-expect-error
const vfs: VfsTree = VFS_DATA
// @ts-expect-error
// prettier-ignore
const dataRef: DataRef = [REF_DATA_0, REF_DATA_1, REF_DATA_2, REF_DATA_3, REF_DATA_4, REF_DATA_5, REF_DATA_6, REF_DATA_7, REF_DATA_8, REF_DATA_9, REF_DATA_10, REF_DATA_11, REF_DATA_12, REF_DATA_13, REF_DATA_14, ]

export interface VfsTree {
    [name: string]: VfsNode
}
export type DataRef = string[][]

export type NodeDir = { t: 'd' } & VfsTree
export type NodeFile = { t: 'f'; c: string }
export type NodeRef = { t: 'r'; fi: number; i: number }
export type VfsNode = NodeDir | NodeFile | NodeRef

export function isFile(node: VfsNode): node is NodeFile {
    return node.t == 'f'
}
export function isDir(node: VfsNode): node is NodeDir {
    return node.t == 'd'
}
export function isRef(node: VfsNode): node is NodeRef {
    return node.t == 'r'
}

function resolvePath(path: string): VfsNode {
    path = path.trim()
    if (path.startsWith('/')) path = path.substring('/'.length)
    if (path.startsWith('assets/')) path = path.substring('assets/'.length)
    const sp = path.split('/')
    let obj = vfs
    for (let i = 0; i < sp.length - 1; i++) {
        const next = obj[sp[i]]
        if (!next || !isDir(next)) throw new Error(`vfs: No such directory: ${path}`)
        obj = next
    }
    const ret = obj[sp[sp.length - 1]]
    if (!ret) throw new Error(`vfs: No such file or directory: ${path}`)
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
    let compressedStr
    if (isFile(node)) {
        compressedStr = node.c
    } else if (isRef(node)) {
        compressedStr = dataRef[node.fi][node.i]
    } else throw new Error(`vfs: Not a file: ${path}`)

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
    if (!isDir(node)) throw new Error(`vfs: Not a directory: ${path}`)
    return Object.keys(node).filter(key => key != 't')
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

function initAudio() {
    const orig = window.Audio
    window.Audio = function (src?: string) {
        const obj = new orig()
        if (src) {
            fs.promises.readFile(src).then(data => {
                // @ts-expect-error
                const base64 = data.toBase64()
                obj.src = 'data:audio/ogg;base64,' + base64
            })
        }
        return obj
    } as any
}
function initXml() {
    class MyXmlHttpRequest {
        readonly UNSENT = 0
        readonly OPENED = 1
        readonly HEADERS_RECEIVED = 2
        readonly LOADING = 3
        readonly DONE = 4

        readyState: number = 0
        responseType?: XMLHttpRequestResponseType
        response: any
        status?: number
        onreadystatechange?: ((this: XMLHttpRequest, ev: Event) => any) | null
        onload?: () => void
        onerror?: () => void

        private url?: string

        constructor() {}
        open(_method: string, url: string | URL): void {
            if (typeof url !== 'string')
                throw new Error(`vfs: XmlHttpRequest: unsuppoted url type: ${typeof url}`)
            this.url = url
        }
        send(_body?: Document | XMLHttpRequestBodyInit | null): void {
            if (!this.url) throw new Error(`vfs: XmlHttpRequest: send called before open`)
            fs.promises.readFile(this.url).then(data => {
                if (this.responseType == 'arraybuffer') {
                    this.response = data.buffer
                    this.readyState = 200
                    if (this.onload) this.onload()
                } else
                    throw new Error(
                        `vfs: XmlHttpRequest: unsupported responseType: ${this.responseType}`
                    )
            })
        }
        setRequestHeader(_name: string, _value: string): void {}
        addEventListener(
            _type: string,
            _listener: EventListenerOrEventListenerObject,
            _options?: boolean | AddEventListenerOptions
        ): void {}
    }
    // @ts-expect-error
    window.XMLHttpRequest = MyXmlHttpRequest
}

export async function initVfs() {
    initAjax()
    initIgImage()
    initAudio()
    initXml()
}
